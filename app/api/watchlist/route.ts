import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getCachedMarketSeederStatistics, getCachedJitaPrices } from '@/lib/cached-data'
import { REGION_IDS, VALE_HUB_FACTOR } from '@/types/market-seeder'
import { getValidAccessToken, getAuthenticatedUser } from '@/lib/auth'

const ESI_BASE = 'https://esi.evetech.net'

interface MarketOrder {
  type_id: number
  price: number
  volume_remain: number
  is_buy_order: boolean
}

interface WatchlistItem {
  id: string
  type_id: number
  item_name: string
  group_name: string | null
  category_name: string | null
  volume: number | null
  created_at: string
}

interface WatchlistItemWithStock extends WatchlistItem {
  stock: number
  lowest_price: number | null
  needs_restock: boolean
  // Depletion metrics
  estimatedDailySales: number
  daysUntilStockout: number | null
  jitaPrice: number | null
  profitPerUnit: number
  dailyProfit: number
}

/**
 * GET /api/watchlist
 * 
 * Fetches all watchlist items with current stock levels from the structure.
 * 
 * Query Parameters:
 *   - structure_id (optional): Structure ID to check stock levels. If not provided, returns items without stock info.
 * 
 * Headers:
 *   - Authorization (optional): Bearer token from EVE SSO. Required if structure_id is provided.
 */
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!session.user.allowed) {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id')

  try {
    const supabase = createClient()

    // Fetch all watchlist items from Supabase
    const { data: watchlistItems, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch watchlist', details: error.message },
        { status: 500 }
      )
    }

    // If no structure_id, return items without stock info
    if (!structureId) {
      const itemsWithoutStock: WatchlistItemWithStock[] = (watchlistItems || []).map(item => ({
        ...item,
        stock: 0,
        lowest_price: null,
        needs_restock: true, // Assume needs restock if we can't check
        estimatedDailySales: 0,
        daysUntilStockout: null,
        jitaPrice: null,
        profitPerUnit: 0,
        dailyProfit: 0,
      }))

      return NextResponse.json({
        success: true,
        items: itemsWithoutStock,
        structure_id: null,
        checked_at: null,
      })
    }

    // Get access token from session or Authorization header for structure stock check
    const authToken = await getValidAccessToken(undefined, request)
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Login with EVE SSO to check structure stock.' },
        { status: 401 }
      )
    }

    // Fetch structure orders
    const structureOrders = await fetchStructureOrders(structureId, `Bearer ${authToken}`)
    
    if (!structureOrders.success) {
      const errorResult = structureOrders
      return NextResponse.json(
        { error: errorResult.error },
        { status: errorResult.status || 500 }
      )
    }

    // Build a map of type_id -> stock info
    const stockMap = new Map<number, { volume: number; lowestPrice: number }>()
    for (const order of structureOrders.orders) {
      const existing = stockMap.get(order.type_id)
      if (existing) {
        existing.volume += order.volume_remain
        if (order.price < existing.lowestPrice) {
          existing.lowestPrice = order.price
        }
      } else {
        stockMap.set(order.type_id, {
          volume: order.volume_remain,
          lowestPrice: order.price,
        })
      }
    }

    // Fetch market data for all watchlist items
    const typeIds = (watchlistItems || []).map(item => item.type_id)
    
    // Fetch Vale volumes and Jita prices in parallel
    const [valeData, jitaPrices] = await Promise.all([
      getCachedMarketSeederStatistics(typeIds, 30, REGION_IDS.VALE_OF_SILENT),
      getCachedJitaPrices(typeIds)
    ])

    // Merge stock info and market data with watchlist items
    const itemsWithStock: WatchlistItemWithStock[] = (watchlistItems || []).map(item => {
      const stockInfo = stockMap.get(item.type_id)
      const valeStats = valeData.get(item.type_id)
      const jitaPrice = jitaPrices.get(item.type_id)
      
      const stock = stockInfo?.volume ?? 0
      const lowestPrice = stockInfo?.lowestPrice ?? null
      
      // Calculate depletion metrics
      const avgDailyVolume = valeStats?.avgDailyVolume || 0
      const estimatedDailySales = avgDailyVolume * VALE_HUB_FACTOR
      
      const daysUntilStockout = stock === 0 
        ? 0  // Already out of stock
        : estimatedDailySales > 0 
          ? stock / estimatedDailySales
          : null  // Only null when there's truly no sales data
      
      const jitaBuyPrice = jitaPrice?.lowestSellPrice ?? null
      const profitPerUnit = lowestPrice && jitaBuyPrice 
        ? lowestPrice - jitaBuyPrice 
        : 0
      const dailyProfit = estimatedDailySales * Math.max(0, profitPerUnit)
      
      return {
        ...item,
        stock,
        lowest_price: lowestPrice,
        needs_restock: !stockInfo || stockInfo.volume === 0,
        estimatedDailySales,
        daysUntilStockout,
        jitaPrice: jitaBuyPrice,
        profitPerUnit,
        dailyProfit,
      }
    })

    // Sort: stock 0 first (out of stock), then by days until stockout, then alphabetically
    itemsWithStock.sort((a, b) => {
      // Out of stock items come first
      const aOutOfStock = a.stock === 0
      const bOutOfStock = b.stock === 0
      if (aOutOfStock !== bOutOfStock) {
        return aOutOfStock ? -1 : 1
      }
      // Both have stockout data - sort by urgency
      if (a.daysUntilStockout !== null && b.daysUntilStockout !== null) {
        return a.daysUntilStockout - b.daysUntilStockout
      }
      // Items with stockout data come before those without
      if (a.daysUntilStockout !== null) return -1
      if (b.daysUntilStockout !== null) return 1
      return a.item_name.localeCompare(b.item_name)
    })

    // Calculate summary with depletion-style counts
    // Stock 0 = critical (already out of stock)
    let criticalCount = 0
    let warningCount = 0
    let okCount = 0
    let noDataCount = 0
    let totalDailyProfit = 0

    for (const item of itemsWithStock) {
      totalDailyProfit += item.dailyProfit
      
      // Stock 0 is always critical
      if (item.stock === 0) {
        criticalCount++
      } else if (item.daysUntilStockout === null) {
        noDataCount++
      } else if (item.daysUntilStockout < 3) {
        criticalCount++
      } else if (item.daysUntilStockout < 7) {
        warningCount++
      } else {
        okCount++
      }
    }

    return NextResponse.json({
      success: true,
      items: itemsWithStock,
      structure_id: structureId,
      checked_at: new Date().toISOString(),
      summary: {
        total: itemsWithStock.length,
        needs_restock: itemsWithStock.filter(i => i.needs_restock).length,
        in_stock: itemsWithStock.filter(i => !i.needs_restock).length,
        criticalCount,
        warningCount,
        okCount,
        noDataCount,
        totalDailyProfit,
      },
    })

  } catch (error) {
    console.error('Watchlist fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch watchlist' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/watchlist
 * 
 * Adds an item to the watchlist.
 * 
 * Body:
 *   - typeId: number (required)
 *   - itemName: string (required)
 *   - groupName: string (optional)
 *   - categoryName: string (optional)
 *   - volume: number (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser(request)

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!session.user.allowed) {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }

    const body = await request.json()
    const { typeId, itemName, groupName, categoryName, volume } = body

    if (!typeId || !itemName) {
      return NextResponse.json(
        { error: 'typeId and itemName are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Insert the item (will fail if type_id already exists due to UNIQUE constraint)
    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({
        type_id: typeId,
        item_name: itemName,
        group_name: groupName || null,
        category_name: categoryName || null,
        volume: volume || null,
      })
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Item already in watchlist' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to add item', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      item: data,
    })

  } catch (error) {
    console.error('Watchlist add error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add item' },
      { status: 500 }
    )
  }
}

/**
 * Fetch structure orders from ESI
 */
async function fetchStructureOrders(
  structureId: string,
  authHeader: string
): Promise<{ success: true; orders: MarketOrder[] } | { success: false; error: string; status?: number }> {
  try {
    let allOrders: MarketOrder[] = []
    let page = 1
    let totalPages = 1

    do {
      const response = await fetch(
        `${ESI_BASE}/markets/structures/${structureId}/?page=${page}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'X-Compatibility-Date': '2025-11-06',
          },
        }
      )

      if (!response.ok) {
        const error = await response.text()
        return {
          success: false,
          error: `ESI Error: ${response.status} - ${error}`,
          status: response.status,
        }
      }

      const xPages = response.headers.get('X-Pages')
      if (xPages) {
        totalPages = parseInt(xPages, 10)
      }

      const orders: MarketOrder[] = await response.json()
      // Only keep sell orders (is_buy_order = false)
      const sellOrders = orders.filter(o => !o.is_buy_order)
      allOrders = allOrders.concat(sellOrders)
      page++
    } while (page <= totalPages)

    return { success: true, orders: allOrders }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch structure orders',
    }
  }
}

