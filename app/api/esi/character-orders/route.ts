import { NextRequest, NextResponse } from 'next/server'

const ESI_BASE = 'https://esi.evetech.net'

interface MarketOrder {
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

/**
 * GET /api/esi/character-orders
 * 
 * Fetches character market orders from ESI.
 * 
 * Query Parameters:
 *   - character_id (required): The character ID
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO (requires esi-markets.read_character_orders.v1 scope)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const characterId = searchParams.get('character_id')
  
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
    const response = await fetch(
      `${ESI_BASE}/characters/${characterId}/orders/`,
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

    const orders: MarketOrder[] = await response.json()

    // Calculate statistics
    const buyOrders = orders.filter(o => o.is_buy_order)
    const sellOrders = orders.filter(o => !o.is_buy_order)

    const totalSellValue = sellOrders.reduce((sum, o) => sum + (o.price * o.volume_remain), 0)
    const totalBuyEscrow = buyOrders.reduce((sum, o) => sum + (o.escrow || 0), 0)

    return NextResponse.json({
      character_id: characterId,
      total_orders: orders.length,
      sell_orders: {
        count: sellOrders.length,
        total_value: totalSellValue,
        total_value_formatted: formatISK(totalSellValue),
      },
      buy_orders: {
        count: buyOrders.length,
        total_escrow: totalBuyEscrow,
        total_escrow_formatted: formatISK(totalBuyEscrow),
      },
      orders: orders.map(o => ({
        order_id: o.order_id,
        type_id: o.type_id,
        is_buy_order: o.is_buy_order,
        price: o.price,
        price_formatted: formatISK(o.price),
        volume_remain: o.volume_remain,
        volume_total: o.volume_total,
        location_id: o.location_id,
        issued: o.issued,
        duration: o.duration,
      })),
    })

  } catch (error) {
    console.error('Character orders fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

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

