import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole } from '@/types/auth'
import { REGION_IDS, MARKET_SEEDER_DEFAULTS } from '@/types/market-seeder'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const ESI_BASE = 'https://esi.evetech.net'

interface ESIHistoricalOrder {
  duration: number
  escrow?: number
  is_buy_order: boolean
  is_corporation: boolean
  issued: string
  location_id: number
  min_volume?: number
  order_id: number
  price: number
  range: string
  region_id: number
  state: 'cancelled' | 'expired'
  type_id: number
  volume_remain: number
  volume_total: number
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

interface AggregatedItem {
  typeId: number
  typeName: string
  categoryName: string | null
  quantitySold: number
  orderCount: number
  avgSellPrice: number
  totalRevenue: number
  jitaPrice: number | null
  estimatedCost: number
  totalProfit: number
  profitMargin: number
}

interface OrderHistoryResponse {
  success: boolean
  items: AggregatedItem[]
  summary: {
    totalOrders: number
    totalRevenue: number
    totalProfit: number
    avgProfitMargin: number
    charactersQueried: number
  }
  period: '3d' | '7d' | '30d'
  analyzedAt: string
  config: {
    transportCostPerM3: number
  }
}

/**
 * Read tradeable items from JSONL file to get item names
 */
async function loadItemNames(): Promise<Map<number, TradeableItem>> {
  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  const items = new Map<number, TradeableItem>()

  if (!fs.existsSync(filePath)) {
    console.warn('[Order History] Tradeable items file not found')
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
              'X-Compatibility-Date': '2025-12-16',
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
 * Calculate days since a date
 */
function daysSince(isoDate: string): number {
  const issued = new Date(isoDate)
  const now = new Date()
  return Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Format ISK value to human-readable string
 */
function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T ISK`
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B ISK`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M ISK`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K ISK`
  }
  return `${value.toFixed(2)} ISK`
}

/**
 * GET /api/esi/order-history
 * 
 * Fetches historical orders for all characters linked to the authenticated user.
 * Returns completed (fully sold) orders grouped by time period with profit analysis.
 * 
 * Query Parameters:
 *   - period: '3d' | '7d' | '30d' (default: '7d')
 *   - transport_cost: ISK per m³ (default: 450)
 */
export async function GET(request: NextRequest) {
  // Get authenticated user from session
  const session = await getAuthenticatedUser(request)

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user_id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams
  const periodParam = searchParams.get('period') || '7d'
  const period = ['3d', '7d', '30d'].includes(periodParam) 
    ? periodParam as '3d' | '7d' | '30d' 
    : '7d'
  
  const transportCostPerM3 = parseFloat(
    searchParams.get('transport_cost') || String(MARKET_SEEDER_DEFAULTS.TRANSPORT_COST_PER_M3)
  )

  // Calculate date threshold based on period
  const periodDays = parseInt(period.replace('d', ''))
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - periodDays)

  // Get tokens for all characters
  const characterTokens = await getAllCharacterTokens(session.user_id)

  if (characterTokens.length === 0) {
    return NextResponse.json(
      { error: 'No characters with valid tokens found' },
      { status: 400 }
    )
  }

  try {
    // Fetch historical orders for each character (paginated)
    const allOrders: ESIHistoricalOrder[] = []

    for (const token of characterTokens) {
      let page = 1
      let hasMorePages = true

      while (hasMorePages) {
        const response = await fetch(
          `${ESI_BASE}/characters/${token.character_id}/orders/history/?page=${page}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token.access_token}`,
              'X-Compatibility-Date': '2025-12-16',
            },
          }
        )

        if (!response.ok) {
          console.warn(`[Order History] Failed to fetch page ${page} for ${token.character_name}`)
          break
        }

        const orders: ESIHistoricalOrder[] = await response.json()
        
        // Filter: only expired orders (not cancelled) with volume_remain === 0 (fully sold)
        // Only sell orders (not buy orders)
        const completedSellOrders = orders.filter(o => 
          o.state === 'expired' && 
          o.volume_remain === 0 && 
          !o.is_buy_order
        )

        allOrders.push(...completedSellOrders)

        // Check for more pages
        const xPages = response.headers.get('X-Pages')
        const totalPages = xPages ? parseInt(xPages) : 1
        hasMorePages = page < totalPages
        page++

        // Small delay to avoid rate limiting
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    // Filter by time period (based on issued date)
    const ordersInPeriod = allOrders.filter(o => {
      const issuedDate = new Date(o.issued)
      return issuedDate >= thresholdDate
    })

    if (ordersInPeriod.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        summary: {
          totalOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgProfitMargin: 0,
          charactersQueried: characterTokens.length,
        },
        period,
        analyzedAt: new Date().toISOString(),
        config: { transportCostPerM3 },
      } as OrderHistoryResponse)
    }

    // Load item metadata
    const itemNames = await loadItemNames()

    // Get unique type IDs and fetch Jita prices
    const typeIds = [...new Set(ordersInPeriod.map(o => o.type_id))]
    const jitaPrices = await fetchJitaPrices(typeIds)

    // Aggregate orders by type_id
    const aggregatedByType = new Map<number, {
      orders: ESIHistoricalOrder[]
      totalRevenue: number
      totalVolume: number
    }>()

    for (const order of ordersInPeriod) {
      const existing = aggregatedByType.get(order.type_id)
      const orderRevenue = order.price * order.volume_total

      if (existing) {
        existing.orders.push(order)
        existing.totalRevenue += orderRevenue
        existing.totalVolume += order.volume_total
      } else {
        aggregatedByType.set(order.type_id, {
          orders: [order],
          totalRevenue: orderRevenue,
          totalVolume: order.volume_total,
        })
      }
    }

    // Calculate profit for each item type
    const items: AggregatedItem[] = []
    let totalRevenue = 0
    let totalProfit = 0

    for (const [typeId, data] of aggregatedByType) {
      const itemInfo = itemNames.get(typeId)
      const jitaPrice = jitaPrices.get(typeId) ?? null
      const avgSellPrice = data.totalRevenue / data.totalVolume
      
      // Calculate estimated cost (Jita price + transport)
      let estimatedCost = 0
      let profit = 0
      let profitMargin = 0

      if (jitaPrice !== null && itemInfo) {
        const transportCost = itemInfo.volume * transportCostPerM3
        const costPerUnit = jitaPrice + transportCost
        estimatedCost = costPerUnit * data.totalVolume
        profit = data.totalRevenue - estimatedCost
        profitMargin = estimatedCost > 0 ? (profit / estimatedCost) * 100 : 0
      } else if (jitaPrice !== null) {
        // No item info, estimate without transport
        estimatedCost = jitaPrice * data.totalVolume
        profit = data.totalRevenue - estimatedCost
        profitMargin = estimatedCost > 0 ? (profit / estimatedCost) * 100 : 0
      }

      items.push({
        typeId,
        typeName: itemInfo?.name ?? `Unknown (${typeId})`,
        categoryName: itemInfo?.categoryName ?? null,
        quantitySold: data.totalVolume,
        orderCount: data.orders.length,
        avgSellPrice,
        totalRevenue: data.totalRevenue,
        jitaPrice,
        estimatedCost,
        totalProfit: profit,
        profitMargin,
      })

      totalRevenue += data.totalRevenue
      totalProfit += profit
    }

    // Sort by total profit descending
    items.sort((a, b) => b.totalProfit - a.totalProfit)

    // Calculate average profit margin (weighted by revenue)
    const avgProfitMargin = totalRevenue > 0 
      ? items.reduce((sum, i) => sum + (i.profitMargin * i.totalRevenue), 0) / totalRevenue
      : 0

    return NextResponse.json({
      success: true,
      items,
      summary: {
        totalOrders: ordersInPeriod.length,
        totalRevenue,
        totalProfit,
        avgProfitMargin,
        charactersQueried: characterTokens.length,
      },
      period,
      analyzedAt: new Date().toISOString(),
      config: { transportCostPerM3 },
    } as OrderHistoryResponse)

  } catch (error) {
    console.error('[Order History] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order history' },
      { status: 500 }
    )
  }
}

