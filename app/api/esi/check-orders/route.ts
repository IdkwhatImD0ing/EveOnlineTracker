import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole } from '@/types/auth'
import invTypes from '@/data/inv-types.json'

const ESI_BASE = 'https://esi.evetech.net'
const DEFAULT_STRUCTURE_ID = '1051567430261' // 3T7-M8 Keepstar

interface InvType {
  name: string
  groupId: number
  volume: number
}

interface MarketOrder {
  is_buy_order: boolean
  price: number
  type_id: number
  volume_remain: number
}

interface OrderInfo {
  name: string
  type_id: number
  lowest_price: number
  lowest_price_formatted: string
  total_volume: number
}

const typeData = invTypes as Record<string, InvType>

// Build a reverse lookup map: name (lowercase) -> type_id
const nameToTypeId = new Map<string, number>()
for (const [typeId, info] of Object.entries(typeData)) {
  nameToTypeId.set(info.name.toLowerCase(), parseInt(typeId))
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

/**
 * POST /api/esi/check-orders
 * 
 * Checks which items from a list have sell orders in a structure.
 * 
 * Request body:
 *   - structure_id (optional): Structure ID to check (default: 3T7-M8 Keepstar)
 *   - item_names: Array of item names to check
 * 
 * Response:
 *   - with_orders: Items that have sell orders (with price/volume info)
 *   - without_orders: Item names that don't have sell orders
 */
export async function POST(request: NextRequest) {
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

  // Parse request body
  let body: { structure_id?: string; item_names: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { structure_id = DEFAULT_STRUCTURE_ID, item_names } = body

  if (!item_names || !Array.isArray(item_names) || item_names.length === 0) {
    return NextResponse.json(
      { error: 'item_names array is required' },
      { status: 400 }
    )
  }

  // Limit to prevent abuse
  if (item_names.length > 500) {
    return NextResponse.json(
      { error: 'Maximum 500 items allowed per request' },
      { status: 400 }
    )
  }

  // Get token from first available character
  const characterTokens = await getAllCharacterTokens(session.user_id)

  if (characterTokens.length === 0) {
    return NextResponse.json(
      { error: 'No characters with valid tokens found' },
      { status: 400 }
    )
  }

  const accessToken = characterTokens[0].access_token

  try {
    // Fetch all sell orders from the structure
    let allOrders: MarketOrder[] = []
    let page = 1
    let totalPages = 1

    do {
      const response = await fetch(
        `${ESI_BASE}/markets/structures/${structure_id}/?page=${page}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
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

      const xPages = response.headers.get('X-Pages')
      if (xPages) {
        totalPages = parseInt(xPages, 10)
      }

      const orders: MarketOrder[] = await response.json()
      allOrders = allOrders.concat(orders)
      page++
    } while (page <= totalPages)

    // Filter to only sell orders and build a map of type_id -> order info
    const ordersByTypeId = new Map<number, { lowestPrice: number; totalVolume: number }>()

    for (const order of allOrders) {
      if (order.is_buy_order) continue

      const existing = ordersByTypeId.get(order.type_id)
      if (existing) {
        if (order.price < existing.lowestPrice) {
          existing.lowestPrice = order.price
        }
        existing.totalVolume += order.volume_remain
      } else {
        ordersByTypeId.set(order.type_id, {
          lowestPrice: order.price,
          totalVolume: order.volume_remain,
        })
      }
    }

    // Check each item name
    const withOrders: OrderInfo[] = []
    const withoutOrders: string[] = []
    const notFound: string[] = []

    for (const name of item_names) {
      const trimmedName = name.trim()
      if (!trimmedName) continue

      // Look up type_id from name
      const typeId = nameToTypeId.get(trimmedName.toLowerCase())

      if (typeId === undefined) {
        notFound.push(trimmedName)
        continue
      }

      // Check if there are orders for this type
      const orderInfo = ordersByTypeId.get(typeId)

      if (orderInfo) {
        withOrders.push({
          name: trimmedName,
          type_id: typeId,
          lowest_price: orderInfo.lowestPrice,
          lowest_price_formatted: formatISK(orderInfo.lowestPrice),
          total_volume: orderInfo.totalVolume,
        })
      } else {
        withoutOrders.push(trimmedName)
      }
    }

    return NextResponse.json({
      structure_id,
      with_orders: withOrders,
      without_orders: withoutOrders,
      not_found: notFound,
      summary: {
        total_checked: item_names.length,
        with_orders_count: withOrders.length,
        without_orders_count: withoutOrders.length,
        not_found_count: notFound.length,
      },
    })

  } catch (error) {
    console.error('Check orders error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check orders' },
      { status: 500 }
    )
  }
}

