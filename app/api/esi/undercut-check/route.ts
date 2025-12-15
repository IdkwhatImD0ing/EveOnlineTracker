import { NextRequest, NextResponse } from 'next/server'
import { calculateUndercutPrice, formatPriceForEve, formatISK, calculateTickSize } from '@/lib/market-analysis'
import { createClient } from '@/utils/supabase/server'
import { REGION_IDS, VALE_HUB_FACTOR } from '@/types/market-seeder'

const ESI_BASE = 'https://esi.evetech.net'

interface CharacterOrder {
  duration: number
  escrow?: number
  is_buy_order: boolean
  is_corporation: boolean
  issued: string
  location_id: number
  min_volume: number
  order_id: number
  price: number
  range: string
  region_id: number
  type_id: number
  volume_remain: number
  volume_total: number
}

interface StructureOrder {
  duration: number
  is_buy_order: boolean
  issued: string
  location_id: number
  min_volume: number
  order_id: number
  price: number
  range: string
  type_id: number
  volume_remain: number
  volume_total: number
}

interface UndercutItem {
  type_id: number
  type_name: string
  your_order_id: number
  your_price: number
  your_price_formatted: string
  your_volume_remain: number
  competitor_price: number
  competitor_price_formatted: string
  competitor_order_id: number
  undercut_price: number
  undercut_price_formatted: string
  undercut_price_eve: string  // Copy-pasteable format for EVE
  price_difference: number
  price_difference_formatted: string
  tick_size: number
  // Days to lowest calculation
  competitors_below_count: number
  competitors_below_volume: number
  vale_daily_volume: number
  estimated_daily_sales: number
  days_to_lowest: number | null  // null if no sales data
}

interface SafeItem {
  type_id: number
  type_name: string
  your_order_id: number
  your_price: number
  your_price_formatted: string
  your_volume_remain: number
  next_competitor_price: number | null
  next_competitor_price_formatted: string | null
}

// Load inv-types for name lookups
import invTypes from '@/data/inv-types.json'

interface InvType {
  name: string
  groupId: number
  volume: number
}

const typeData = invTypes as Record<string, InvType>

function getTypeName(typeId: number): string {
  const item = typeData[typeId.toString()]
  return item?.name || `Unknown (${typeId})`
}

/**
 * GET /api/esi/undercut-check
 * 
 * Checks for competitors undercutting your sell orders in a structure.
 * 
 * Query Parameters:
 *   - character_id (required): Your character ID
 *   - structure_id (optional): The structure ID to check (default: 3T7-M8 Keepstar)
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO
 *     Requires scopes: esi-markets.read_character_orders.v1, esi-markets.structure_markets.v1
 * 
 * Returns:
 *   - undercut_items: Items where competitors have lower prices than yours
 *   - safe_items: Items where you have the lowest price
 *   - summary: Counts and statistics
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const characterId = searchParams.get('character_id')
  const structureId = searchParams.get('structure_id') || '1051567430261' // Default to 3T7-M8 Keepstar
  
  const authHeader = request.headers.get('authorization')

  if (!characterId) {
    return NextResponse.json(
      { error: 'character_id is required' },
      { status: 400 }
    )
  }

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authorization header required. Requires esi-markets.read_character_orders.v1 and esi-markets.structure_markets.v1 scopes.' },
      { status: 401 }
    )
  }

  try {
    const startTime = Date.now()

    // Step 1: Fetch character's market orders
    const charOrdersResponse = await fetch(
      `${ESI_BASE}/characters/${characterId}/orders/`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'X-Compatibility-Date': '2025-11-06',
        },
      }
    )

    if (!charOrdersResponse.ok) {
      const error = await charOrdersResponse.text()
      return NextResponse.json(
        { error: `Failed to fetch character orders: ${charOrdersResponse.status}`, details: error },
        { status: charOrdersResponse.status }
      )
    }

    const allCharOrders: CharacterOrder[] = await charOrdersResponse.json()

    // Step 2: Filter to sell orders in the target structure
    const myStructureOrders = allCharOrders.filter(
      order => !order.is_buy_order && order.location_id.toString() === structureId
    )

    if (myStructureOrders.length === 0) {
      return NextResponse.json({
        undercut_items: [],
        safe_items: [],
        summary: {
          undercut_count: 0,
          safe_count: 0,
          total_orders_in_structure: 0,
          structure_id: structureId,
        },
        timing: { total_ms: Date.now() - startTime }
      })
    }

    // Step 3: Fetch all structure orders (handle pagination)
    let allStructureOrders: StructureOrder[] = []
    let page = 1
    let totalPages = 1

    do {
      const structResponse = await fetch(
        `${ESI_BASE}/markets/structures/${structureId}/?page=${page}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'X-Compatibility-Date': '2025-11-06',
          },
        }
      )

      if (!structResponse.ok) {
        const error = await structResponse.text()
        return NextResponse.json(
          { error: `Failed to fetch structure orders: ${structResponse.status}`, details: error },
          { status: structResponse.status }
        )
      }

      const xPages = structResponse.headers.get('X-Pages')
      if (xPages) {
        totalPages = parseInt(xPages, 10)
      }

      const orders: StructureOrder[] = await structResponse.json()
      allStructureOrders = allStructureOrders.concat(orders)
      page++
    } while (page <= totalPages)

    // Filter to only sell orders
    const structureSellOrders = allStructureOrders.filter(o => !o.is_buy_order)

    // Step 4: Build lookup of structure orders by type_id
    // For each type, track all orders so we can find competitors
    const ordersByType: Record<number, StructureOrder[]> = {}
    for (const order of structureSellOrders) {
      if (!ordersByType[order.type_id]) {
        ordersByType[order.type_id] = []
      }
      ordersByType[order.type_id].push(order)
    }

    // Step 5: Compare your orders with structure orders - first pass to identify undercut items
    interface PreliminaryUndercut {
      type_id: number
      type_name: string
      your_order_id: number
      your_price: number
      your_volume_remain: number
      competitor_price: number
      competitor_order_id: number
      // Competitors with lower prices
      competitors_below_count: number
      competitors_below_volume: number
    }
    
    const preliminaryUndercuts: PreliminaryUndercut[] = []
    const safeItems: SafeItem[] = []

    // Get set of your order IDs for exclusion
    const myOrderIds = new Set(myStructureOrders.map(o => o.order_id))

    for (const myOrder of myStructureOrders) {
      const typeOrders = ordersByType[myOrder.type_id] || []
      
      // Get competitor orders (not yours) sorted by price
      const competitorOrders = typeOrders
        .filter(o => !myOrderIds.has(o.order_id))
        .sort((a, b) => a.price - b.price)

      const typeName = getTypeName(myOrder.type_id)

      if (competitorOrders.length === 0) {
        // No competitors - you're the only one selling
        safeItems.push({
          type_id: myOrder.type_id,
          type_name: typeName,
          your_order_id: myOrder.order_id,
          your_price: myOrder.price,
          your_price_formatted: formatISK(myOrder.price),
          your_volume_remain: myOrder.volume_remain,
          next_competitor_price: null,
          next_competitor_price_formatted: null,
        })
      } else {
        const lowestCompetitor = competitorOrders[0]
        
        if (lowestCompetitor.price < myOrder.price) {
          // You're being undercut!
          // Calculate competitors below you and their total volume
          const competitorsBelowMe = competitorOrders.filter(o => o.price < myOrder.price)
          const competitorsBelowVolume = competitorsBelowMe.reduce((sum, o) => sum + o.volume_remain, 0)
          
          preliminaryUndercuts.push({
            type_id: myOrder.type_id,
            type_name: typeName,
            your_order_id: myOrder.order_id,
            your_price: myOrder.price,
            your_volume_remain: myOrder.volume_remain,
            competitor_price: lowestCompetitor.price,
            competitor_order_id: lowestCompetitor.order_id,
            competitors_below_count: competitorsBelowMe.length,
            competitors_below_volume: competitorsBelowVolume,
          })
        } else {
          // You have the lowest price (or equal)
          safeItems.push({
            type_id: myOrder.type_id,
            type_name: typeName,
            your_order_id: myOrder.order_id,
            your_price: myOrder.price,
            your_price_formatted: formatISK(myOrder.price),
            your_volume_remain: myOrder.volume_remain,
            next_competitor_price: lowestCompetitor.price,
            next_competitor_price_formatted: formatISK(lowestCompetitor.price),
          })
        }
      }
    }

    // Step 6: Fetch Vale market data for undercut items
    const undercutTypeIds = [...new Set(preliminaryUndercuts.map(u => u.type_id))]
    const valeVolumes = new Map<number, number>()
    
    if (undercutTypeIds.length > 0) {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
        p_type_ids: undercutTypeIds,
        p_region_id: REGION_IDS.VALE_OF_SILENT,
        p_days_back: 30
      })

      if (!error && data && Array.isArray(data)) {
        for (const row of data as { type_id: number; avg_daily_volume: number }[]) {
          valeVolumes.set(row.type_id, row.avg_daily_volume || 0)
        }
      }
    }

    // Step 7: Build final undercut items with days_to_lowest
    const undercutItems: UndercutItem[] = preliminaryUndercuts.map(prelim => {
      const valeDailyVolume = valeVolumes.get(prelim.type_id) || 0
      const estimatedDailySales = valeDailyVolume * VALE_HUB_FACTOR
      const daysToLowest = estimatedDailySales > 0 
        ? prelim.competitors_below_volume / estimatedDailySales 
        : null
      
      const undercutPrice = calculateUndercutPrice(prelim.competitor_price)
      const priceDiff = prelim.your_price - prelim.competitor_price
      
      return {
        type_id: prelim.type_id,
        type_name: prelim.type_name,
        your_order_id: prelim.your_order_id,
        your_price: prelim.your_price,
        your_price_formatted: formatISK(prelim.your_price),
        your_volume_remain: prelim.your_volume_remain,
        competitor_price: prelim.competitor_price,
        competitor_price_formatted: formatISK(prelim.competitor_price),
        competitor_order_id: prelim.competitor_order_id,
        undercut_price: undercutPrice,
        undercut_price_formatted: formatISK(undercutPrice),
        undercut_price_eve: formatPriceForEve(undercutPrice),
        price_difference: priceDiff,
        price_difference_formatted: formatISK(priceDiff),
        tick_size: calculateTickSize(prelim.competitor_price),
        competitors_below_count: prelim.competitors_below_count,
        competitors_below_volume: prelim.competitors_below_volume,
        vale_daily_volume: valeDailyVolume,
        estimated_daily_sales: estimatedDailySales,
        days_to_lowest: daysToLowest,
      }
    })

    // Sort undercut items by days_to_lowest (longest first, null at the end)
    undercutItems.sort((a, b) => {
      if (a.days_to_lowest === null && b.days_to_lowest === null) return 0
      if (a.days_to_lowest === null) return 1
      if (b.days_to_lowest === null) return -1
      return b.days_to_lowest - a.days_to_lowest
    })

    // Sort safe items by volume remaining (most first)
    safeItems.sort((a, b) => b.your_volume_remain - a.your_volume_remain)

    return NextResponse.json({
      undercut_items: undercutItems,
      safe_items: safeItems,
      summary: {
        undercut_count: undercutItems.length,
        safe_count: safeItems.length,
        total_orders_in_structure: myStructureOrders.length,
        structure_id: structureId,
        total_structure_orders: structureSellOrders.length,
      },
      timing: {
        total_ms: Date.now() - startTime
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Undercut check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check undercuts' },
      { status: 500 }
    )
  }
}

