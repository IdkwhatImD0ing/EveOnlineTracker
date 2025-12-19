import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'

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

interface OrderWithCharacter extends MarketOrder {
  character_id: number
  character_name: string
}

/**
 * GET /api/esi/character-orders
 * 
 * Fetches market orders for all characters linked to the authenticated user.
 * Uses session-based authentication.
 * 
 * Returns aggregated order data across all characters.
 */
export async function GET(request: NextRequest) {
  // Get authenticated user from session or Authorization header
  const session = await getAuthenticatedUser(request)
  
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
  const rateLimitResult = await checkRateLimit(session.user_id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  // Get tokens for all characters
  const characterTokens = await getAllCharacterTokens(session.user_id)
  
  if (characterTokens.length === 0) {
    return NextResponse.json(
      { error: 'No characters with valid tokens found' },
      { status: 400 }
    )
  }

  try {
    // Fetch orders for each character
    const orderResults = await Promise.allSettled(
      characterTokens.map(async (token) => {
        const response = await fetch(
          `${ESI_BASE}/characters/${token.character_id}/orders/`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token.access_token}`,
              'X-Compatibility-Date': '2025-11-06',
            },
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch orders for ${token.character_name}`)
        }

        const orders: MarketOrder[] = await response.json()
        return orders.map(order => ({
          ...order,
          character_id: token.character_id,
          character_name: token.character_name,
        }))
      })
    )

    // Aggregate all orders
    const allOrders: OrderWithCharacter[] = []
    let successfulCharacters = 0
    
    for (const result of orderResults) {
      if (result.status === 'fulfilled') {
        allOrders.push(...result.value)
        successfulCharacters++
      }
    }

    // Calculate statistics
    const buyOrders = allOrders.filter(o => o.is_buy_order)
    const sellOrders = allOrders.filter(o => !o.is_buy_order)

    const totalSellValue = sellOrders.reduce((sum, o) => sum + (o.price * o.volume_remain), 0)
    const totalBuyEscrow = buyOrders.reduce((sum, o) => sum + (o.escrow || 0), 0)

    return NextResponse.json({
      characters_queried: characterTokens.length,
      characters_successful: successfulCharacters,
      total_orders: allOrders.length,
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
      orders: allOrders.map(o => ({
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
        character_id: o.character_id,
        character_name: o.character_name,
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
