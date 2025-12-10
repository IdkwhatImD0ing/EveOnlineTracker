import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id')
  const authHeader = request.headers.get('authorization')

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
      }))

      return NextResponse.json({
        success: true,
        items: itemsWithoutStock,
        structure_id: null,
        checked_at: null,
      })
    }

    // Check stock levels from structure
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required to check structure stock' },
        { status: 401 }
      )
    }

    // Fetch structure orders
    const structureOrders = await fetchStructureOrders(structureId, authHeader)
    
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

    // Merge stock info with watchlist items
    const itemsWithStock: WatchlistItemWithStock[] = (watchlistItems || []).map(item => {
      const stockInfo = stockMap.get(item.type_id)
      return {
        ...item,
        stock: stockInfo?.volume ?? 0,
        lowest_price: stockInfo?.lowestPrice ?? null,
        needs_restock: !stockInfo || stockInfo.volume === 0,
      }
    })

    // Sort: items needing restock first, then alphabetically
    itemsWithStock.sort((a, b) => {
      if (a.needs_restock !== b.needs_restock) {
        return a.needs_restock ? -1 : 1
      }
      return a.item_name.localeCompare(b.item_name)
    })

    return NextResponse.json({
      success: true,
      items: itemsWithStock,
      structure_id: structureId,
      checked_at: new Date().toISOString(),
      summary: {
        total: itemsWithStock.length,
        needs_restock: itemsWithStock.filter(i => i.needs_restock).length,
        in_stock: itemsWithStock.filter(i => !i.needs_restock).length,
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

