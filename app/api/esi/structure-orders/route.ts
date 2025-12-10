import { NextRequest, NextResponse } from 'next/server'

const ESI_BASE = 'https://esi.evetech.net'

interface MarketOrder {
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

interface TypeInfo {
  name: string
  description?: string
  group_id?: number
}

/**
 * GET /api/esi/structure-orders
 * 
 * Fetches market orders from a structure and returns the top 5 most expensive items.
 * 
 * Query Parameters:
 *   - structure_id (required): The structure ID to fetch orders from
 *   - page (optional): Page number, defaults to fetching all pages
 *   - buy_orders (optional): If 'true', only return buy orders. If 'false', only sell orders. Default: sell orders only
 *   - all (optional): If 'true', return all orders grouped by type_id instead of top 5
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO (requires esi-markets.structure_markets.v1 scope)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id')
  const includeBuyOrders = searchParams.get('buy_orders') === 'true'
  const returnAllOrders = searchParams.get('all') === 'true'
  
  // Get authorization header
  const authHeader = request.headers.get('authorization')

  if (!structureId) {
    return NextResponse.json(
      { error: 'structure_id is required' },
      { status: 400 }
    )
  }

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authorization header required. Login with EVE SSO first (requires esi-markets.structure_markets.v1 scope).' },
      { status: 401 }
    )
  }

  try {
    // Fetch all market orders from the structure (handle pagination)
    let allOrders: MarketOrder[] = []
    let page = 1
    let totalPages = 1

    do {
      const queryParams = new URLSearchParams({
        page: page.toString(),
      })

      const response = await fetch(
        `${ESI_BASE}/markets/structures/${structureId}/?${queryParams.toString()}`,
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
        return NextResponse.json(
          { error: `ESI Error: ${response.status}`, details: error },
          { status: response.status }
        )
      }

      // Get total pages from headers
      const xPages = response.headers.get('X-Pages')
      if (xPages) {
        totalPages = parseInt(xPages, 10)
      }

      const orders: MarketOrder[] = await response.json()
      allOrders = allOrders.concat(orders)
      page++
    } while (page <= totalPages)

    // Filter orders (by default, only sell orders - is_buy_order = false)
    const filteredOrders = allOrders.filter(order => 
      includeBuyOrders ? order.is_buy_order : !order.is_buy_order
    )

    // If all=true, return orders grouped by type_id with lowest price per type
    if (returnAllOrders) {
      // Group orders by type_id and find lowest sell price for each
      const ordersByType: Record<number, {
        lowestPrice: number
        totalVolume: number
        orderCount: number
        orders: MarketOrder[]
      }> = {}

      for (const order of filteredOrders) {
        if (!ordersByType[order.type_id]) {
          ordersByType[order.type_id] = {
            lowestPrice: order.price,
            totalVolume: order.volume_remain,
            orderCount: 1,
            orders: [order]
          }
        } else {
          const existing = ordersByType[order.type_id]
          if (order.price < existing.lowestPrice) {
            existing.lowestPrice = order.price
          }
          existing.totalVolume += order.volume_remain
          existing.orderCount++
          existing.orders.push(order)
        }
      }

      // Convert to array format
      const typesSummary = Object.entries(ordersByType).map(([typeId, data]) => ({
        type_id: parseInt(typeId),
        lowest_price: data.lowestPrice,
        total_volume: data.totalVolume,
        order_count: data.orderCount
      }))

      return NextResponse.json({
        structure_id: structureId,
        order_type: includeBuyOrders ? 'buy' : 'sell',
        total_orders: filteredOrders.length,
        total_pages_fetched: totalPages,
        unique_types: typesSummary.length,
        orders_by_type: typesSummary
      })
    }

    // Original behavior: return top 5 most expensive
    // Sort by price (descending) to get most expensive first
    const sortedOrders = filteredOrders.sort((a, b) => b.price - a.price)

    // Get top 5 most expensive
    const top5Orders = sortedOrders.slice(0, 5)

    // Fetch type names for the top 5 items
    const typeIds = [...new Set(top5Orders.map(order => order.type_id))]
    const typeNames: Record<number, TypeInfo> = {}

    // Fetch type info for each unique type_id
    await Promise.all(
      typeIds.map(async (typeId) => {
        try {
          const typeResponse = await fetch(
            `${ESI_BASE}/universe/types/${typeId}/`,
            {
              headers: {
                'Accept': 'application/json',
                'X-Compatibility-Date': '2025-11-06',
              },
            }
          )

          if (typeResponse.ok) {
            const typeData = await typeResponse.json()
            typeNames[typeId] = {
              name: typeData.name,
              description: typeData.description,
              group_id: typeData.group_id,
            }
          }
        } catch {
          // Silently fail for type lookups
        }
      })
    )

    // Build the response with enriched data
    const enrichedTop5 = top5Orders.map((order, index) => ({
      rank: index + 1,
      order_id: order.order_id,
      type_id: order.type_id,
      type_name: typeNames[order.type_id]?.name || `Unknown (${order.type_id})`,
      price: order.price,
      price_formatted: formatISK(order.price),
      volume_remain: order.volume_remain,
      volume_total: order.volume_total,
      total_value: order.price * order.volume_remain,
      total_value_formatted: formatISK(order.price * order.volume_remain),
      is_buy_order: order.is_buy_order,
      issued: order.issued,
      duration: order.duration,
      min_volume: order.min_volume,
      range: order.range,
    }))

    return NextResponse.json({
      structure_id: structureId,
      order_type: includeBuyOrders ? 'buy' : 'sell',
      total_orders: filteredOrders.length,
      total_pages_fetched: totalPages,
      top_5_most_expensive: enrichedTop5,
      summary: {
        highest_price: top5Orders[0]?.price || 0,
        highest_price_formatted: formatISK(top5Orders[0]?.price || 0),
        items: enrichedTop5.map(o => o.type_name),
      },
    })

  } catch (error) {
    console.error('Structure orders fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch structure orders' },
      { status: 500 }
    )
  }
}

/**
 * Format ISK value with proper formatting
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

