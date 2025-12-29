import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getCachedMarketSeederStatistics, getCachedJitaPrices } from '@/lib/cached-data'
import {
  DEFAULT_HUB_FACTOR,
  DEFAULT_VOLUME_REGION_ID,
  VOLUME_REGIONS,
  type RegionId
} from '@/types/market-seeder'
import { getValidAccessToken, getSessionWithCharacters } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole, isApprovedRole } from '@/types/auth'

const ESI_BASE = 'https://esi.evetech.net'

interface MarketOrder {
  type_id: number
  price: number
  volume_remain: number
  is_buy_order: boolean
}

interface CharacterOrder {
  type_id: number
  price: number
  volume_remain: number
  is_buy_order: boolean
  location_id: number
  order_id: number
}

interface EssentialItem {
  id: string
  type_id: number
  item_name: string
  group_name: string | null
  category_name: string | null
  volume: number | null
  created_at: string
}

interface EssentialItemWithStock extends EssentialItem {
  stock: number
  lowest_price: number | null
  needs_restock: boolean
  // Depletion metrics
  estimatedDailySales: number
  daysUntilStockout: number | null
  jitaPrice: number | null
  profitPerUnit: number
  dailyProfit: number
  // Sell order status - true if user has a sell order for this item
  hasSellOrder: boolean
}

/**
 * GET /api/essentials
 * 
 * Fetches all essential items (admin-curated nullsec essentials) with current stock levels.
 * 
 * Query Parameters:
 *   - structure_id (optional): Structure ID to check stock levels. If not provided, returns items without stock info.
 *   - volume_region_id (optional): Region ID for volume data (default: Vale of the Silent)
 *   - hub_factor (optional): Hub factor for demand estimation (default: 0.05)
 * 
 * Headers:
 *   - Authorization (optional): Bearer token from EVE SSO. Required if structure_id is provided.
 */
export async function GET(request: NextRequest) {
  // Get session with all characters for sell order checking
  const session = await getSessionWithCharacters(request)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!isApprovedRole(session.user.role)) {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user.id, session.user.role)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id')

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

  try {
    const supabase = createClient()

    // Fetch all essential items from Supabase
    const { data: essentialItems, error } = await supabase
      .from('essential_items')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch essentials', details: error.message },
        { status: 500 }
      )
    }

    // If no structure_id, return items without stock info
    if (!structureId) {
      const itemsWithoutStock: EssentialItemWithStock[] = (essentialItems || []).map(item => ({
        ...item,
        stock: 0,
        lowest_price: null,
        needs_restock: true, // Assume needs restock if we can't check
        estimatedDailySales: 0,
        daysUntilStockout: null,
        jitaPrice: null,
        profitPerUnit: 0,
        dailyProfit: 0,
        hasSellOrder: false,
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

    // Fetch user's character sell orders in parallel with structure orders
    // to determine which items the user already has sell orders for
    const userSellOrderTypeIds = new Set<number>()

    // Fetch all characters' market orders
    for (const character of session.allCharacters) {
      const charAccessToken = await getValidAccessToken(character.character_id)
      if (!charAccessToken) continue

      try {
        const charOrdersResponse = await fetch(
          `${ESI_BASE}/characters/${character.character_id}/orders/`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${charAccessToken}`,
              'X-Compatibility-Date': '2025-11-06',
            },
          }
        )

        if (charOrdersResponse.ok) {
          const orders: CharacterOrder[] = await charOrdersResponse.json()
          // Filter to sell orders in the target structure and add type_ids to set
          for (const order of orders) {
            if (!order.is_buy_order && order.location_id.toString() === structureId) {
              userSellOrderTypeIds.add(order.type_id)
            }
          }
        }
      } catch (err) {
        console.error(`Failed to fetch orders for character ${character.character_id}:`, err)
      }
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

    // Fetch market data for all essential items
    const typeIds = (essentialItems || []).map(item => item.type_id)

    // Fetch regional volumes and Jita prices in parallel
    const [regionData, jitaPrices] = await Promise.all([
      getCachedMarketSeederStatistics(typeIds, 30, volumeRegionId),
      getCachedJitaPrices(typeIds)
    ])

    // Merge stock info and market data with essential items
    const itemsWithStock: EssentialItemWithStock[] = (essentialItems || []).map(item => {
      const stockInfo = stockMap.get(item.type_id)
      const regionStats = regionData.get(item.type_id)
      const jitaPrice = jitaPrices.get(item.type_id)

      const stock = stockInfo?.volume ?? 0
      const lowestPrice = stockInfo?.lowestPrice ?? null

      // Check if user has a sell order for this item
      const hasSellOrder = userSellOrderTypeIds.has(item.type_id)

      // Calculate depletion metrics
      const avgDailyVolume = regionStats?.avgDailyVolume || 0
      const estimatedDailySales = avgDailyVolume * hubFactor

      const daysUntilStockout = stock === 0
        ? 0  // Already out of stock
        : estimatedDailySales > 0
          ? stock / estimatedDailySales
          : null  // Only null when there's truly no sales data

      const jitaBuyPrice = jitaPrice?.lowestSellPrice ?? null
      // Use current sell price if available, otherwise use regional avg price as target
      const targetSellPrice = lowestPrice ?? regionStats?.avgPrice ?? null
      const profitPerUnit = targetSellPrice && jitaBuyPrice
        ? targetSellPrice - jitaBuyPrice
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
        hasSellOrder,
      }
    })

    // Sort: items without sell orders first (need attention), then by urgency
    // Within each group: stock 0 first, then by days until stockout, then alphabetically
    itemsWithStock.sort((a, b) => {
      // Items without sell orders come first (they need attention)
      if (a.hasSellOrder !== b.hasSellOrder) {
        return a.hasSellOrder ? 1 : -1
      }
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
    let criticalCount = 0
    let warningCount = 0
    let okCount = 0
    let noDataCount = 0
    let totalDailyProfit = 0

    for (const item of itemsWithStock) {
      totalDailyProfit += item.dailyProfit

      // If user has a sell order, it's always OK (not critical or warning)
      if (item.hasSellOrder) {
        okCount++
      } else if (item.stock === 0) {
        // Stock 0 and no sell order = critical
        criticalCount++
      } else if (item.daysUntilStockout === null) {
        // No sales data
        noDataCount++
      } else if (item.daysUntilStockout < 3) {
        // Less than 3 days and no sell order = warning
        warningCount++
      } else {
        // 3+ days = OK
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
    console.error('Essentials fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch essentials' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/essentials
 * 
 * Adds an item to the essentials list (admin only).
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
    const session = await getSessionWithCharacters(request)

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user.id, session.user.role)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
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
      .from('essential_items')
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
          { error: 'Item already in essentials' },
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
    console.error('Essentials add error:', error)
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

