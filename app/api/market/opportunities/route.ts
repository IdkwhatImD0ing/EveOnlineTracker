import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  getCachedMarketHistoryArrays,
  getCachedBasicMarketStatistics,
  getCachedJitaPrices,
} from '@/lib/cached-data'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import {
  CONFIG,
  OPPORTUNITY_TIERS,
  filterCandidates,
  rankByVolume,
  analyzeOpportunity,
  rankOpportunities,
  type ItemStatistics,
  type MarketOpportunity,
  type PriceDataPoint,
} from '@/lib/market-analysis'

const ESI_BASE = 'https://esi.evetech.net/latest'
const REGION_THE_FORGE = 10000002 // Jita's region

interface TradeableItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number | null
}

interface ESIMarketOrder {
  order_id: number
  type_id: number
  location_id: number
  volume_total: number
  volume_remain: number
  min_volume: number
  price: number
  is_buy_order: boolean
  duration: number
  issued: string
  range: string
}

/**
 * Read tradeable items from JSONL file to get item names
 */
async function readTradeableItems(): Promise<Map<number, string>> {
  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Tradeable items file not found: ${filePath}`)
    return new Map()
  }

  const items = new Map<number, string>()
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const item = JSON.parse(line) as TradeableItem
        items.set(item.typeId, item.name)
      } catch {
        // Skip invalid lines
      }
    }
  }

  return items
}

/**
 * Fetch current lowest sell price for a type from ESI
 */
async function fetchCurrentPrice(
  typeId: number,
  regionId: number
): Promise<number | null> {
  try {
    const response = await fetch(
      `${ESI_BASE}/markets/${regionId}/orders/?type_id=${typeId}&order_type=sell`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Compatibility-Date': '2025-11-06',
          'User-Agent': 'EveIndustryTracker/1.0'
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return null // No orders for this item
      }
      return null
    }

    const orders: ESIMarketOrder[] = await response.json()
    
    if (orders.length === 0) {
      return null
    }

    // Find the lowest sell price
    const lowestPrice = orders.reduce((min, order) => 
      order.price < min ? order.price : min, 
      orders[0].price
    )

    return lowestPrice
  } catch (error) {
    console.error(`Failed to fetch price for type ${typeId}:`, error)
    return null
  }
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

/**
 * Interface for database history array result
 */
interface HistoryArrayRow {
  type_id: number
  dates: string[]
  prices: number[]
  volumes: number[]
  highs: number[]
  lows: number[]
  data_points: number
  mean_price: number
  std_dev: number
  avg_volume: number
  volatility: number
}

/**
 * Convert database result to ItemStatistics
 */
function convertToItemStatistics(
  row: HistoryArrayRow,
  itemName: string
): ItemStatistics {
  // Build price history from arrays
  const priceHistory: PriceDataPoint[] = []
  for (let i = 0; i < row.data_points; i++) {
    priceHistory.push({
      date: row.dates[i],
      price: row.prices[i],
      volume: row.volumes[i],
      high: row.highs[i],
      low: row.lows[i]
    })
  }

  return {
    typeId: row.type_id,
    itemName,
    mean: row.mean_price,
    stdDev: row.std_dev,
    avgVolume: row.avg_volume,
    volatility: row.volatility,
    dataPoints: row.data_points,
    priceHistory
  }
}

/**
 * Handle streaming request with Server-Sent Events
 * Sends progress updates as processing happens
 */
async function handleStreamingRequest(
  request: NextRequest,
  params: {
    limit: number
    minPrice: number
    minVolume: number
    maxVolatility: number
    minScore: number
    minWeeklyIsk: number
    startTime: number
  }
) {
  const { limit, minPrice, minVolume, maxVolatility, minScore, minWeeklyIsk, startTime } = params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Load item names
        sendSSEEvent(controller, encoder, 'progress', { 
          stage: 'loading', 
          message: 'Loading tradeable items...',
          percent: 0 
        })
        
        const itemNames = await readTradeableItems()
        const allTypeIds = Array.from(itemNames.keys())
        
        sendSSEEvent(controller, encoder, 'progress', { 
          stage: 'loading', 
          message: `Loaded ${itemNames.size} items`,
          percent: 5 
        })

        // Step 2: Fetch market history arrays in batches
        const supabase = createClient()
        const BATCH_SIZE = 100 // Smaller batches since we're fetching arrays
        const totalBatches = Math.ceil(allTypeIds.length / BATCH_SIZE)
        
        const allHistoryData: HistoryArrayRow[] = []
        let rpcFailed = false
        let useOldRpc = false

        // Try new RPC first
        for (let i = 0; i < allTypeIds.length; i += BATCH_SIZE) {
          const batchNum = Math.floor(i / BATCH_SIZE) + 1
          const batchTypeIds = allTypeIds.slice(i, i + BATCH_SIZE)
          
          sendSSEEvent(controller, encoder, 'progress', { 
            stage: 'stats', 
            message: `Fetching market history... ${batchNum}/${totalBatches}`,
            percent: 5 + Math.round((batchNum / totalBatches) * 40),
            batch: batchNum,
            totalBatches
          })

          const { data: batchData, error: batchError } = await supabase
            .rpc('get_market_history_arrays', {
              p_type_ids: batchTypeIds,
              p_region_id: REGION_THE_FORGE,
              p_days_back: 90 // 90 days is enough for signal analysis
            })

          if (batchError) {
            // If function doesn't exist, fall back to old RPC
            if (batchError.message.includes('function') || batchError.message.includes('does not exist')) {
              console.warn(`[Market Opportunities] New RPC not available, falling back to old method`)
              useOldRpc = true
              break
            }
            console.warn(`[Market Opportunities] RPC batch failed: ${batchError.message}`)
            rpcFailed = true
            sendSSEEvent(controller, encoder, 'progress', { 
              stage: 'stats', 
              message: `Database query failed, using fallback...`,
              percent: 50
            })
            break
          }

          if (batchData && batchData.length > 0) {
            allHistoryData.push(...(batchData as HistoryArrayRow[]))
          }
        }

        // Fall back to old RPC if new one doesn't exist
        if (useOldRpc) {
          return await handleOldRpcStreamingRequest(
            controller, encoder, supabase, itemNames, allTypeIds,
            { limit, minPrice, minVolume, maxVolatility, minScore, minWeeklyIsk, startTime }
          )
        }

        // If RPC failed, send error and close
        if (rpcFailed) {
          sendSSEEvent(controller, encoder, 'error', { 
            message: 'Database query timed out. Please try again or contact support.'
          })
          controller.close()
          return
        }

        if (allHistoryData.length === 0) {
          sendSSEEvent(controller, encoder, 'complete', { 
            success: true,
            opportunities: [],
            message: 'No market history data available.',
            timing: { total_ms: Date.now() - startTime }
          })
          controller.close()
          return
        }

        sendSSEEvent(controller, encoder, 'progress', { 
          stage: 'processing', 
          message: `Processing ${allHistoryData.length} items with signal analysis...`,
          percent: 50
        })

        // Step 3: Convert to ItemStatistics
        const allStats: ItemStatistics[] = allHistoryData.map(row => 
          convertToItemStatistics(row, itemNames.get(row.type_id) || `Unknown (${row.type_id})`)
        )

        // Step 4: Filter candidates
        const filteredStats = allStats.filter(item => {
          if (item.dataPoints < CONFIG.MIN_DATA_POINTS) return false
          if (item.avgVolume < minVolume) return false
          if (item.volatility > maxVolatility) return false
          if (item.mean < minPrice) return false
          return true
        })

        sendSSEEvent(controller, encoder, 'progress', { 
          stage: 'processing', 
          message: `${filteredStats.length} items passed filters`,
          percent: 55
        })

        // Step 5: Rank by volume and select candidates
        const maxItems = CONFIG.MAX_ITEMS_TO_ANALYZE
        const candidates = rankByVolume(filteredStats, maxItems)
        const typeIds = candidates.map(c => c.typeId)
        const totalPriceBatches = Math.ceil(typeIds.length / CONFIG.CONCURRENT_ESI_REQUESTS)

        sendSSEEvent(controller, encoder, 'progress', { 
          stage: 'prices', 
          message: `Fetching current prices for ${typeIds.length} items...`,
          percent: 60
        })

        // Step 6: Fetch prices with progress updates
        const prices = new Map<number, number>()
        for (let i = 0; i < typeIds.length; i += CONFIG.CONCURRENT_ESI_REQUESTS) {
          const batch = typeIds.slice(i, i + CONFIG.CONCURRENT_ESI_REQUESTS)
          const batchNum = Math.floor(i / CONFIG.CONCURRENT_ESI_REQUESTS) + 1
          
          const batchPromises = batch.map(async (typeId) => {
            const price = await fetchCurrentPrice(typeId, REGION_THE_FORGE)
            return { typeId, price }
          })

          const batchResults = await Promise.all(batchPromises)
          
          for (const { typeId, price } of batchResults) {
            if (price !== null) {
              prices.set(typeId, price)
            }
          }

          // Send progress every 5 batches
          if (batchNum % 5 === 0 || i + CONFIG.CONCURRENT_ESI_REQUESTS >= typeIds.length) {
            sendSSEEvent(controller, encoder, 'progress', { 
              stage: 'prices', 
              message: `Fetching prices... ${Math.min(i + CONFIG.CONCURRENT_ESI_REQUESTS, typeIds.length)}/${typeIds.length}`,
              percent: 60 + Math.round((batchNum / totalPriceBatches) * 30)
            })
          }

          if (i + CONFIG.CONCURRENT_ESI_REQUESTS < typeIds.length) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.ESI_BATCH_DELAY_MS))
          }
        }

        sendSSEEvent(controller, encoder, 'progress', { 
          stage: 'analyzing', 
          message: `Running multi-signal analysis...`,
          percent: 92
        })

        // Step 7: Run multi-signal analysis
        const opportunities: MarketOpportunity[] = []
        for (const stats of candidates) {
          const currentPrice = prices.get(stats.typeId)
          if (currentPrice === undefined) continue
          
          const opportunity = analyzeOpportunity(stats, currentPrice)
          if (opportunity && 
              opportunity.signals.totalScore >= minScore &&
              (minWeeklyIsk === 0 || opportunity.weeklyIskPotential >= minWeeklyIsk)) {
            opportunities.push(opportunity)
          }
        }

        sendSSEEvent(controller, encoder, 'progress', { 
          stage: 'analyzing', 
          message: `Found ${opportunities.length} opportunities`,
          percent: 98
        })

        const rankedOpportunities = rankOpportunities(opportunities, limit)
        const totalTime = Date.now() - startTime

        // Send final results
        sendSSEEvent(controller, encoder, 'complete', {
          success: true,
          opportunities: rankedOpportunities,
          summary: {
            total_items_analyzed: allStats.length,
            items_after_filters: filteredStats.length,
            items_with_current_price: prices.size,
            opportunities_found: opportunities.length,
            results_returned: rankedOpportunities.length,
          },
          filters: {
            min_price: minPrice,
            min_volume: minVolume,
            max_volatility: maxVolatility,
            min_score: minScore,
            lookback_days: 90,
          },
          scoring: {
            tiers: OPPORTUNITY_TIERS,
            weights: CONFIG.WEIGHTS
          },
          timing: { total_ms: totalTime },
          generated_at: new Date().toISOString()
        })

        controller.close()

      } catch (error) {
        console.error('[Market Opportunities SSE] Error:', error)
        sendSSEEvent(controller, encoder, 'error', { 
          message: error instanceof Error ? error.message : 'An unexpected error occurred'
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

/**
 * Fallback handler using old RPC (get_market_statistics) for backwards compatibility
 */
async function handleOldRpcStreamingRequest(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  supabase: ReturnType<typeof createClient>,
  itemNames: Map<number, string>,
  allTypeIds: number[],
  params: {
    limit: number
    minPrice: number
    minVolume: number
    maxVolatility: number
    minScore: number
    minWeeklyIsk: number
    startTime: number
  }
) {
  const { limit, minPrice, minVolume, maxVolatility, minWeeklyIsk, startTime } = params

  sendSSEEvent(controller, encoder, 'progress', { 
    stage: 'stats', 
    message: 'Using basic analysis (run migration 007 for full signal analysis)...',
    percent: 10
  })

  // Use old RPC in batches
  const BATCH_SIZE = 200
  const totalBatches = Math.ceil(allTypeIds.length / BATCH_SIZE)
  
  interface OldStatRow {
    type_id: number
    mean_price: number
    std_dev: number
    avg_volume: number
    data_points: number
    volatility: number
  }
  
  const allStatsData: OldStatRow[] = []

  for (let i = 0; i < allTypeIds.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const batchTypeIds = allTypeIds.slice(i, i + BATCH_SIZE)
    
    sendSSEEvent(controller, encoder, 'progress', { 
      stage: 'stats', 
      message: `Fetching market stats (basic)... ${batchNum}/${totalBatches}`,
      percent: 10 + Math.round((batchNum / totalBatches) * 35)
    })

    const { data: batchData, error: batchError } = await supabase
      .rpc('get_market_statistics', {
        p_type_ids: batchTypeIds,
        p_region_id: REGION_THE_FORGE,
        p_days_back: CONFIG.LOOKBACK_DAYS,
        p_min_data_points: 3
      })

    if (batchError) {
      console.warn(`[Market Opportunities] Old RPC also failed: ${batchError.message}`)
      sendSSEEvent(controller, encoder, 'error', { 
        message: 'Database query failed. Please run migrations.'
      })
      controller.close()
      return
    }

    if (batchData && batchData.length > 0) {
      allStatsData.push(...(batchData as OldStatRow[]))
    }
  }

  // Convert to simplified ItemStatistics (no full history for signal analysis)
  const allStats: ItemStatistics[] = allStatsData.map(row => ({
    typeId: row.type_id,
    itemName: itemNames.get(row.type_id) || `Unknown (${row.type_id})`,
    mean: row.mean_price,
    stdDev: row.std_dev,
    avgVolume: row.avg_volume,
    volatility: row.volatility,
    dataPoints: row.data_points,
    priceHistory: [] // Empty - can't do full signal analysis
  }))

  sendSSEEvent(controller, encoder, 'progress', { 
    stage: 'processing', 
    message: `Processing ${allStats.length} items...`,
    percent: 50
  })

  // Filter
  const filteredStats = allStats.filter(item => {
    if (item.dataPoints < 3) return false
    if (item.avgVolume < minVolume) return false
    if (item.volatility > maxVolatility) return false
    if (item.mean < minPrice) return false
    return true
  })

  const maxItems = CONFIG.MAX_ITEMS_TO_ANALYZE
  const candidates = rankByVolume(filteredStats, maxItems)
  const typeIds = candidates.map(c => c.typeId)
  const totalPriceBatches = Math.ceil(typeIds.length / CONFIG.CONCURRENT_ESI_REQUESTS)

  sendSSEEvent(controller, encoder, 'progress', { 
    stage: 'prices', 
    message: `Fetching prices for ${typeIds.length} items...`,
    percent: 55
  })

  // Fetch prices
  const prices = new Map<number, number>()
  for (let i = 0; i < typeIds.length; i += CONFIG.CONCURRENT_ESI_REQUESTS) {
    const batch = typeIds.slice(i, i + CONFIG.CONCURRENT_ESI_REQUESTS)
    const batchNum = Math.floor(i / CONFIG.CONCURRENT_ESI_REQUESTS) + 1
    
    const batchPromises = batch.map(async (typeId) => {
      const price = await fetchCurrentPrice(typeId, REGION_THE_FORGE)
      return { typeId, price }
    })

    const batchResults = await Promise.all(batchPromises)
    
    for (const { typeId, price } of batchResults) {
      if (price !== null) {
        prices.set(typeId, price)
      }
    }

    if (batchNum % 5 === 0 || i + CONFIG.CONCURRENT_ESI_REQUESTS >= typeIds.length) {
      sendSSEEvent(controller, encoder, 'progress', { 
        stage: 'prices', 
        message: `Fetching prices... ${Math.min(i + CONFIG.CONCURRENT_ESI_REQUESTS, typeIds.length)}/${typeIds.length}`,
        percent: 55 + Math.round((batchNum / totalPriceBatches) * 35)
      })
    }

    if (i + CONFIG.CONCURRENT_ESI_REQUESTS < typeIds.length) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.ESI_BATCH_DELAY_MS))
    }
  }

  sendSSEEvent(controller, encoder, 'progress', { 
    stage: 'analyzing', 
    message: 'Analyzing (limited - run migration 007 for full analysis)...',
    percent: 95
  })

  // Basic analysis (signal analysis won't work well without history)
  const opportunities: MarketOpportunity[] = []
  for (const stats of candidates) {
    const currentPrice = prices.get(stats.typeId)
    if (currentPrice === undefined) continue
    
    const opportunity = analyzeOpportunity(stats, currentPrice)
    if (opportunity && 
        (minWeeklyIsk === 0 || opportunity.weeklyIskPotential >= minWeeklyIsk)) {
      opportunities.push(opportunity)
    }
  }

  const rankedOpportunities = rankOpportunities(opportunities, limit)
  const totalTime = Date.now() - startTime

  sendSSEEvent(controller, encoder, 'complete', {
    success: true,
    opportunities: rankedOpportunities,
    summary: {
      total_items_analyzed: allStats.length,
      items_after_filters: filteredStats.length,
      items_with_current_price: prices.size,
      opportunities_found: opportunities.length,
      results_returned: rankedOpportunities.length,
    },
    filters: {
      min_price: minPrice,
      min_volume: minVolume,
      max_volatility: maxVolatility,
      lookback_days: CONFIG.LOOKBACK_DAYS,
    },
    timing: { total_ms: totalTime },
    generated_at: new Date().toISOString(),
    note: 'Using basic analysis. Run migration 007 for full multi-signal analysis.'
  })

  controller.close()
}

/**
 * GET /api/market/opportunities
 * 
 * Analyzes market history to find undervalued items using multi-signal analysis.
 * 
 * Query Parameters:
 *   - limit (optional): Number of results to return. Default: 50
 *   - min_price (optional): Minimum current price filter. Default: 1000
 *   - min_volume (optional): Minimum daily volume filter. Default: 10
 *   - max_volatility (optional): Maximum volatility filter. Default: 0.5
 *   - min_score (optional): Minimum opportunity score. Default: 20 (marginal tier)
 *   - stream (optional): If 'true', returns Server-Sent Events with progress updates
 */
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user_id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  
  // Parse query parameters with defaults
  const limit = parseInt(searchParams.get('limit') || String(CONFIG.TOP_RESULTS))
  const minPrice = parseFloat(searchParams.get('min_price') || String(CONFIG.MIN_PRICE))
  const minVolume = parseFloat(searchParams.get('min_volume') || String(CONFIG.MIN_DAILY_VOLUME))
  const maxVolatility = parseFloat(searchParams.get('max_volatility') || String(CONFIG.MAX_VOLATILITY))
  const minScore = parseFloat(searchParams.get('min_score') || String(OPPORTUNITY_TIERS.MARGINAL))
  const minWeeklyIsk = parseFloat(searchParams.get('min_weekly_isk') || '0') // 0 = no filter
  const streamMode = searchParams.get('stream') === 'true'

  console.log(`[Market Opportunities] Starting analysis with limit=${limit}, minPrice=${minPrice}, minScore=${minScore}, minWeeklyIsk=${minWeeklyIsk}, stream=${streamMode}`)

  // If streaming mode, use SSE (recommended for UI)
  if (streamMode) {
    return handleStreamingRequest(request, { limit, minPrice, minVolume, maxVolatility, minScore, minWeeklyIsk, startTime })
  }

  // Non-streaming mode (for API clients) - uses cached data functions
  try {
    const itemNames = await readTradeableItems()
    console.log(`[Market Opportunities] Loaded ${itemNames.size} item names`)

    const allTypeIds = Array.from(itemNames.keys())

    // Fetch market history using cached function
    console.log(`[Market Opportunities] Fetching cached market history...`)
    const historyMap = await getCachedMarketHistoryArrays(allTypeIds, 90, REGION_THE_FORGE)
    
    // If no history arrays available, fall back to basic stats
    if (historyMap.size === 0) {
      console.log(`[Market Opportunities] No history arrays, trying basic stats...`)
      const basicStats = await getCachedBasicMarketStatistics(allTypeIds, CONFIG.LOOKBACK_DAYS, REGION_THE_FORGE)
      
      if (basicStats.length === 0) {
        return NextResponse.json({
          success: true,
          opportunities: [],
          message: 'No market history data available. Run the market history fetch first.',
          timing: { total_ms: Date.now() - startTime }
        })
      }
      
      // Use fallback analysis with basic stats
      const allStats: ItemStatistics[] = basicStats.map(row => ({
        typeId: row.type_id,
        itemName: itemNames.get(row.type_id) || `Unknown (${row.type_id})`,
        mean: row.mean_price,
        stdDev: row.std_dev,
        avgVolume: row.avg_volume,
        volatility: row.volatility,
        dataPoints: row.data_points,
        priceHistory: []
      }))
      
      const filteredStats = allStats.filter(item => {
        if (item.dataPoints < 3) return false
        if (item.avgVolume < minVolume) return false
        if (item.volatility > maxVolatility) return false
        if (item.mean < minPrice) return false
        return true
      })

      const candidates = rankByVolume(filteredStats, CONFIG.MAX_ITEMS_TO_ANALYZE)
      const candidateTypeIds = candidates.map(c => c.typeId)
      
      // Fetch prices using cached function
      console.log(`[Market Opportunities] Fetching cached Jita prices for ${candidateTypeIds.length} items...`)
      const pricesMap = await getCachedJitaPrices(candidateTypeIds)
      const prices = new Map<number, number>()
      for (const [typeId, priceData] of pricesMap) {
        prices.set(typeId, priceData.lowestSellPrice)
      }
      
      const opportunities: MarketOpportunity[] = []
      for (const stats of candidates) {
        const currentPrice = prices.get(stats.typeId)
        if (currentPrice === undefined) continue
        
        const opportunity = analyzeOpportunity(stats, currentPrice)
        if (opportunity && 
            opportunity.signals.totalScore >= minScore &&
            (minWeeklyIsk === 0 || opportunity.weeklyIskPotential >= minWeeklyIsk)) {
          opportunities.push(opportunity)
        }
      }

      const rankedOpportunities = rankOpportunities(opportunities, limit)
      
      return NextResponse.json({
        success: true,
        opportunities: rankedOpportunities,
        summary: {
          total_items_analyzed: allStats.length,
          items_after_filters: filteredStats.length,
          items_with_current_price: prices.size,
          opportunities_found: opportunities.length,
          results_returned: rankedOpportunities.length,
        },
        filters: {
          min_price: minPrice,
          min_volume: minVolume,
          max_volatility: maxVolatility,
          min_score: minScore,
          lookback_days: CONFIG.LOOKBACK_DAYS,
        },
        timing: { total_ms: Date.now() - startTime },
        generated_at: new Date().toISOString(),
        cached: true,
        note: 'Using basic analysis with cached data.'
      })
    }

    // Convert history arrays to ItemStatistics
    const allStats: ItemStatistics[] = []
    for (const [typeId, row] of historyMap) {
      allStats.push(convertToItemStatistics(
        row as HistoryArrayRow, 
        itemNames.get(typeId) || `Unknown (${typeId})`
      ))
    }

    const filteredStats = filterCandidates(allStats).filter(item => {
      if (item.mean < minPrice) return false
      if (item.avgVolume < minVolume) return false
      if (item.volatility > maxVolatility) return false
      return true
    })

    const candidates = rankByVolume(filteredStats, CONFIG.MAX_ITEMS_TO_ANALYZE)
    const candidateTypeIds = candidates.map(c => c.typeId)
    
    // Fetch current prices using cached function
    console.log(`[Market Opportunities] Fetching cached Jita prices for ${candidateTypeIds.length} items...`)
    const pricesMap = await getCachedJitaPrices(candidateTypeIds)
    const prices = new Map<number, number>()
    for (const [typeId, priceData] of pricesMap) {
      prices.set(typeId, priceData.lowestSellPrice)
    }

    // Analyze with multi-signal system
    const opportunities: MarketOpportunity[] = []
    for (const stats of candidates) {
      const currentPrice = prices.get(stats.typeId)
      if (currentPrice === undefined) continue
      
      const opportunity = analyzeOpportunity(stats, currentPrice)
      if (opportunity && 
          opportunity.signals.totalScore >= minScore &&
          (minWeeklyIsk === 0 || opportunity.weeklyIskPotential >= minWeeklyIsk)) {
        opportunities.push(opportunity)
      }
    }

    const rankedOpportunities = rankOpportunities(opportunities, limit)
    const totalTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      opportunities: rankedOpportunities,
      summary: {
        total_items_analyzed: allStats.length,
        items_after_filters: filteredStats.length,
        items_with_current_price: prices.size,
        opportunities_found: opportunities.length,
        results_returned: rankedOpportunities.length,
      },
      filters: {
        min_price: minPrice,
        min_volume: minVolume,
        max_volatility: maxVolatility,
        min_score: minScore,
        lookback_days: 90,
      },
      scoring: {
        tiers: OPPORTUNITY_TIERS,
        weights: CONFIG.WEIGHTS
      },
      timing: { total_ms: totalTime },
      generated_at: new Date().toISOString(),
      cached: true
    })

  } catch (error) {
    console.error('[Market Opportunities] Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze market opportunities',
        timing: { total_ms: Date.now() - startTime }
      },
      { status: 500 }
    )
  }
}

