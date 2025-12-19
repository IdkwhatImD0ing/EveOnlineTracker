import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  type CapitalOrder,
  type CapitalEfficiencyResponse,
  type CharacterCapitalSummary,
  type RegionId,
  DEAD_CAPITAL_THRESHOLD_DAYS,
  MARKET_SEEDER_DEFAULTS,
  REGION_IDS,
  DEFAULT_HUB_FACTOR,
  DEFAULT_VOLUME_REGION_ID,
  VOLUME_REGIONS,
} from '@/types/market-seeder'
import { getValidAccessToken, getSessionWithCharacters } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
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

// Extended order type with character info attached
interface OrderWithCharacter extends ESIMarketOrder {
  characterId: number
  characterName: string
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
 * SSE Helper: Send an event to the stream
 */
function sendSSEEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: string,
  data: unknown
) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(encoder.encode(message))
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
 * Fetch market history volumes for the given type IDs from a specific region
 * This provides actual regional demand data for the analysis
 */
async function fetchRegionVolumes(
  typeIds: number[],
  regionId: RegionId = DEFAULT_VOLUME_REGION_ID,
  days: number = 30
): Promise<Map<number, number>> {
  if (typeIds.length === 0) return new Map()

  const supabase = createClient()
  const result = new Map<number, number>()
  const regionName = VOLUME_REGIONS.find(r => r.id === regionId)?.name ?? `Region ${regionId}`

  // Use the RPC function for efficient batch query
  const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
    p_type_ids: typeIds,
    p_region_id: regionId,
    p_days_back: days
  })

  if (error) {
    console.error(`[Capital Efficiency] Failed to fetch ${regionName} market history:`, error)
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
 * Uses regional market data for demand estimation.
 * Returns Server-Sent Events with progress updates during analysis.
 * 
 * Query Parameters:
 *   - transport_cost (optional): ISK per m³ (default: 450)
 *   - volume_region_id (optional): Region ID for volume data (default: 10000003 / Vale of the Silent)
 *   - hub_factor (optional): Hub factor percentage (default: 0.05 / 5%)
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const transportCostPerM3 = parseFloat(
    searchParams.get('transport_cost') || String(MARKET_SEEDER_DEFAULTS.TRANSPORT_COST_PER_M3)
  )
  
  // Parse volume region ID
  const volumeRegionIdParam = searchParams.get('volume_region_id')
  let volumeRegionId: RegionId = DEFAULT_VOLUME_REGION_ID
  if (volumeRegionIdParam) {
    const parsed = parseInt(volumeRegionIdParam)
    if (VOLUME_REGIONS.some(r => r.id === parsed)) {
      volumeRegionId = parsed as RegionId
    }
  }

  // Parse hub factor (accept any positive number, not just presets)
  const hubFactorParam = searchParams.get('hub_factor')
  let hubFactor = DEFAULT_HUB_FACTOR
  if (hubFactorParam) {
    const parsed = parseFloat(hubFactorParam)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
      hubFactor = parsed
    }
  }

  // Get session with all characters (from session cookie or Authorization header)
  const session = await getSessionWithCharacters(request)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Account pending approval' },
      { status: 403 }
    )
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user.id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now()

      try {
        // Progress: Starting
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'starting',
          message: 'Starting capital efficiency analysis...',
          percent: 0
        })

        // Step 1: Fetch all characters' market orders
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'characters',
          message: `Fetching orders for ${session.allCharacters.length} character${session.allCharacters.length !== 1 ? 's' : ''}...`,
          percent: 5
        })

        let allOrders: OrderWithCharacter[] = []
        
        for (let i = 0; i < session.allCharacters.length; i++) {
          const character = session.allCharacters[i]
          const accessToken = await getValidAccessToken(character.character_id)
          if (!accessToken) continue
          
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'characters',
            message: `Fetching orders for ${character.character_name}...`,
            percent: 5 + ((i + 1) / session.allCharacters.length) * 15
          })

          console.log(`[Capital Efficiency] Fetching orders for character ${character.character_id} (${character.character_name})`)
          const ordersResponse = await fetch(
            `${ESI_BASE}/characters/${character.character_id}/orders/`,
            {
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'X-Compatibility-Date': '2025-11-06',
              },
            }
          )

          if (ordersResponse.ok) {
            const orders: ESIMarketOrder[] = await ordersResponse.json()
            // Attach character info to each order
            const ordersWithCharacter = orders.map(o => ({
              ...o,
              characterId: character.character_id,
              characterName: character.character_name,
            }))
            allOrders = allOrders.concat(ordersWithCharacter)
          }
        }
        
        // Filter to only sell orders
        const sellOrders = allOrders.filter(o => !o.is_buy_order)
        console.log(`[Capital Efficiency] Found ${sellOrders.length} active sell orders`)

        if (sellOrders.length === 0) {
          const emptyResponse: CapitalEfficiencyResponse = {
            success: true,
            characterId: session.mainCharacter?.character_id ?? 0,
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
              byCharacter: [],
            },
            orders: [],
            config: {
              hubFactor,
              transportCostPerM3,
              deadCapitalThresholdDays: DEAD_CAPITAL_THRESHOLD_DAYS,
            },
          }
          sendSSEEvent(controller, encoder, 'complete', emptyResponse)
          controller.close()
          return
        }

        // Step 2: Load item metadata
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'metadata',
          message: 'Loading item metadata...',
          percent: 25
        })
        const itemNames = await loadItemNames()
        
        // Step 3: Get unique type IDs and fetch market data
        const typeIds = [...new Set(sellOrders.map(o => o.type_id))]
        console.log(`[Capital Efficiency] Fetching market data for ${typeIds.length} unique items`)
        
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'market_data',
          message: `Fetching market data for ${typeIds.length} items...`,
          percent: 35
        })

        // Fetch regional volumes for demand estimation and Jita prices for cost basis
        const [regionVolumes, jitaPrices] = await Promise.all([
          fetchRegionVolumes(typeIds, volumeRegionId),
          fetchJitaPrices(typeIds),
        ])

        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'market_data',
          message: 'Market data loaded',
          percent: 70
        })
        
        // Step 4: Analyze each order
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'analyzing',
          message: `Analyzing ${sellOrders.length} orders...`,
          percent: 75
        })

        const capitalOrders: CapitalOrder[] = []
        
        for (const order of sellOrders) {
          const item = itemNames.get(order.type_id)
          const regionDailyVolume = regionVolumes.get(order.type_id) || 0
          const jitaBuyPrice = jitaPrices.get(order.type_id) || null
          
          // Calculate metrics - using regional volume × hub factor
          const capitalDeployed = order.price * order.volume_remain
          const estimatedDailySales = regionDailyVolume * hubFactor
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
            characterId: order.characterId,
            characterName: order.characterName,
            price: order.price,
            volumeRemain: order.volume_remain,
            volumeTotal: order.volume_total,
            locationId: order.location_id,
            issued: order.issued,
            capitalDeployed,
            jitaDailyVolume: regionDailyVolume,  // Using selected region volume
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
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'summary',
          message: 'Calculating summary metrics...',
          percent: 90
        })

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
        
        // Capital by character
        const characterMap = new Map<number, {
          characterId: number
          characterName: string
          capital: number
          orderCount: number
          dailyRevenue: number
          weightedAPY: number
          capitalWithAPY: number
        }>()
        
        for (const order of capitalOrders) {
          const existing = characterMap.get(order.characterId)
          const orderDailyRevenue = (order.daysToSell !== null && order.daysToSell > 0)
            ? order.capitalDeployed / order.daysToSell
            : 0
          
          if (existing) {
            existing.capital += order.capitalDeployed
            existing.orderCount++
            existing.dailyRevenue += orderDailyRevenue
            if (order.effectiveAPY !== null && order.effectiveAPY > 0) {
              existing.weightedAPY += order.effectiveAPY * order.capitalDeployed
              existing.capitalWithAPY += order.capitalDeployed
            }
          } else {
            characterMap.set(order.characterId, {
              characterId: order.characterId,
              characterName: order.characterName,
              capital: order.capitalDeployed,
              orderCount: 1,
              dailyRevenue: orderDailyRevenue,
              weightedAPY: (order.effectiveAPY !== null && order.effectiveAPY > 0)
                ? order.effectiveAPY * order.capitalDeployed
                : 0,
              capitalWithAPY: (order.effectiveAPY !== null && order.effectiveAPY > 0)
                ? order.capitalDeployed
                : 0,
            })
          }
        }
        
        // Convert to array and calculate percentages
        const byCharacter: CharacterCapitalSummary[] = Array.from(characterMap.values())
          .map(c => ({
            characterId: c.characterId,
            characterName: c.characterName,
            capitalDeployed: c.capital,
            orderCount: c.orderCount,
            percentage: totalCapitalDeployed > 0 ? Math.round((c.capital / totalCapitalDeployed) * 1000) / 10 : 0,
            dailyRevenue: c.dailyRevenue,
            effectiveAPY: c.capitalWithAPY > 0 ? Math.round((c.weightedAPY / c.capitalWithAPY) * 10) / 10 : 0,
          }))
          .sort((a, b) => b.capitalDeployed - a.capitalDeployed)  // Sort by capital, highest first
        
        // Sort by days to sell descending (slowest first to highlight dead capital)
        capitalOrders.sort((a, b) => {
          if (a.daysToSell === null) return 1
          if (b.daysToSell === null) return -1
          return b.daysToSell - a.daysToSell
        })
        
        const response: CapitalEfficiencyResponse = {
          success: true,
          characterId: session.mainCharacter?.character_id ?? 0,
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
            byCharacter,
          },
          orders: capitalOrders,
          config: {
            hubFactor,
            transportCostPerM3,
            deadCapitalThresholdDays: DEAD_CAPITAL_THRESHOLD_DAYS,
          },
        }
        
        console.log(`[Capital Efficiency] Analysis complete in ${Date.now() - startTime}ms`)
        
        // Send complete event
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'complete',
          message: 'Analysis complete!',
          percent: 100
        })
        sendSSEEvent(controller, encoder, 'complete', response)

      } catch (error) {
        console.error('[Capital Efficiency] Error:', error)
        sendSSEEvent(controller, encoder, 'error', {
          message: error instanceof Error ? error.message : 'Failed to analyze capital efficiency'
        })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
