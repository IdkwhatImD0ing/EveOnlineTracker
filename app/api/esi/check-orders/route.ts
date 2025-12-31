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

interface CharacterOrder {
  is_buy_order: boolean
  price: number
  type_id: number
  volume_remain: number
  location_id: number
  character_id: number
  character_name: string
}

interface CharacterInfo {
  id: number
  name: string
}

interface OrderInfo {
  name: string
  type_id: number
  lowest_price: number
  lowest_price_formatted: string
  total_volume: number
  characters: CharacterInfo[]
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
 * Checks which items from a list the user has sell orders for.
 * Only checks the user's own characters' orders, not other sellers.
 * 
 * Request body:
 *   - structure_id (optional): Structure ID to filter orders by (default: 3T7-M8 Keepstar)
 *   - item_names: Array of item names to check
 * 
 * Response:
 *   - with_orders: Items that the user has sell orders for (with price/volume info)
 *   - without_orders: Item names that the user doesn't have sell orders for
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
  const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
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

  try {
    // Fetch orders for all linked characters
    const allUserOrders: CharacterOrder[] = []

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

        const orders: Omit<CharacterOrder, 'character_id' | 'character_name'>[] = await response.json()
        // Add character info to each order
        return orders.map(order => ({
          ...order,
          character_id: token.character_id,
          character_name: token.character_name,
        }))
      })
    )

    // Aggregate orders from all characters
    for (const result of orderResults) {
      if (result.status === 'fulfilled') {
        allUserOrders.push(...result.value)
      }
    }

    // Filter to only sell orders in the specified structure and build a map of type_id -> order info
    const ordersByTypeId = new Map<number, { lowestPrice: number; totalVolume: number; characters: Map<number, string> }>()
    const structureIdNum = parseInt(structure_id, 10)

    for (const order of allUserOrders) {
      // Skip buy orders
      if (order.is_buy_order) continue
      
      // Filter by structure if specified
      if (order.location_id !== structureIdNum) continue

      const existing = ordersByTypeId.get(order.type_id)
      if (existing) {
        if (order.price < existing.lowestPrice) {
          existing.lowestPrice = order.price
        }
        existing.totalVolume += order.volume_remain
        existing.characters.set(order.character_id, order.character_name)
      } else {
        const characters = new Map<number, string>()
        characters.set(order.character_id, order.character_name)
        ordersByTypeId.set(order.type_id, {
          lowestPrice: order.price,
          totalVolume: order.volume_remain,
          characters,
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
        // Convert character map to array
        const characters: CharacterInfo[] = Array.from(orderInfo.characters.entries()).map(
          ([id, name]) => ({ id, name })
        )
        withOrders.push({
          name: trimmedName,
          type_id: typeId,
          lowest_price: orderInfo.lowestPrice,
          lowest_price_formatted: formatISK(orderInfo.lowestPrice),
          total_volume: orderInfo.totalVolume,
          characters,
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

