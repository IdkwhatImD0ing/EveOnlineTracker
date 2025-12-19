/**
 * Stock Depletion Predictor API with SSE Progress
 * 
 * Analyzes all sell orders in a structure to predict when stock will deplete.
 * Returns Server-Sent Events with progress updates during analysis.
 * 
 * GET /api/market-seeder/depletion
 * 
 * Query Parameters:
 *   - structure_id (required): Target structure ID
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCachedMarketSeederStatistics, getCachedJitaPrices } from '@/lib/cached-data'
import { 
  REGION_IDS, 
  DEFAULT_HUB_FACTOR,
  type TradeableItem,
  type RegionId,
  DEFAULT_VOLUME_REGION_ID,
  VOLUME_REGIONS,
} from '@/types/market-seeder'
import { getValidAccessToken, getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const ESI_BASE = 'https://esi.evetech.net'

interface DepletionPrediction {
  typeId: number
  name: string
  categoryName: string | null
  groupName: string | null
  currentStock: number
  lowestPrice: number | null
  jitaDailyVolume: number
  estimatedDailySales: number
  daysUntilStockout: number | null
  jitaBuyPrice: number
  profitPerUnit: number
  dailyProfitPotential: number
  priorityScore: number
  userHasInInventory: boolean
  userHasSellOrder: boolean
  hasCompetition: boolean
}

// Valid hangar location flags for assets
const HANGAR_FLAGS = new Set([
  'Hangar', 'HangarAll',
  'CorpSAG1', 'CorpSAG2', 'CorpSAG3', 'CorpSAG4', 'CorpSAG5', 'CorpSAG6', 'CorpSAG7',
  'Deliveries',
])

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

interface ESICharacterOrder {
  is_buy_order: boolean
  location_id: number
  type_id: number
  volume_remain: number
}

/**
 * Fetch all assets for a character (handles pagination)
 */
async function fetchCharacterAssets(
  characterId: number,
  accessToken: string
): Promise<ESIAsset[]> {
  const allAssets: ESIAsset[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `${ESI_BASE}/latest/characters/${characterId}/assets/?page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) break

    const assets: ESIAsset[] = await response.json()
    allAssets.push(...assets)

    const pagesHeader = response.headers.get('x-pages')
    totalPages = pagesHeader ? parseInt(pagesHeader) : 1
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
): Promise<ESICharacterOrder[]> {
  const response = await fetch(
    `${ESI_BASE}/latest/characters/${characterId}/orders/`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  )

  if (!response.ok) return []

  return response.json()
}

interface DepletionResponse {
  success: boolean
  structureId: string
  analyzedAt: string
  summary: {
    totalItems: number
    criticalCount: number
    warningCount: number
    okCount: number
    noDataCount: number
    totalDailyProfit: number
  }
  predictions: DepletionPrediction[]
}

// Cache for tradeable items
let tradeableItemsCache: Map<number, TradeableItem> | null = null

async function loadTradeableItemsMap(): Promise<Map<number, TradeableItem>> {
  if (tradeableItemsCache) {
    return tradeableItemsCache
  }

  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  const itemsMap = new Map<number, TradeableItem>()

  if (!fs.existsSync(filePath)) {
    return itemsMap
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const item = JSON.parse(line) as TradeableItem
        itemsMap.set(item.typeId, item)
      } catch {
        // Skip invalid lines
      }
    }
  }

  tradeableItemsCache = itemsMap
  return itemsMap
}

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

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!session.user.allowed) {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id')

  if (!structureId) {
    return NextResponse.json(
      { error: 'structure_id is required' },
      { status: 400 }
    )
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
  const regionName = VOLUME_REGIONS.find(r => r.id === volumeRegionId)?.name ?? 'Unknown'

  // Parse hub factor (accept any positive number, not just presets)
  const hubFactorParam = searchParams.get('hub_factor')
  let hubFactor = DEFAULT_HUB_FACTOR
  if (hubFactorParam) {
    const parsed = parseFloat(hubFactorParam)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
      hubFactor = parsed
    }
  }

  // Get access token from session or Authorization header
  const authToken = await getValidAccessToken(undefined, request)

  if (!authToken) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const startTime = Date.now()

        // Progress: Starting
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'starting',
          message: 'Starting depletion analysis...',
          percent: 0
        })

        // Step 1: Fetch structure orders
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'orders',
          message: 'Fetching structure sell orders...',
          percent: 10
        })

        const ordersResponse = await fetch(
          `${ESI_BASE}/markets/structures/${structureId}/?datasource=tranquility`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
          }
        )

        if (!ordersResponse.ok) {
          throw new Error(`Failed to fetch structure orders: ${ordersResponse.status}`)
        }

        // Handle pagination
        const totalPages = parseInt(ordersResponse.headers.get('x-pages') || '1')
        let allOrders: Array<{
          type_id: number
          price: number
          volume_remain: number
          is_buy_order: boolean
        }> = await ordersResponse.json()

        if (totalPages > 1) {
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'orders',
            message: `Fetching orders page 1/${totalPages}...`,
            percent: 15
          })

          for (let page = 2; page <= totalPages; page++) {
            const pageResponse = await fetch(
              `${ESI_BASE}/markets/structures/${structureId}/?datasource=tranquility&page=${page}`,
              {
                headers: {
                  'Accept': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
              }
            )
            if (pageResponse.ok) {
              const pageOrders = await pageResponse.json()
              allOrders = allOrders.concat(pageOrders)
            }
            
            sendSSEEvent(controller, encoder, 'progress', {
              stage: 'orders',
              message: `Fetching orders page ${page}/${totalPages}...`,
              percent: 15 + (page / totalPages) * 10
            })
          }
        }

        // Filter to sell orders only and aggregate by type
        const sellOrders = allOrders.filter(o => !o.is_buy_order)
        const ordersByType = new Map<number, { total_volume: number; lowest_price: number }>()
        
        for (const order of sellOrders) {
          const existing = ordersByType.get(order.type_id)
          if (existing) {
            existing.total_volume += order.volume_remain
            existing.lowest_price = Math.min(existing.lowest_price, order.price)
          } else {
            ordersByType.set(order.type_id, {
              total_volume: order.volume_remain,
              lowest_price: order.price
            })
          }
        }

        const typeIds = Array.from(ordersByType.keys())
        
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'orders',
          message: `Found ${typeIds.length} unique items in ${sellOrders.length} sell orders`,
          percent: 25
        })

        if (typeIds.length === 0) {
          // No orders - send empty result
          const response: DepletionResponse = {
            success: true,
            structureId,
            analyzedAt: new Date().toISOString(),
            summary: {
              totalItems: 0,
              criticalCount: 0,
              warningCount: 0,
              okCount: 0,
              noDataCount: 0,
              totalDailyProfit: 0
            },
            predictions: []
          }
          sendSSEEvent(controller, encoder, 'complete', response)
          controller.close()
          return
        }

        // Step 2: Load item names
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'items',
          message: 'Loading item data...',
          percent: 30
        })
        const tradeableItems = await loadTradeableItemsMap()

        // Step 3: Fetch market data in batches of 500
        const BATCH_SIZE = 500
        const batches: number[][] = []
        for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
          batches.push(typeIds.slice(i, i + BATCH_SIZE))
        }

        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'market',
          message: `Fetching ${regionName} market history (${batches.length} batch${batches.length > 1 ? 'es' : ''})...`,
          percent: 35
        })

        // Fetch regional volumes and Jita prices
        const regionVolumes = new Map<number, { avgDailyVolume: number; avgPrice: number }>()
        const jitaPrices = new Map<number, number>()

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i]
          
          sendSSEEvent(controller, encoder, 'progress', {
            stage: 'market',
            message: `Fetching market data batch ${i + 1}/${batches.length}...`,
            percent: 35 + ((i + 1) / batches.length) * 30
          })

          // Fetch regional volume data
          const [regionData, priceData] = await Promise.all([
            getCachedMarketSeederStatistics(batch, 30, volumeRegionId),
            getCachedJitaPrices(batch)
          ])

          for (const [typeId, data] of regionData) {
            regionVolumes.set(typeId, {
              avgDailyVolume: data.avgDailyVolume,
              avgPrice: data.avgPrice
            })
          }

          for (const [typeId, data] of priceData) {
            jitaPrices.set(typeId, data.lowestSellPrice)
          }
        }

        // Step 4: Fetch user's assets and sell orders in the structure
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'user_data',
          message: 'Checking your inventory and orders...',
          percent: 68
        })

        const characterTokens = await getAllCharacterTokens(session.user_id)
        const userInventoryTypes = new Set<number>()
        const userSellOrderTypes = new Set<number>()
        const userSellOrderVolumes = new Map<number, number>()  // typeId -> total volume
        const locationId = parseInt(structureId)

        for (const token of characterTokens) {
          try {
            // Fetch assets
            const assets = await fetchCharacterAssets(token.character_id, token.access_token)
            for (const asset of assets) {
              if (asset.location_id === locationId && HANGAR_FLAGS.has(asset.location_flag) && !asset.is_blueprint_copy) {
                userInventoryTypes.add(asset.type_id)
              }
            }

            // Fetch orders and track volumes
            const orders = await fetchCharacterOrders(token.character_id, token.access_token)
            for (const order of orders) {
              if (!order.is_buy_order && order.location_id === locationId) {
                userSellOrderTypes.add(order.type_id)
                // Accumulate user's sell order volume for this type
                const existing = userSellOrderVolumes.get(order.type_id) || 0
                userSellOrderVolumes.set(order.type_id, existing + order.volume_remain)
              }
            }
          } catch (err) {
            console.error(`Failed to fetch data for character ${token.character_name}:`, err)
          }
        }

        // Step 5: Calculate predictions
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'analyzing',
          message: 'Calculating depletion predictions...',
          percent: 70
        })

        const predictions: DepletionPrediction[] = []

        for (const [typeId, orderData] of ordersByType) {
          const item = tradeableItems.get(typeId)
          const regionData = regionVolumes.get(typeId)
          const jitaPrice = jitaPrices.get(typeId)

          const avgDailyVolume = regionData?.avgDailyVolume || 0
          const estimatedDailySales = avgDailyVolume * hubFactor

          const daysUntilStockout = estimatedDailySales > 0
            ? orderData.total_volume / estimatedDailySales
            : null

          const jitaBuyPrice = jitaPrice || regionData?.avgPrice || 0
          const profitPerUnit = orderData.lowest_price - jitaBuyPrice
          const dailyProfitPotential = estimatedDailySales * Math.max(0, profitPerUnit)

          // Priority score - higher = more urgent
          let priorityScore = dailyProfitPotential
          if (daysUntilStockout !== null && daysUntilStockout < 30) {
            priorityScore *= (30 - daysUntilStockout) / 10
          }

          // Determine if there's competition: total structure stock > user's sell order volume
          const userVolume = userSellOrderVolumes.get(typeId) || 0
          const hasCompetition = orderData.total_volume > userVolume

          predictions.push({
            typeId,
            name: item?.name || `Unknown (${typeId})`,
            categoryName: item?.categoryName || null,
            groupName: item?.groupName || null,
            currentStock: orderData.total_volume,
            lowestPrice: orderData.lowest_price,
            jitaDailyVolume: avgDailyVolume,
            estimatedDailySales,
            daysUntilStockout,
            jitaBuyPrice,
            profitPerUnit,
            dailyProfitPotential,
            priorityScore,
            userHasInInventory: userInventoryTypes.has(typeId),
            userHasSellOrder: userSellOrderTypes.has(typeId),
            hasCompetition,
          })
        }

        // Step 6: Sort by days until stockout (ascending, nulls at end)
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'sorting',
          message: 'Sorting by urgency...',
          percent: 85
        })

        predictions.sort((a, b) => {
          // Nulls go to the end
          if (a.daysUntilStockout === null && b.daysUntilStockout === null) return 0
          if (a.daysUntilStockout === null) return 1
          if (b.daysUntilStockout === null) return -1
          // Sort ascending (critical/lowest first)
          return a.daysUntilStockout - b.daysUntilStockout
        })

        // Step 7: Calculate summary
        sendSSEEvent(controller, encoder, 'progress', {
          stage: 'summary',
          message: 'Generating summary...',
          percent: 95
        })

        let criticalCount = 0
        let warningCount = 0
        let okCount = 0
        let noDataCount = 0
        let totalDailyProfit = 0

        for (const p of predictions) {
          totalDailyProfit += p.dailyProfitPotential
          
          if (p.daysUntilStockout === null) {
            noDataCount++
          } else if (p.currentStock === 0) {
            // Critical: completely out of stock
            criticalCount++
          } else if (p.daysUntilStockout < 3) {
            // Warning: less than 3 days of stock remaining
            warningCount++
          } else {
            // OK: 3+ days of stock
            okCount++
          }
        }

        const response: DepletionResponse = {
          success: true,
          structureId,
          analyzedAt: new Date().toISOString(),
          summary: {
            totalItems: predictions.length,
            criticalCount,
            warningCount,
            okCount,
            noDataCount,
            totalDailyProfit
          },
          predictions
        }

        console.log(`[Depletion API] Analysis complete in ${Date.now() - startTime}ms`)
        sendSSEEvent(controller, encoder, 'complete', response)
        controller.close()

      } catch (error) {
        console.error('[Depletion API] Error:', error)
        sendSSEEvent(controller, encoder, 'error', {
          message: error instanceof Error ? error.message : 'Analysis failed'
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
    }
  })
}

