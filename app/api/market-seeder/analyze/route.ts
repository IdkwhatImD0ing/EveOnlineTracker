/**
 * Market Seeder Analysis API
 * 
 * Analyzes market data to identify profitable items to import from Jita
 * to an alliance market hub.
 * 
 * GET /api/market-seeder/analyze
 * 
 * Query Parameters:
 *   - structure_id (required): Target structure ID for the alliance market hub
 *   - minProfit (optional): Minimum profit per unit in ISK (default: 100000)
 *   - minVolume (optional): Minimum daily volume (default: 10)
 *   - transportCost (optional): ISK per m³ transport cost (default: 450)
 *   - days (optional): Days of market history to analyze (default: 30)
 *   - volume_region_id (optional): Region ID for volume data (default: 10000003 / Vale of the Silent)
 *   - stream (optional): If 'true', returns Server-Sent Events with progress updates
 * 
 * Note: minMargin and category filtering are now handled client-side for better UX
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO (requires esi-markets.structure_markets.v1 scope)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeMarketWithProgress,
  generateRankedLists,
} from '@/lib/market-seeder'
import {
  type ProfitAnalysis,
  type RegionId,
  MARKET_SEEDER_DEFAULTS,
  DEFAULT_VOLUME_REGION_ID,
  DEFAULT_HUB_FACTOR,
  VOLUME_REGIONS,
} from '@/types/market-seeder'
import { getValidAccessToken, getAuthenticatedUser } from '@/lib/auth'

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

/**
 * Enrich profit analysis with formatted values for API response
 */
function enrichProfitAnalysis(item: ProfitAnalysis, hubFactor: number) {
  // Calculate estimated daily revenue (sell price × estimated daily sales at hub factor)
  const iskPerDay = item.targetSellPrice * item.avgDailyVolume * hubFactor
  
  return {
    ...item,
    iskPerDay,
    iskPerDayFormatted: formatISK(iskPerDay),
    jitaSellPriceFormatted: formatISK(item.jitaSellPrice),
    transportCostFormatted: formatISK(item.transportCostPerUnit),
    totalCostFormatted: formatISK(item.totalCostPerUnit),
    targetSellPriceFormatted: formatISK(item.targetSellPrice),
    profitPerUnitFormatted: formatISK(item.profitPerUnit),
    profitPerM3Formatted: formatISK(item.profitPerM3),
    competitorLowestPriceFormatted: item.competitorLowestPrice 
      ? formatISK(item.competitorLowestPrice) 
      : null,
    profitMarginPctFormatted: `${item.profitMarginPct.toFixed(1)}%`,
    compositeScoreFormatted: item.compositeScore.toFixed(1),
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
 * New simplified response type (all items in one array)
 */
interface AnalysisResponse {
  success: boolean
  generatedAt: string
  config: {
    structureId: string
    transportCostPerM3: number
    minProfitIsk: number
    minDailyVolume: number
    daysAnalyzed: number
  }
  summary: {
    totalItemsAnalyzed: number
    itemsPassingFilters: number
    itemsWithCompetition: number
    itemsNoCompetition: number
    avgProfitMargin: number
    avgProfitPerM3: number
  }
  items: ReturnType<typeof enrichProfitAnalysis>[]
  timing: {
    marketHistoryQueryMs: number
    structureOrdersFetchMs: number
    jitaPriceFetchMs: number
    analysisMs: number
    totalMs: number
  }
}

/**
 * Handle streaming request with Server-Sent Events
 */
async function handleStreamingRequest(
  params: {
    structureId: string
    authToken: string
    minProfit: number
    minVolume: number
    transportCost: number
    days: number
    volumeRegionId: RegionId
    hubFactor: number
    startTime: number
  }
) {
  const { structureId, authToken, minProfit, minVolume, transportCost, days, volumeRegionId, hubFactor, startTime } = params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Progress callback for the analysis
        const onProgress = (stage: string, message: string, percent: number, details?: Record<string, unknown>) => {
          sendSSEEvent(controller, encoder, 'progress', {
            stage,
            message,
            percent,
            ...details
          })
        }

        // Run analysis with progress updates
        const result = await analyzeMarketWithProgress({
          structureId,
          authToken,
          transportCostPerM3: transportCost,
          minProfitIsk: minProfit,
          minDailyVolume: minVolume,
          days,
          volumeRegionId,
          onProgress
        })

        // Generate ranked lists (returns all items sorted by score)
        onProgress('ranking', 'Sorting results...', 95)
        const rankedLists = generateRankedLists(result.items)

        // Enrich items with formatted values
        const enrichedItems = rankedLists.allItems.map(item => enrichProfitAnalysis(item, hubFactor))

        const totalTime = Date.now() - startTime

        // Build response
        const response: AnalysisResponse = {
          success: true,
          generatedAt: new Date().toISOString(),
          
          config: {
            structureId,
            transportCostPerM3: transportCost,
            minProfitIsk: minProfit,
            minDailyVolume: minVolume,
            daysAnalyzed: days
          },
          
          summary: result.summary,
          items: enrichedItems,
          
          timing: {
            marketHistoryQueryMs: result.timing.marketHistoryMs,
            structureOrdersFetchMs: result.timing.structureOrdersMs,
            jitaPriceFetchMs: result.timing.jitaPricesMs,
            analysisMs: result.timing.analysisMs,
            totalMs: totalTime
          }
        }

        // Send final results
        sendSSEEvent(controller, encoder, 'complete', response)
        controller.close()

      } catch (error) {
        console.error('[Market Seeder SSE] Error:', error)
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

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!session.user.allowed) {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
  }

  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  
  // Parse query parameters (removed minMargin and noCompetitionOnly - now client-side)
  const structureId = searchParams.get('structure_id')
  const minProfit = parseFloat(searchParams.get('minProfit') || String(MARKET_SEEDER_DEFAULTS.MIN_PROFIT_ISK))
  const minVolume = parseFloat(searchParams.get('minVolume') || String(MARKET_SEEDER_DEFAULTS.MIN_DAILY_VOLUME))
  const transportCost = parseFloat(searchParams.get('transportCost') || String(MARKET_SEEDER_DEFAULTS.TRANSPORT_COST_PER_M3))
  const days = parseInt(searchParams.get('days') || String(MARKET_SEEDER_DEFAULTS.DAYS_TO_ANALYZE))
  const streamMode = searchParams.get('stream') === 'true'
  
  // Parse volume region ID (validate against allowed regions)
  const volumeRegionIdParam = searchParams.get('volume_region_id')
  let volumeRegionId: RegionId = DEFAULT_VOLUME_REGION_ID
  if (volumeRegionIdParam) {
    const parsed = parseInt(volumeRegionIdParam)
    if (VOLUME_REGIONS.some(r => r.id === parsed)) {
      volumeRegionId = parsed as RegionId
    }
  }
  
  // Parse hub factor (accept any positive number, not just presets)
  const hubFactorParam = searchParams.get('hub_factor')
  let hubFactor = DEFAULT_HUB_FACTOR
  if (hubFactorParam) {
    const parsed = parseFloat(hubFactorParam)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
      hubFactor = parsed
    }
  }
  
  // Validate required parameters
  if (!structureId) {
    return NextResponse.json(
      { 
        success: false,
        error: 'structure_id is required',
        details: 'Provide the structure ID of your alliance market hub'
      },
      { status: 400 }
    )
  }
  
  // Get access token from session or Authorization header
  const authToken = await getValidAccessToken(undefined, request)
  
  if (!authToken) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Not authenticated',
        details: 'Login with EVE SSO first (requires esi-markets.structure_markets.v1 scope)'
      },
      { status: 401 }
    )
  }

  // If streaming mode, use SSE
  if (streamMode) {
    return handleStreamingRequest({
      structureId,
      authToken,
      minProfit,
      minVolume,
      transportCost,
      days,
      volumeRegionId,
      hubFactor,
      startTime
    })
  }
  
  try {
    console.log(`[Market Seeder API] Starting analysis for structure ${structureId} with volume region ${volumeRegionId}`)
    
    // Run analysis (without progress callback for non-streaming mode)
    const result = await analyzeMarketWithProgress({
      structureId,
      authToken,
      transportCostPerM3: transportCost,
      minProfitIsk: minProfit,
      minDailyVolume: minVolume,
      days,
      volumeRegionId,
    })
    
    // Generate ranked lists (returns all items sorted by score)
    const rankedLists = generateRankedLists(result.items)
    
    // Enrich items with formatted values
    const enrichedItems = rankedLists.allItems.map(item => enrichProfitAnalysis(item, hubFactor))
    
    const totalTime = Date.now() - startTime
    
    // Build response
    const response: AnalysisResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      
      config: {
        structureId,
        transportCostPerM3: transportCost,
        minProfitIsk: minProfit,
        minDailyVolume: minVolume,
        daysAnalyzed: days
      },
      
      summary: result.summary,
      items: enrichedItems,
      
      timing: {
        marketHistoryQueryMs: result.timing.marketHistoryMs,
        structureOrdersFetchMs: result.timing.structureOrdersMs,
        jitaPriceFetchMs: result.timing.jitaPricesMs,
        analysisMs: result.timing.analysisMs,
        totalMs: totalTime
      }
    }
    
    console.log(`[Market Seeder API] Analysis complete in ${totalTime}ms - ${enrichedItems.length} items`)
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('[Market Seeder API] Error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze market',
        timing: { totalMs: Date.now() - startTime }
      },
      { status: 500 }
    )
  }
}
