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

/**
 * Read tradeable items from JSONL file to get item names
 */
async function loadItemNames(): Promise<Map<number, TradeableItem>> {
  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  const items = new Map<number, TradeableItem>()

  if (!fs.existsSync(filePath)) {
    console.warn('[Trading Velocity] Tradeable items file not found')
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
 * Format date to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * GET /api/esi/trading-velocity
 * 
 * Calculates daily profit velocity and trend analysis for trading performance.
 * Returns daily profit aggregations, top performing items, and trend metrics.
 * 
 * Query Parameters:
 *   - period: '7d' | '30d' | '90d' (default: '30d')
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
  const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams
  const periodParam = searchParams.get('period') || '30d'
  const period = ['7d', '30d', '90d'].includes(periodParam) 
    ? periodParam as '7d' | '30d' | '90d' 
    : '30d'
  
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
          console.warn(`[Trading Velocity] Failed to fetch page ${page} for ${token.character_name}`)
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

    // Load item metadata
    const itemNames = await loadItemNames()

    // Get unique type IDs and fetch Jita prices
    const typeIds = [...new Set(ordersInPeriod.map(o => o.type_id))]
    const jitaPrices = await fetchJitaPrices(typeIds)

    // Calculate profit per order
    interface OrderWithProfit extends ESIHistoricalOrder {
      revenue: number
      estimatedCost: number
      profit: number
    }

    const ordersWithProfit: OrderWithProfit[] = ordersInPeriod.map(order => {
      const itemInfo = itemNames.get(order.type_id)
      const jitaPrice = jitaPrices.get(order.type_id) ?? 0
      const revenue = order.price * order.volume_total
      
      let estimatedCost = 0
      if (jitaPrice > 0 && itemInfo) {
        const transportCost = itemInfo.volume * transportCostPerM3
        estimatedCost = (jitaPrice + transportCost) * order.volume_total
      } else if (jitaPrice > 0) {
        estimatedCost = jitaPrice * order.volume_total
      }
      
      const profit = revenue - estimatedCost
      
      return {
        ...order,
        revenue,
        estimatedCost,
        profit
      }
    })

    // Group orders by date for daily profit
    const dailyData = new Map<string, {
      profit: number
      revenue: number
      orders: number
    }>()

    for (const order of ordersWithProfit) {
      const dateKey = formatDate(new Date(order.issued))
      const existing = dailyData.get(dateKey)
      
      if (existing) {
        existing.profit += order.profit
        existing.revenue += order.revenue
        existing.orders += 1
      } else {
        dailyData.set(dateKey, {
          profit: order.profit,
          revenue: order.revenue,
          orders: 1
        })
      }
    }

    // Convert to sorted array
    const dailyProfit = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        profit: data.profit,
        revenue: data.revenue,
        orders: data.orders
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Aggregate by item type for top performers
    const itemAggregates = new Map<number, {
      typeId: number
      typeName: string
      categoryName: string | null
      totalProfit: number
      totalRevenue: number
      orderCount: number
      quantitySold: number
    }>()

    for (const order of ordersWithProfit) {
      const itemInfo = itemNames.get(order.type_id)
      const existing = itemAggregates.get(order.type_id)
      
      if (existing) {
        existing.totalProfit += order.profit
        existing.totalRevenue += order.revenue
        existing.orderCount += 1
        existing.quantitySold += order.volume_total
      } else {
        itemAggregates.set(order.type_id, {
          typeId: order.type_id,
          typeName: itemInfo?.name ?? `Unknown (${order.type_id})`,
          categoryName: itemInfo?.categoryName ?? null,
          totalProfit: order.profit,
          totalRevenue: order.revenue,
          orderCount: 1,
          quantitySold: order.volume_total
        })
      }
    }

    // Calculate profit per day for each item
    const topItems = Array.from(itemAggregates.values())
      .map(item => ({
        ...item,
        profitPerDay: item.totalProfit / periodDays
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 20) // Top 20 items

    // Calculate trend metrics (recent 7 days vs older days)
    const now = new Date()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)

    let recentProfit = 0
    let recentDays = 0
    let olderProfit = 0
    let olderDays = 0

    for (const day of dailyProfit) {
      const dayDate = new Date(day.date)
      if (dayDate >= sevenDaysAgo) {
        recentProfit += day.profit
        recentDays++
      } else {
        olderProfit += day.profit
        olderDays++
      }
    }

    const recentAvg = recentDays > 0 ? recentProfit / recentDays : 0
    const olderAvg = olderDays > 0 ? olderProfit / olderDays : 0
    
    let trendDirection: 'up' | 'down' | 'stable' = 'stable'
    let percentChange = 0
    
    if (olderAvg !== 0) {
      percentChange = ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100
      if (percentChange > 10) {
        trendDirection = 'up'
      } else if (percentChange < -10) {
        trendDirection = 'down'
      }
    } else if (recentAvg > 0) {
      trendDirection = 'up'
      percentChange = 100
    }

    // Calculate summary stats
    const totalProfit = dailyProfit.reduce((sum, d) => sum + d.profit, 0)
    const totalRevenue = dailyProfit.reduce((sum, d) => sum + d.revenue, 0)
    const totalOrders = dailyProfit.reduce((sum, d) => sum + d.orders, 0)
    const daysWithData = dailyProfit.length
    const avgProfitPerDay = daysWithData > 0 ? totalProfit / daysWithData : 0

    // Find best and worst days
    let bestDay = { date: '', profit: -Infinity }
    let worstDay = { date: '', profit: Infinity }
    
    for (const day of dailyProfit) {
      if (day.profit > bestDay.profit) {
        bestDay = { date: day.date, profit: day.profit }
      }
      if (day.profit < worstDay.profit) {
        worstDay = { date: day.date, profit: day.profit }
      }
    }

    // If no data, set to null-ish values
    if (dailyProfit.length === 0) {
      bestDay = { date: '', profit: 0 }
      worstDay = { date: '', profit: 0 }
    }

    return NextResponse.json({
      success: true,
      dailyProfit,
      topItems,
      trend: {
        direction: trendDirection,
        percentChange: Math.round(percentChange * 10) / 10,
        recentAvg,
        olderAvg
      },
      summary: {
        avgProfitPerDay,
        bestDay,
        worstDay,
        totalProfit,
        totalRevenue,
        totalOrders,
        daysWithData,
        charactersQueried: characterTokens.length
      },
      period,
      analyzedAt: new Date().toISOString(),
      config: {
        transportCostPerM3
      }
    })

  } catch (error) {
    console.error('[Trading Velocity] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate trading velocity' },
      { status: 500 }
    )
  }
}

