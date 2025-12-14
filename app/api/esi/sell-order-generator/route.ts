import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { calculateUndercutPrice, formatPriceForEve, formatISK } from '@/lib/market-analysis'
import { getNoCompetitionMarkup } from '@/lib/market-seeder'
import { REGION_IDS, VALE_HUB_FACTOR } from '@/types/market-seeder'

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

function getTypeVolume(typeId: number): number {
  const item = typeData[typeId.toString()]
  return item?.volume || 0.01
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

export interface SellOrderItem {
  type_id: number
  type_name: string
  quantity: number

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
 * Parse JWT to extract character ID
 */
function getCharacterIdFromToken(token: string): number | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('utf-8')
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    return parseInt(payload.sub.split(':')[2])
  } catch {
    return null
  }
}

/**
 * Fetch all pages of assets from ESI
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
 * Fetch Jita prices for given type IDs
 */
async function fetchJitaPrices(typeIds: number[]): Promise<Map<number, number>> {
  return fetchJitaPricesWithProgress(typeIds)
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

/**
 * GET /api/esi/sell-order-generator
 * 
 * Generates optimal sell prices for character assets in 3T7.
 * 
 * Query Parameters:
 *   - structure_id (optional): Structure ID to check (default: 3T7-M8 Keepstar)
 *   - stream (optional): Enable SSE streaming for progress updates
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO
 *     Requires scopes: esi-assets.read_assets.v1, esi-markets.structure_markets.v1
 * 
 * Returns:
 *   - items: Array of SellOrderItem sorted by ISK/day descending
 *   - summary: Counts and totals
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id') || DEFAULT_STRUCTURE_ID
  const useStreaming = searchParams.get('stream') === 'true'

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header required. Requires esi-assets.read_assets.v1 and esi-markets.structure_markets.v1 scopes.' },
      { status: 401 }
    )
  }

  const accessToken = authHeader.replace('Bearer ', '')
  const characterId = getCharacterIdFromToken(accessToken)

  if (!characterId) {
    return NextResponse.json(
      { error: 'Invalid access token - could not extract character ID' },
      { status: 401 }
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
            message: 'Starting sell order analysis...',
            percent: 0
          })

          // Step 1: Fetch all character assets
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'assets',
            message: 'Fetching your assets...',
            percent: 5
          })
          const allAssets = await fetchAllAssets(characterId, accessToken)

          // Filter to assets directly in the target structure's hangar
          const locationId = parseInt(structureId)
          const hangarFlags = new Set([
            'Hangar',
            'CorpSAG1', 'CorpSAG2', 'CorpSAG3', 'CorpSAG4', 'CorpSAG5', 'CorpSAG6', 'CorpSAG7',
            'Deliveries',
          ])

          const assetsByType = new Map<number, number>()
          for (const asset of allAssets) {
            if (asset.location_id !== locationId) continue
            if (!hangarFlags.has(asset.location_flag)) continue
            if (asset.is_blueprint_copy) continue

            const existing = assetsByType.get(asset.type_id) || 0
            assetsByType.set(asset.type_id, existing + asset.quantity)
          }

          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'assets',
            message: `Found ${assetsByType.size} item types in hangar`,
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
              },
              timing: { total_ms: Date.now() - startTime }
            })
            controller.close()
            return
          }

          // Step 2: Fetch character's existing sell orders
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'orders',
            message: 'Checking your existing sell orders...',
            percent: 20
          })

          const charOrdersResponse = await fetch(
            `${ESI_BASE}/characters/${characterId}/orders/`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'X-Compatibility-Date': '2025-11-06',
              },
            }
          )

          if (!charOrdersResponse.ok) {
            throw new Error(`Failed to fetch character orders: ${charOrdersResponse.status}`)
          }

          const charOrders = await charOrdersResponse.json() as Array<{
            is_buy_order: boolean
            location_id: number
            type_id: number
          }>

          const myExistingOrderTypes = new Set<number>()
          for (const order of charOrders) {
            if (!order.is_buy_order && order.location_id.toString() === structureId) {
              myExistingOrderTypes.add(order.type_id)
            }
          }

          // Capture items with existing orders before removing them
          const itemsWithExistingOrders: Array<{ type_id: number; type_name: string; quantity: number }> = []
          for (const typeId of myExistingOrderTypes) {
            const quantity = assetsByType.get(typeId)
            if (quantity !== undefined) {
              itemsWithExistingOrders.push({
                type_id: typeId,
                type_name: getTypeName(typeId),
                quantity
              })
            }
            assetsByType.delete(typeId)
          }

          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'orders',
            message: `Filtered out ${myExistingOrderTypes.size} items with existing orders`,
            percent: 25
          })

          if (assetsByType.size === 0) {
            sendSSEEvent(controller, encoder, 'complete', {
              items: [],
              items_with_existing_orders: itemsWithExistingOrders,
              summary: {
                total_items: 0,
                total_with_competition: 0,
                total_no_competition: 0,
                total_isk_per_day: 0,
                total_isk_per_day_formatted: '0 ISK',
                filtered_out_existing_orders: myExistingOrderTypes.size,
              },
              timing: { total_ms: Date.now() - startTime }
            })
            controller.close()
            return
          }

          // Step 3: Fetch structure orders to check competition
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'structure',
            message: 'Fetching structure market orders...',
            percent: 30
          })

          const structureOrders = await fetchStructureOrders(structureId, accessToken)

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

          const valeVolumes = new Map<number, number>()
          const supabase = createClient()

          const BATCH_SIZE = 200
          for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
            const batch = typeIds.slice(i, i + BATCH_SIZE)
            const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
              p_type_ids: batch,
              p_region_id: REGION_IDS.VALE_OF_SILENT,
              p_days_back: 30
            })

            if (!error && data && Array.isArray(data)) {
              for (const row of data as { type_id: number; avg_daily_volume: number }[]) {
                valeVolumes.set(row.type_id, row.avg_daily_volume || 0)
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

          for (const [typeId, quantity] of assetsByType) {
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

            const valeDailyVolume = valeVolumes.get(typeId) || 0
            const estimatedDailySales = valeDailyVolume * VALE_HUB_FACTOR
            const iskPerDay = estimatedDailySales * sellPrice

            items.push({
              type_id: typeId,
              type_name: getTypeName(typeId),
              quantity,

              has_competition: hasCompetition,
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

          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'complete',
            message: 'Analysis complete!',
            percent: 100
          })

          sendSSEEvent(controller, encoder, 'complete', {
            items,
            items_with_existing_orders: itemsWithExistingOrders,
            summary: {
              total_items: items.length,
              total_with_competition: withCompetition,
              total_no_competition: noCompetition,
              total_isk_per_day: totalIskPerDay,
              total_isk_per_day_formatted: formatISK(totalIskPerDay),
              filtered_out_existing_orders: myExistingOrderTypes.size,
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

    // Step 1: Fetch all character assets
    const allAssets = await fetchAllAssets(characterId, accessToken)

    // Filter to assets directly in the target structure's hangar
    // Only include items with location_flag "Hangar" or "CorpSAG*" (corporation hangars)
    // This excludes items inside ships, containers, cargo holds, etc.
    const locationId = parseInt(structureId)
    const hangarFlags = new Set([
      'Hangar',
      'CorpSAG1', 'CorpSAG2', 'CorpSAG3', 'CorpSAG4', 'CorpSAG5', 'CorpSAG6', 'CorpSAG7',
      'Deliveries', // Items delivered to you
    ])

    // Aggregate assets by type_id (only hangar items, exclude blueprint copies)
    const assetsByType = new Map<number, number>()
    for (const asset of allAssets) {
      // Must be directly in the structure (not inside a ship/container)
      if (asset.location_id !== locationId) continue
      // Must be in a hangar location
      if (!hangarFlags.has(asset.location_flag)) continue
      // Exclude blueprint copies
      if (asset.is_blueprint_copy) continue

      const existing = assetsByType.get(asset.type_id) || 0
      assetsByType.set(asset.type_id, existing + asset.quantity)
    }

    if (assetsByType.size === 0) {
      return NextResponse.json({
        items: [],
        summary: {
          total_items: 0,
          total_with_competition: 0,
          total_no_competition: 0,
          total_isk_per_day: 0,
          total_isk_per_day_formatted: '0 ISK',
          filtered_out_existing_orders: 0,
        },
        timing: { total_ms: Date.now() - startTime }
      })
    }

    // Step 2: Fetch character's existing sell orders in this structure
    const charOrdersResponse = await fetch(
      `${ESI_BASE}/characters/${characterId}/orders/`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'X-Compatibility-Date': '2025-11-06',
        },
      }
    )

    if (!charOrdersResponse.ok) {
      throw new Error(`Failed to fetch character orders: ${charOrdersResponse.status}`)
    }

    const charOrders = await charOrdersResponse.json() as Array<{
      is_buy_order: boolean
      location_id: number
      type_id: number
    }>

    // Get set of type_ids where character already has sell orders in this structure
    const myExistingOrderTypes = new Set<number>()
    for (const order of charOrders) {
      if (!order.is_buy_order && order.location_id.toString() === structureId) {
        myExistingOrderTypes.add(order.type_id)
      }
    }

    // Capture items with existing orders before removing them
    const itemsWithExistingOrders: Array<{ type_id: number; type_name: string; quantity: number }> = []
    for (const typeId of myExistingOrderTypes) {
      const quantity = assetsByType.get(typeId)
      if (quantity !== undefined) {
        itemsWithExistingOrders.push({
          type_id: typeId,
          type_name: getTypeName(typeId),
          quantity
        })
      }
      assetsByType.delete(typeId)
    }

    if (assetsByType.size === 0) {
      return NextResponse.json({
        items: [],
        items_with_existing_orders: itemsWithExistingOrders,
        summary: {
          total_items: 0,
          total_with_competition: 0,
          total_no_competition: 0,
          total_isk_per_day: 0,
          total_isk_per_day_formatted: '0 ISK',
          filtered_out_existing_orders: myExistingOrderTypes.size,
        },
        timing: { total_ms: Date.now() - startTime }
      })
    }

    // Step 3: Fetch structure orders to check competition
    const structureOrders = await fetchStructureOrders(structureId, accessToken)

    // Build map of lowest sell price by type_id
    const lowestPriceByType = new Map<number, number>()
    for (const order of structureOrders) {
      const existing = lowestPriceByType.get(order.type_id)
      if (existing === undefined || order.price < existing) {
        lowestPriceByType.set(order.type_id, order.price)
      }
    }

    // Step 4: Fetch Jita prices for all asset types
    const typeIds = Array.from(assetsByType.keys())
    const jitaPrices = await fetchJitaPrices(typeIds)

    // Step 5: Fetch Vale market data for volume estimates
    const valeVolumes = new Map<number, number>()
    const supabase = createClient()

    // Batch into chunks of 200 for the RPC call
    const BATCH_SIZE = 200
    for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
      const batch = typeIds.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
        p_type_ids: batch,
        p_region_id: REGION_IDS.VALE_OF_SILENT,
        p_days_back: 30
      })

      if (!error && data && Array.isArray(data)) {
        for (const row of data as { type_id: number; avg_daily_volume: number }[]) {
          valeVolumes.set(row.type_id, row.avg_daily_volume || 0)
        }
      }
    }

    // Step 6: Calculate sell prices and metrics for each item
    const items: SellOrderItem[] = []

    for (const [typeId, quantity] of assetsByType) {
      const jitaPrice = jitaPrices.get(typeId)
      if (!jitaPrice) continue // Skip items without Jita price data

      const competitorPrice = lowestPriceByType.get(typeId) || null
      const hasCompetition = competitorPrice !== null

      // Calculate sell price
      let sellPrice: number
      if (hasCompetition) {
        // Undercut by 1 tick
        sellPrice = calculateUndercutPrice(competitorPrice!)
      } else {
        // Use tiered markup formula
        const markup = getNoCompetitionMarkup(jitaPrice)
        sellPrice = jitaPrice * markup
      }

      // Get Vale volume metrics
      const valeDailyVolume = valeVolumes.get(typeId) || 0
      const estimatedDailySales = valeDailyVolume * VALE_HUB_FACTOR
      const iskPerDay = estimatedDailySales * sellPrice

      items.push({
        type_id: typeId,
        type_name: getTypeName(typeId),
        quantity,

        has_competition: hasCompetition,
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

    // Sort by ISK/day descending
    items.sort((a, b) => b.isk_per_day - a.isk_per_day)

    // Calculate summary
    const totalIskPerDay = items.reduce((sum, item) => sum + item.isk_per_day, 0)
    const withCompetition = items.filter(i => i.has_competition).length
    const noCompetition = items.filter(i => !i.has_competition).length

    return NextResponse.json({
      items,
      items_with_existing_orders: itemsWithExistingOrders,
      summary: {
        total_items: items.length,
        total_with_competition: withCompetition,
        total_no_competition: noCompetition,
        total_isk_per_day: totalIskPerDay,
        total_isk_per_day_formatted: formatISK(totalIskPerDay),
        filtered_out_existing_orders: myExistingOrderTypes.size,
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

