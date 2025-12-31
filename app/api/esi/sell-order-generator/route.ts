import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { calculateUndercutPrice, formatPriceForEve, formatISK } from '@/lib/market-analysis'
import { getNoCompetitionMarkup } from '@/lib/market-seeder'
import { REGION_IDS, DEFAULT_HUB_FACTOR, DEFAULT_VOLUME_REGION_ID, VOLUME_REGIONS, type RegionId } from '@/types/market-seeder'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole, type CharacterToken } from '@/types/auth'

const ESI_BASE = 'https://esi.evetech.net/latest'
const DEFAULT_STRUCTURE_ID = '1051567430261' // 3T7-M8 Keepstar

// Load inv-types for name lookups
import invTypes from '@/data/inv-types.json'

/**
 * SSE Helper: Send an event to the stream
 */
function sendSSEEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: string,
  data: unknown
) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(encoder.encode(message))
}

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

interface ESIAsset {
  is_blueprint_copy?: boolean
  is_singleton: boolean
  item_id: number
  location_flag: string
  location_id: number
  location_type: string
  quantity: number
  type_id: number
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
  characters: SellOrderItemCharacter[]  // Characters that have this item

  // Pricing
  has_competition: boolean
  jita_price: number
  jita_price_formatted: string
  competitor_price: number | null
  competitor_price_formatted: string | null
  sell_price: number
  sell_price_formatted: string
  sell_price_eve: string  // Copy-pasteable format for EVE

  // Metrics
  vale_daily_volume: number
  estimated_daily_sales: number  // Vale * 0.05
  isk_per_day: number            // estimated_daily_sales * sell_price
  isk_per_day_formatted: string
}

/**
 * Fetch all pages of assets from ESI for a single character
 */
async function fetchAllAssets(
  characterId: number,
  accessToken: string
): Promise<ESIAsset[]> {
  const allAssets: ESIAsset[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `${ESI_BASE}/characters/${characterId}/assets/?page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'X-Compatibility-Date': '2025-11-06',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch assets: ${response.status}`)
    }

    totalPages = parseInt(response.headers.get('X-Pages') || '1')
    const assets: ESIAsset[] = await response.json()
    allAssets.push(...assets)
    page++
  } while (page <= totalPages)

  return allAssets
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
 * Fetch Jita prices with optional progress callback
 */
async function fetchJitaPricesWithProgress(
  typeIds: number[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, number>> {
  const prices = new Map<number, number>()

  // Batch requests to Jita market (region 10000002)
  const BATCH_SIZE = 20
  const REGION_ID = REGION_IDS.THE_FORGE
  const totalBatches = Math.ceil(typeIds.length / BATCH_SIZE)

  for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1
    const batch = typeIds.slice(i, i + BATCH_SIZE)

    if (onProgress) {
      onProgress(batchIndex, totalBatches)
    }

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

// Hangar flags for filtering assets
const HANGAR_FLAGS = new Set([
  'Hangar',
  'CorpSAG1', 'CorpSAG2', 'CorpSAG3', 'CorpSAG4', 'CorpSAG5', 'CorpSAG6', 'CorpSAG7',
  'Deliveries',
])

/**
 * GET /api/esi/sell-order-generator
 * 
 * Generates optimal sell prices for assets from all linked characters in a structure.
 * 
 * Query Parameters:
 *   - structure_id (optional): Structure ID to check (default: 3T7-M8 Keepstar)
 *   - stream (optional): Enable SSE streaming for progress updates
 * 
 * Uses session-based authentication and aggregates assets from all linked characters.
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

  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id') || DEFAULT_STRUCTURE_ID
  const useStreaming = searchParams.get('stream') === 'true'

  // Parse hub factor (accept any positive number, not just presets)
  const hubFactorParam = searchParams.get('hub_factor')
  let hubFactor = DEFAULT_HUB_FACTOR
  if (hubFactorParam) {
    const parsed = parseFloat(hubFactorParam)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
      hubFactor = parsed
    }
  }

  // Parse volume region ID
  const volumeRegionIdParam = searchParams.get('volume_region_id')
  let volumeRegionId: RegionId = DEFAULT_VOLUME_REGION_ID
  if (volumeRegionIdParam) {
    const parsed = parseInt(volumeRegionIdParam)
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

  // Streaming mode
  if (useStreaming) {
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const startTime = Date.now()

          // Progress: Starting
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'starting',
            message: `Starting sell order analysis for ${characterTokens.length} character(s)...`,
            percent: 0
          })

          // Step 1: Fetch assets from all characters
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'assets',
            message: `Fetching assets from ${characterTokens.length} character(s)...`,
            percent: 5
          })

          const locationId = parseInt(structureId)
          const assetsByType = new Map<number, { quantity: number; characters: Map<number, string> }>()

          for (let i = 0; i < characterTokens.length; i++) {
            const token = characterTokens[i]
            try {
              const assets = await fetchAllAssets(token.character_id, token.access_token)

              for (const asset of assets) {
                if (asset.location_id !== locationId) continue
                if (!HANGAR_FLAGS.has(asset.location_flag)) continue
                if (asset.is_blueprint_copy) continue

                const existing = assetsByType.get(asset.type_id)
                if (existing) {
                  existing.quantity += asset.quantity
                  existing.characters.set(token.character_id, token.character_name)
                } else {
                  assetsByType.set(asset.type_id, {
                    quantity: asset.quantity,
                    characters: new Map([[token.character_id, token.character_name]])
                  })
                }
              }

              sendSSEEvent(controller, encoder, 'progress', {
                stage: 'assets',
                message: `Fetched assets from ${token.character_name} (${i + 1}/${characterTokens.length})`,
                percent: 5 + Math.floor(((i + 1) / characterTokens.length) * 10)
              })
            } catch (error) {
              console.error(`Failed to fetch assets for ${token.character_name}:`, error)
            }
          }

          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'assets',
            message: `Found ${assetsByType.size} item types across ${characterTokens.length} character(s)`,
            percent: 15
          })

          if (assetsByType.size === 0) {
            sendSSEEvent(controller, encoder, 'complete', {
              items: [],
              summary: {
                total_items: 0,
                total_with_competition: 0,
                total_no_competition: 0,
                total_isk_per_day: 0,
                total_isk_per_day_formatted: '0 ISK',
                filtered_out_existing_orders: 0,
                characters_queried: characterTokens.length,
              },
              timing: { total_ms: Date.now() - startTime }
            })
            controller.close()
            return
          }

          // Step 2: Fetch existing sell orders from all characters
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'orders',
            message: 'Checking existing sell orders...',
            percent: 20
          })

          // Track which characters have sell orders for each type
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

          // Note: We no longer remove items with existing orders - they're included with pricing info
          // The has_existing_order flag indicates if the user already has a sell order

          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'orders',
            message: `Found ${myExistingOrdersByType.size} items with existing orders (included for reference)`,
            percent: 25
          })

          if (assetsByType.size === 0) {
            sendSSEEvent(controller, encoder, 'complete', {
              items: [],
              items_with_existing_orders: [],
              summary: {
                total_items: 0,
                total_with_competition: 0,
                total_no_competition: 0,
                total_isk_per_day: 0,
                total_isk_per_day_formatted: '0 ISK',
                total_with_existing_orders: 0,
                characters_queried: characterTokens.length,
              },
              timing: { total_ms: Date.now() - startTime }
            })
            controller.close()
            return
          }

          // Step 3: Fetch structure orders to check competition (use first character's token)
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'structure',
            message: 'Fetching structure market orders...',
            percent: 30
          })

          const structureOrders = await fetchStructureOrders(structureId, characterTokens[0].access_token)

          const lowestPriceByType = new Map<number, number>()
          for (const order of structureOrders) {
            const existing = lowestPriceByType.get(order.type_id)
            if (existing === undefined || order.price < existing) {
              lowestPriceByType.set(order.type_id, order.price)
            }
          }

          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'structure',
            message: `Found ${structureOrders.length} structure orders`,
            percent: 40
          })

          // Step 4: Fetch Jita prices
          const typeIds = Array.from(assetsByType.keys())
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'jita',
            message: `Fetching Jita prices for ${typeIds.length} items...`,
            percent: 45
          })

          const jitaPrices = await fetchJitaPricesWithProgress(
            typeIds,
            (current, total) => {
              const percent = 45 + Math.floor((current / total) * 30)
              sendSSEEvent(controller, encoder, 'progress', {
                stage: 'jita',
                message: `Fetching Jita prices... ${current}/${total} batches`,
                percent
              })
            }
          )

          // Step 5: Fetch Vale market data
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'vale',
            message: 'Fetching Vale market volume data...',
            percent: 80
          })

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
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'calculating',
            message: 'Calculating optimal sell prices...',
            percent: 90
          })

          const items: SellOrderItem[] = []

          for (const [typeId, data] of assetsByType) {
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
              quantity: data.quantity,
              characters: Array.from(data.characters.entries()).map(([id, name]) => ({ id, name })),

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

          items.sort((a, b) => b.isk_per_day - a.isk_per_day)

          const totalIskPerDay = items.reduce((sum, item) => sum + item.isk_per_day, 0)
          const withCompetition = items.filter(i => i.has_competition).length
          const noCompetition = items.filter(i => !i.has_competition).length
          const withExistingOrders = items.filter(i => i.has_existing_order).length

          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'complete',
            message: 'Analysis complete!',
            percent: 100
          })

          // Derive items_with_existing_orders for backwards compatibility
          const itemsWithExistingOrders = items
            .filter(item => item.has_existing_order)
            .map(item => ({
              type_id: item.type_id,
              type_name: item.type_name,
              quantity: item.quantity,
              characters: item.characters,
              order_characters: item.order_characters,
            }))

          sendSSEEvent(controller, encoder, 'complete', {
            items,
            items_with_existing_orders: itemsWithExistingOrders,
            summary: {
              total_items: items.length,
              total_with_competition: withCompetition,
              total_no_competition: noCompetition,
              total_isk_per_day: totalIskPerDay,
              total_isk_per_day_formatted: formatISK(totalIskPerDay),
              total_with_existing_orders: withExistingOrders,
              characters_queried: characterTokens.length,
            },
            timing: {
              total_ms: Date.now() - startTime
            }
          })

          controller.close()
        } catch (error) {
          console.error('Sell order generator streaming error:', error)
          sendSSEEvent(controller, encoder, 'error', {
            error: error instanceof Error ? error.message : 'Failed to generate sell orders'
          })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Non-streaming mode
  try {
    const startTime = Date.now()
    const locationId = parseInt(structureId)

    // Step 1: Fetch assets from all characters
    const assetsByType = new Map<number, { quantity: number; characters: Map<number, string> }>()

    for (const token of characterTokens) {
      try {
        const assets = await fetchAllAssets(token.character_id, token.access_token)

        for (const asset of assets) {
          if (asset.location_id !== locationId) continue
          if (!HANGAR_FLAGS.has(asset.location_flag)) continue
          if (asset.is_blueprint_copy) continue

          const existing = assetsByType.get(asset.type_id)
          if (existing) {
            existing.quantity += asset.quantity
            existing.characters.set(token.character_id, token.character_name)
          } else {
            assetsByType.set(asset.type_id, {
              quantity: asset.quantity,
              characters: new Map([[token.character_id, token.character_name]])
            })
          }
        }
      } catch (error) {
        console.error(`Failed to fetch assets for ${token.character_name}:`, error)
      }
    }

    if (assetsByType.size === 0) {
      return NextResponse.json({
        items: [],
        items_with_existing_orders: [],
        summary: {
          total_items: 0,
          total_with_competition: 0,
          total_no_competition: 0,
          total_isk_per_day: 0,
          total_isk_per_day_formatted: '0 ISK',
          total_with_existing_orders: 0,
          characters_queried: characterTokens.length,
        },
        timing: { total_ms: Date.now() - startTime }
      })
    }

    // Step 2: Fetch existing sell orders from all characters
    // Track which characters have sell orders for each type
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

    // Note: We no longer remove items with existing orders - they're included with pricing info
    // The has_existing_order flag indicates if the user already has a sell order

    // Step 3: Fetch structure orders (use first character's token)
    const structureOrders = await fetchStructureOrders(structureId, characterTokens[0].access_token)

    const lowestPriceByType = new Map<number, number>()
    for (const order of structureOrders) {
      const existing = lowestPriceByType.get(order.type_id)
      if (existing === undefined || order.price < existing) {
        lowestPriceByType.set(order.type_id, order.price)
      }
    }

    // Step 4: Fetch Jita prices
    const typeIds = Array.from(assetsByType.keys())
    const jitaPrices = await fetchJitaPricesWithProgress(typeIds)

    // Step 5: Fetch Vale market data
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

    for (const [typeId, data] of assetsByType) {
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
        quantity: data.quantity,
        characters: Array.from(data.characters.entries()).map(([id, name]) => ({ id, name })),

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

    items.sort((a, b) => b.isk_per_day - a.isk_per_day)

    const totalIskPerDay = items.reduce((sum, item) => sum + item.isk_per_day, 0)
    const withCompetition = items.filter(i => i.has_competition).length
    const noCompetition = items.filter(i => !i.has_competition).length
    const withExistingOrders = items.filter(i => i.has_existing_order).length

    // Derive items_with_existing_orders for backwards compatibility
    const itemsWithExistingOrders = items
      .filter(item => item.has_existing_order)
      .map(item => ({
        type_id: item.type_id,
        type_name: item.type_name,
        quantity: item.quantity,
        characters: item.characters,
        order_characters: item.order_characters,
      }))

    return NextResponse.json({
      items,
      items_with_existing_orders: itemsWithExistingOrders,
      summary: {
        total_items: items.length,
        total_with_competition: withCompetition,
        total_no_competition: noCompetition,
        total_isk_per_day: totalIskPerDay,
        total_isk_per_day_formatted: formatISK(totalIskPerDay),
        total_with_existing_orders: withExistingOrders,
        characters_queried: characterTokens.length,
      },
      timing: {
        total_ms: Date.now() - startTime
      }
    })

  } catch (error) {
    console.error('Sell order generator error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate sell orders' },
      { status: 500 }
    )
  }
}
