import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  type CapitalOrder,
  type CapitalEfficiencyResponse,
  DEAD_CAPITAL_THRESHOLD_DAYS,
  MARKET_SEEDER_DEFAULTS,
  REGION_IDS,
  VALE_HUB_FACTOR,
} from '@/types/market-seeder'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const ESI_BASE = 'https://esi.evetech.net'

interface ESIMarketOrder {
  order_id: number
  type_id: number
  location_id: number
  volume_total: number
  volume_remain: number
  min_volume: number
  price: number
  is_buy_order: boolean
  duration: number
  issued: string
  range: string
}

interface TradeableItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number | null
}

/**
 * Read tradeable items from JSONL file to get item names
 */
async function loadItemNames(): Promise<Map<number, TradeableItem>> {
  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  const items = new Map<number, TradeableItem>()

  if (!fs.existsSync(filePath)) {
    console.warn('[Capital Efficiency] Tradeable items file not found')
    return items
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const item = JSON.parse(line) as TradeableItem
        items.set(item.typeId, item)
      } catch {
        // Skip invalid lines
      }
    }
  }

  return items
}

/**
 * Fetch Vale of the Silent market history for the given type IDs
 * This provides actual regional demand data for the alliance hub
 */
async function fetchValeVolumes(
  typeIds: number[],
  days: number = 30
): Promise<Map<number, number>> {
  if (typeIds.length === 0) return new Map()

  const supabase = createClient()
  const result = new Map<number, number>()

  // Use the RPC function for efficient batch query - fetching Vale data
  const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
    p_type_ids: typeIds,
    p_region_id: REGION_IDS.VALE_OF_SILENT,
    p_days_back: days
  })

  if (error) {
    console.error('[Capital Efficiency] Failed to fetch Vale market history:', error)
    return result
  }

  if (data && Array.isArray(data)) {
    for (const row of data as { type_id: number; avg_daily_volume: number }[]) {
      result.set(row.type_id, row.avg_daily_volume || 0)
    }
  }

  return result
}

/**
 * Fetch current Jita sell prices for cost basis calculation
 */
async function fetchJitaPrices(typeIds: number[]): Promise<Map<number, number>> {
  const prices = new Map<number, number>()
  const CONCURRENT = 20
  
  for (let i = 0; i < typeIds.length; i += CONCURRENT) {
    const batch = typeIds.slice(i, i + CONCURRENT)
    
    const promises = batch.map(async (typeId) => {
      try {
        const response = await fetch(
          `${ESI_BASE}/markets/${REGION_IDS.THE_FORGE}/orders/?type_id=${typeId}&order_type=sell`,
          {
            headers: {
              'Accept': 'application/json',
              'X-Compatibility-Date': '2025-11-06',
            }
          }
        )
        
        if (!response.ok) return null
        
        const orders: { price: number }[] = await response.json()
        if (orders.length === 0) return null
        
        const lowestPrice = Math.min(...orders.map(o => o.price))
        return { typeId, price: lowestPrice }
      } catch {
        return null
      }
    })
    
    const results = await Promise.all(promises)
    for (const r of results) {
      if (r) prices.set(r.typeId, r.price)
    }
    
    // Small delay between batches
    if (i + CONCURRENT < typeIds.length) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  return prices
}

/**
 * Determine efficiency category based on days to sell
 */
function getEfficiencyCategory(
  daysToSell: number | null
): 'fast' | 'moderate' | 'slow' | 'dead' | 'unknown' {
  if (daysToSell === null) return 'unknown'
  if (daysToSell <= 14) return 'fast'
  if (daysToSell <= 30) return 'moderate'
  if (daysToSell <= DEAD_CAPITAL_THRESHOLD_DAYS) return 'slow'
  return 'dead'
}

/**
 * Calculate days since a date
 */
function daysSince(isoDate: string): number {
  const issued = new Date(isoDate)
  const now = new Date()
  return Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * GET /api/esi/capital-efficiency
 * 
 * Analyzes capital efficiency of character's active sell orders.
 * Uses actual Vale of the Silent market data for demand estimation.
 * 
 * Query Parameters:
 *   - character_id (required): The character ID
 *   - transport_cost (optional): ISK per m³ (default: 450)
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const characterId = searchParams.get('character_id')
  const transportCostPerM3 = parseFloat(
    searchParams.get('transport_cost') || String(MARKET_SEEDER_DEFAULTS.TRANSPORT_COST_PER_M3)
  )

  const authHeader = request.headers.get('authorization')

  if (!characterId) {
    return NextResponse.json(
      { error: 'character_id is required' },
      { status: 400 }
    )
  }

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authorization header required. Requires esi-markets.read_character_orders.v1 scope.' },
      { status: 401 }
    )
  }

  try {
    // Step 1: Fetch character's market orders from ESI
    console.log(`[Capital Efficiency] Fetching orders for character ${characterId}`)
    const ordersResponse = await fetch(
      `${ESI_BASE}/characters/${characterId}/orders/`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'X-Compatibility-Date': '2025-11-06',
        },
      }
    )

    if (!ordersResponse.ok) {
      const error = await ordersResponse.text()
      return NextResponse.json(
        { error: `ESI Error: ${ordersResponse.status}`, details: error },
        { status: ordersResponse.status }
      )
    }

    const allOrders: ESIMarketOrder[] = await ordersResponse.json()
    
    // Filter to only sell orders
    const sellOrders = allOrders.filter(o => !o.is_buy_order)
    console.log(`[Capital Efficiency] Found ${sellOrders.length} active sell orders`)

    if (sellOrders.length === 0) {
      return NextResponse.json({
        success: true,
        characterId: parseInt(characterId),
        analyzedAt: new Date().toISOString(),
        summary: {
          totalCapitalDeployed: 0,
          totalOrders: 0,
          totalDailyRevenue: 0,
          avgDaysToSell: 0,
          effectiveAPY: 0,
          deadCapitalThreshold: DEAD_CAPITAL_THRESHOLD_DAYS,
          deadCapitalValue: 0,
          deadCapitalOrders: 0,
          fastCapital: 0,
          moderateCapital: 0,
          slowCapital: 0,
        },
        orders: [],
        config: {
          hubFactor: VALE_HUB_FACTOR,  // 5% of Vale volume
          transportCostPerM3,
          deadCapitalThresholdDays: DEAD_CAPITAL_THRESHOLD_DAYS,
        },
      } as CapitalEfficiencyResponse)
    }

    // Step 2: Load item metadata
    const itemNames = await loadItemNames()
    
    // Step 3: Get unique type IDs and fetch market data
    const typeIds = [...new Set(sellOrders.map(o => o.type_id))]
    console.log(`[Capital Efficiency] Fetching market data for ${typeIds.length} unique items`)
    
    // Fetch Vale volumes for demand estimation and Jita prices for cost basis
    const [valeVolumes, jitaPrices] = await Promise.all([
      fetchValeVolumes(typeIds),
      fetchJitaPrices(typeIds),
    ])
    
    // Step 4: Analyze each order
    const capitalOrders: CapitalOrder[] = []
    
    for (const order of sellOrders) {
      const item = itemNames.get(order.type_id)
      const valeDailyVolume = valeVolumes.get(order.type_id) || 0
      const jitaBuyPrice = jitaPrices.get(order.type_id) || null
      
      // Calculate metrics - using Vale volume × 5% hub factor
      const capitalDeployed = order.price * order.volume_remain
      const estimatedDailySales = valeDailyVolume * VALE_HUB_FACTOR
      const daysToSell = estimatedDailySales > 0 
        ? order.volume_remain / estimatedDailySales 
        : null
      const daysListed = daysSince(order.issued)
      
      // Calculate profit if we have Jita price
      const itemVolume = item?.volume || 0.01
      const transportCost = itemVolume * transportCostPerM3
      const profitPerUnit = jitaBuyPrice !== null 
        ? order.price - jitaBuyPrice - transportCost 
        : null
      const totalProfit = profitPerUnit !== null 
        ? profitPerUnit * order.volume_remain 
        : null
      
      // Calculate APY: (annual profit / capital) * 100
      // APY = (profitPerUnit / totalCost) * (365 / daysToSell) * 100
      let effectiveAPY: number | null = null
      if (profitPerUnit !== null && jitaBuyPrice !== null && daysToSell !== null && daysToSell > 0) {
        const totalCost = jitaBuyPrice + transportCost
        if (totalCost > 0) {
          effectiveAPY = (profitPerUnit / totalCost) * (365 / daysToSell) * 100
        }
      }
      
      const efficiency = getEfficiencyCategory(daysToSell)
      const isDeadCapital = efficiency === 'dead'
      
      capitalOrders.push({
        orderId: order.order_id,
        typeId: order.type_id,
        itemName: item?.name || `Unknown Item ${order.type_id}`,
        categoryName: item?.categoryName || null,
        groupName: item?.groupName || null,
        price: order.price,
        volumeRemain: order.volume_remain,
        volumeTotal: order.volume_total,
        locationId: order.location_id,
        issued: order.issued,
        capitalDeployed,
        jitaDailyVolume: valeDailyVolume,  // Now using Vale volume
        estimatedDailySales,
        daysToSell,
        daysListed,
        jitaBuyPrice,
        transportCost,
        profitPerUnit,
        totalProfit,
        effectiveAPY,
        isDeadCapital,
        efficiency,
      })
    }
    
    // Step 5: Calculate summary metrics
    const totalCapitalDeployed = capitalOrders.reduce((sum, o) => sum + o.capitalDeployed, 0)
    
    // Calculate capital-weighted average days to sell
    let weightedDaysSum = 0
    let capitalWithDays = 0
    for (const order of capitalOrders) {
      if (order.daysToSell !== null) {
        weightedDaysSum += order.daysToSell * order.capitalDeployed
        capitalWithDays += order.capitalDeployed
      }
    }
    const avgDaysToSell = capitalWithDays > 0 ? weightedDaysSum / capitalWithDays : 0
    
    // Calculate total daily revenue (sum of capitalDeployed / daysToSell for each)
    const totalDailyRevenue = capitalOrders.reduce((sum, o) => {
      if (o.daysToSell !== null && o.daysToSell > 0) {
        return sum + (o.capitalDeployed / o.daysToSell)
      }
      return sum
    }, 0)
    
    // Calculate portfolio-wide APY
    let totalWeightedAPY = 0
    let capitalWithAPY = 0
    for (const order of capitalOrders) {
      if (order.effectiveAPY !== null && order.effectiveAPY > 0) {
        totalWeightedAPY += order.effectiveAPY * order.capitalDeployed
        capitalWithAPY += order.capitalDeployed
      }
    }
    const effectiveAPY = capitalWithAPY > 0 ? totalWeightedAPY / capitalWithAPY : 0
    
    // Dead capital
    const deadOrders = capitalOrders.filter(o => o.isDeadCapital)
    const deadCapitalValue = deadOrders.reduce((sum, o) => sum + o.capitalDeployed, 0)
    
    // Capital by efficiency
    const fastCapital = capitalOrders
      .filter(o => o.efficiency === 'fast')
      .reduce((sum, o) => sum + o.capitalDeployed, 0)
    const moderateCapital = capitalOrders
      .filter(o => o.efficiency === 'moderate')
      .reduce((sum, o) => sum + o.capitalDeployed, 0)
    const slowCapital = capitalOrders
      .filter(o => o.efficiency === 'slow')
      .reduce((sum, o) => sum + o.capitalDeployed, 0)
    
    // Sort by days to sell descending (slowest first to highlight dead capital)
    capitalOrders.sort((a, b) => {
      if (a.daysToSell === null) return 1
      if (b.daysToSell === null) return -1
      return b.daysToSell - a.daysToSell
    })
    
    const response: CapitalEfficiencyResponse = {
      success: true,
      characterId: parseInt(characterId),
      analyzedAt: new Date().toISOString(),
      summary: {
        totalCapitalDeployed,
        totalOrders: capitalOrders.length,
        totalDailyRevenue,
        avgDaysToSell: Math.round(avgDaysToSell * 10) / 10,
        effectiveAPY: Math.round(effectiveAPY * 10) / 10,
        deadCapitalThreshold: DEAD_CAPITAL_THRESHOLD_DAYS,
        deadCapitalValue,
        deadCapitalOrders: deadOrders.length,
        fastCapital,
        moderateCapital,
        slowCapital,
      },
      orders: capitalOrders,
      config: {
        hubFactor: VALE_HUB_FACTOR,  // 5% of Vale volume
        transportCostPerM3,
        deadCapitalThresholdDays: DEAD_CAPITAL_THRESHOLD_DAYS,
      },
    }
    
    console.log(`[Capital Efficiency] Analysis complete in ${Date.now() - startTime}ms`)
    return NextResponse.json(response)

  } catch (error) {
    console.error('[Capital Efficiency] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze capital efficiency' },
      { status: 500 }
    )
  }
}

