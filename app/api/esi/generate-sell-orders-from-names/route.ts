import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { calculateUndercutPrice, formatPriceForEve, formatISK } from '@/lib/market-analysis'
import { getNoCompetitionMarkup } from '@/lib/market-seeder'
import { REGION_IDS, DEFAULT_HUB_FACTOR, DEFAULT_VOLUME_REGION_ID, VOLUME_REGIONS, type RegionId } from '@/types/market-seeder'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole } from '@/types/auth'

const ESI_BASE = 'https://esi.evetech.net/latest'
const DEFAULT_STRUCTURE_ID = '1051567430261' // 3T7-M8 Keepstar

// Load inv-types for name lookups
import invTypes from '@/data/inv-types.json'

interface InvType {
  name: string
  groupId: number
  volume: number
}

const typeData = invTypes as Record<string, InvType>

// Build a reverse lookup map: name (lowercase) -> type_id
const nameToTypeId = new Map<string, number>()
for (const [typeId, info] of Object.entries(typeData)) {
  nameToTypeId.set(info.name.toLowerCase(), parseInt(typeId))
}

function getTypeName(typeId: number): string {
  const item = typeData[typeId.toString()]
  return item?.name || `Unknown (${typeId})`
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

export interface SellOrderItemCharacter {
  id: number
  name: string
}

export interface SellOrderItem {
  type_id: number
  type_name: string
  quantity: number
  characters: SellOrderItemCharacter[]

  // Pricing
  has_competition: boolean
  has_existing_order: boolean
  order_characters: SellOrderItemCharacter[]
  jita_price: number
  jita_price_formatted: string
  competitor_price: number | null
  competitor_price_formatted: string | null
  sell_price: number
  sell_price_formatted: string
  sell_price_eve: string  // Copy-pasteable format for EVE

  // Metrics
  vale_daily_volume: number
  estimated_daily_sales: number
  isk_per_day: number
  isk_per_day_formatted: string
}

/**
 * Fetch all structure sell orders
 */
async function fetchStructureOrders(
  structureId: string,
  accessToken: string
): Promise<StructureOrder[]> {
  const allOrders: StructureOrder[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `${ESI_BASE}/markets/structures/${structureId}/?page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'X-Compatibility-Date': '2025-11-06',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch structure orders: ${response.status}`)
    }

    totalPages = parseInt(response.headers.get('X-Pages') || '1')
    const orders: StructureOrder[] = await response.json()
    allOrders.push(...orders)
    page++
  } while (page <= totalPages)

  return allOrders.filter(o => !o.is_buy_order) // Only sell orders
}

/**
 * Fetch character's market orders
 */
async function fetchCharacterOrders(
  characterId: number,
  accessToken: string
): Promise<Array<{ is_buy_order: boolean; location_id: number; type_id: number }>> {
  const response = await fetch(
    `${ESI_BASE}/characters/${characterId}/orders/`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'X-Compatibility-Date': '2025-11-06',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch character orders: ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch Jita prices for specific type IDs
 */
async function fetchJitaPrices(
  typeIds: number[]
): Promise<Map<number, number>> {
  const prices = new Map<number, number>()

  // Batch requests to Jita market (region 10000002)
  const BATCH_SIZE = 20
  const REGION_ID = REGION_IDS.THE_FORGE

  for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
    const batch = typeIds.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (typeId) => {
      try {
        const response = await fetch(
          `https://esi.evetech.net/latest/markets/${REGION_ID}/orders/?order_type=sell&type_id=${typeId}`,
          { headers: { 'Accept': 'application/json' } }
        )

        if (!response.ok) return { typeId, price: null }

        const orders = await response.json()
        if (orders.length === 0) return { typeId, price: null }

        // Find lowest sell price
        const lowestPrice = Math.min(...orders.map((o: { price: number }) => o.price))
        return { typeId, price: lowestPrice }
      } catch {
        return { typeId, price: null }
      }
    })

    const results = await Promise.all(promises)
    for (const { typeId, price } of results) {
      if (price !== null) {
        prices.set(typeId, price)
      }
    }
  }

  return prices
}

/**
 * POST /api/esi/generate-sell-orders-from-names
 * 
 * Generates optimal sell prices for items specified by name.
 * This is similar to the sell-order-generator but works with a list of item names
 * instead of fetching from character inventory.
 * 
 * Request body:
 *   - structure_id (optional): Structure ID (default: 3T7-M8 Keepstar)
 *   - item_names: Array of item names to generate sell orders for
 *   - hub_factor (optional): Hub factor for volume estimation (default: 0.05)
 *   - volume_region_id (optional): Region ID for volume data (default: Vale)
 * 
 * Response:
 *   - items: Array of SellOrderItem with pricing data
 *   - not_found: Item names that couldn't be matched
 *   - summary: Stats about the generation
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
  let body: {
    structure_id?: string
    item_names: string[]
    hub_factor?: number
    volume_region_id?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { item_names } = body
  const structureId = body.structure_id || DEFAULT_STRUCTURE_ID

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

  // Parse hub factor
  let hubFactor = DEFAULT_HUB_FACTOR
  if (body.hub_factor && typeof body.hub_factor === 'number' && body.hub_factor > 0 && body.hub_factor <= 1) {
    hubFactor = body.hub_factor
  }

  // Parse volume region ID
  let volumeRegionId: RegionId = DEFAULT_VOLUME_REGION_ID
  if (body.volume_region_id) {
    const parsed = body.volume_region_id
    if (VOLUME_REGIONS.some(r => r.id === parsed)) {
      volumeRegionId = parsed as RegionId
    }
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
    const startTime = Date.now()

    // Step 1: Look up type IDs from item names
    const typeIdsByName = new Map<number, string>()
    const notFound: string[] = []

    for (const name of item_names) {
      const trimmedName = name.trim()
      if (!trimmedName) continue

      const typeId = nameToTypeId.get(trimmedName.toLowerCase())
      if (typeId !== undefined) {
        typeIdsByName.set(typeId, trimmedName)
      } else {
        notFound.push(trimmedName)
      }
    }

    const typeIds = Array.from(typeIdsByName.keys())

    if (typeIds.length === 0) {
      return NextResponse.json({
        items: [],
        not_found: notFound,
        summary: {
          total_items: 0,
          total_with_competition: 0,
          total_no_competition: 0,
          total_isk_per_day: 0,
          total_isk_per_day_formatted: '0 ISK',
          total_with_existing_orders: 0,
        },
        timing: { total_ms: Date.now() - startTime }
      })
    }

    // Step 2: Fetch existing sell orders from all characters
    const myExistingOrdersByType = new Map<number, Map<number, string>>()
    for (const token of characterTokens) {
      try {
        const orders = await fetchCharacterOrders(token.character_id, token.access_token)
        for (const order of orders) {
          if (!order.is_buy_order && order.location_id.toString() === structureId) {
            const existing = myExistingOrdersByType.get(order.type_id)
            if (existing) {
              existing.set(token.character_id, token.character_name)
            } else {
              myExistingOrdersByType.set(order.type_id, new Map([[token.character_id, token.character_name]]))
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fetch orders for ${token.character_name}:`, error)
      }
    }

    // Step 3: Fetch structure orders to check competition
    const structureOrders = await fetchStructureOrders(structureId, characterTokens[0].access_token)

    const lowestPriceByType = new Map<number, number>()
    for (const order of structureOrders) {
      if (typeIds.includes(order.type_id)) {
        const existing = lowestPriceByType.get(order.type_id)
        if (existing === undefined || order.price < existing) {
          lowestPriceByType.set(order.type_id, order.price)
        }
      }
    }

    // Step 4: Fetch Jita prices
    const jitaPrices = await fetchJitaPrices(typeIds)

    // Step 5: Fetch regional volume data
    const regionVolumes = new Map<number, number>()
    const supabase = createClient()

    const BATCH_SIZE = 200
    for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
      const batch = typeIds.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
        p_type_ids: batch,
        p_region_id: volumeRegionId,
        p_days_back: 30
      })

      if (!error && data && Array.isArray(data)) {
        for (const row of data as { type_id: number; avg_daily_volume: number }[]) {
          regionVolumes.set(row.type_id, row.avg_daily_volume || 0)
        }
      }
    }

    // Step 6: Calculate sell prices
    const items: SellOrderItem[] = []

    for (const typeId of typeIds) {
      const jitaPrice = jitaPrices.get(typeId)
      if (!jitaPrice) continue

      const competitorPrice = lowestPriceByType.get(typeId) || null
      const hasCompetition = competitorPrice !== null

      let sellPrice: number
      if (hasCompetition) {
        sellPrice = calculateUndercutPrice(competitorPrice!)
      } else {
        const markup = getNoCompetitionMarkup(jitaPrice)
        sellPrice = jitaPrice * markup
      }

      const valeDailyVolume = regionVolumes.get(typeId) || 0
      const estimatedDailySales = valeDailyVolume * hubFactor
      const profitPerUnit = sellPrice - jitaPrice
      const iskPerDay = estimatedDailySales * profitPerUnit

      // Check if this item has existing sell orders
      const orderCharactersMap = myExistingOrdersByType.get(typeId)
      const hasExistingOrder = orderCharactersMap !== undefined
      const orderCharacters = orderCharactersMap 
        ? Array.from(orderCharactersMap.entries()).map(([id, name]) => ({ id, name }))
        : []

      items.push({
        type_id: typeId,
        type_name: getTypeName(typeId),
        quantity: 0,  // Not from inventory, so no quantity
        characters: [],  // Not from inventory

        has_competition: hasCompetition,
        has_existing_order: hasExistingOrder,
        order_characters: orderCharacters,
        jita_price: jitaPrice,
        jita_price_formatted: formatISK(jitaPrice),
        competitor_price: competitorPrice,
        competitor_price_formatted: competitorPrice ? formatISK(competitorPrice) : null,
        sell_price: sellPrice,
        sell_price_formatted: formatISK(sellPrice),
        sell_price_eve: formatPriceForEve(sellPrice),

        vale_daily_volume: valeDailyVolume,
        estimated_daily_sales: estimatedDailySales,
        isk_per_day: iskPerDay,
        isk_per_day_formatted: formatISK(iskPerDay),
      })
    }

    // Sort by ISK/day (highest first)
    items.sort((a, b) => b.isk_per_day - a.isk_per_day)

    const totalIskPerDay = items.reduce((sum, item) => sum + item.isk_per_day, 0)
    const withCompetition = items.filter(i => i.has_competition).length
    const noCompetition = items.filter(i => !i.has_competition).length
    const withExistingOrders = items.filter(i => i.has_existing_order).length

    return NextResponse.json({
      items,
      not_found: notFound,
      summary: {
        total_items: items.length,
        total_with_competition: withCompetition,
        total_no_competition: noCompetition,
        total_isk_per_day: totalIskPerDay,
        total_isk_per_day_formatted: formatISK(totalIskPerDay),
        total_with_existing_orders: withExistingOrders,
      },
      timing: {
        total_ms: Date.now() - startTime
      }
    })

  } catch (error) {
    console.error('Generate sell orders from names error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate sell orders' },
      { status: 500 }
    )
  }
}

