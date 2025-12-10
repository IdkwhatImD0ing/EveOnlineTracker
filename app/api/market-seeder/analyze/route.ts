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
 *   - limit (optional): Max items per ranked list (default: 50, max: 200)
 *   - minMargin (optional): Minimum profit margin % (default: 10)
 *   - minProfit (optional): Minimum profit per unit in ISK (default: 100000)
 *   - transportCost (optional): ISK per m³ transport cost (default: 450)
 *   - days (optional): Days of market history to analyze (default: 30)
 *   - stream (optional): If 'true', returns Server-Sent Events with progress updates
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
  type MarketSeederResponse,
  type ProfitAnalysis,
  MARKET_SEEDER_DEFAULTS,
} from '@/types/market-seeder'

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
function enrichProfitAnalysis(item: ProfitAnalysis) {
  return {
    ...item,
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
 * Handle streaming request with Server-Sent Events
 */
async function handleStreamingRequest(
  params: {
    structureId: string
    authToken: string
    limit: number
    minMargin: number
    minProfit: number
    transportCost: number
    days: number
    startTime: number
  }
) {
  const { structureId, authToken, limit, minMargin, minProfit, transportCost, days, startTime } = params
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
          minMarginPct: minMargin,
          minProfitIsk: minProfit,
          days,
          onProgress
        })

        // Generate ranked lists
        onProgress('ranking', 'Generating ranked lists...', 95)
        const rankedLists = generateRankedLists(result.items, limit)

        // Enrich items with formatted values
        const enrichedLists = {
          topByCompositeScore: rankedLists.topByCompositeScore.map(enrichProfitAnalysis),
          noCompetitionOpportunities: rankedLists.noCompetitionOpportunities.map(enrichProfitAnalysis),
          bestIskPerM3: rankedLists.bestIskPerM3.map(enrichProfitAnalysis),
          trendingUp: rankedLists.trendingUp.map(enrichProfitAnalysis),
          byCategory: {
            Module: rankedLists.byCategory.Module.map(enrichProfitAnalysis),
            Ship: rankedLists.byCategory.Ship.map(enrichProfitAnalysis),
            Charge: rankedLists.byCategory.Charge.map(enrichProfitAnalysis),
            Booster: rankedLists.byCategory.Booster.map(enrichProfitAnalysis),
          }
        }

        const totalTime = Date.now() - startTime

        // Build response
        const response: MarketSeederResponse = {
          success: true,
          generatedAt: new Date().toISOString(),
          
          config: {
            structureId,
            transportCostPerM3: transportCost,
            minMarginPct: minMargin,
            minProfitIsk: minProfit,
            daysAnalyzed: days
          },
          
          summary: result.summary,
          
          topByCompositeScore: enrichedLists.topByCompositeScore,
          noCompetitionOpportunities: enrichedLists.noCompetitionOpportunities,
          bestIskPerM3: enrichedLists.bestIskPerM3,
          trendingUp: enrichedLists.trendingUp,
          byCategory: enrichedLists.byCategory,
          
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
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  
  // Parse query parameters
  const structureId = searchParams.get('structure_id')
  const limit = Math.min(
    parseInt(searchParams.get('limit') || String(MARKET_SEEDER_DEFAULTS.DEFAULT_LIMIT_PER_CATEGORY)),
    MARKET_SEEDER_DEFAULTS.MAX_LIMIT
  )
  const minMargin = parseFloat(searchParams.get('minMargin') || String(MARKET_SEEDER_DEFAULTS.MIN_PROFIT_MARGIN_PCT))
  const minProfit = parseFloat(searchParams.get('minProfit') || String(MARKET_SEEDER_DEFAULTS.MIN_PROFIT_ISK))
  const transportCost = parseFloat(searchParams.get('transportCost') || String(MARKET_SEEDER_DEFAULTS.TRANSPORT_COST_PER_M3))
  const days = parseInt(searchParams.get('days') || String(MARKET_SEEDER_DEFAULTS.DAYS_TO_ANALYZE))
  const streamMode = searchParams.get('stream') === 'true'
  
  // Get authorization header
  const authHeader = request.headers.get('authorization')
  
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
  
  if (!authHeader) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Authorization header required',
        details: 'Login with EVE SSO first (requires esi-markets.structure_markets.v1 scope)'
      },
      { status: 401 }
    )
  }
  
  // Extract token from Bearer header
  const authToken = authHeader.replace(/^Bearer\s+/i, '')

  // If streaming mode, use SSE
  if (streamMode) {
    return handleStreamingRequest({
      structureId,
      authToken,
      limit,
      minMargin,
      minProfit,
      transportCost,
      days,
      startTime
    })
  }
  
  try {
    console.log(`[Market Seeder API] Starting analysis for structure ${structureId}`)
    
    // Run analysis (without progress callback for non-streaming mode)
    const result = await analyzeMarketWithProgress({
      structureId,
      authToken,
      transportCostPerM3: transportCost,
      minMarginPct: minMargin,
      minProfitIsk: minProfit,
      days,
    })
    
    // Generate ranked lists
    const rankedLists = generateRankedLists(result.items, limit)
    
    // Enrich items with formatted values
    const enrichedLists = {
      topByCompositeScore: rankedLists.topByCompositeScore.map(enrichProfitAnalysis),
      noCompetitionOpportunities: rankedLists.noCompetitionOpportunities.map(enrichProfitAnalysis),
      bestIskPerM3: rankedLists.bestIskPerM3.map(enrichProfitAnalysis),
      trendingUp: rankedLists.trendingUp.map(enrichProfitAnalysis),
      byCategory: {
        Module: rankedLists.byCategory.Module.map(enrichProfitAnalysis),
        Ship: rankedLists.byCategory.Ship.map(enrichProfitAnalysis),
        Charge: rankedLists.byCategory.Charge.map(enrichProfitAnalysis),
        Booster: rankedLists.byCategory.Booster.map(enrichProfitAnalysis),
      }
    }
    
    const totalTime = Date.now() - startTime
    
    // Build response
    const response: MarketSeederResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      
      config: {
        structureId,
        transportCostPerM3: transportCost,
        minMarginPct: minMargin,
        minProfitIsk: minProfit,
        daysAnalyzed: days
      },
      
      summary: result.summary,
      
      topByCompositeScore: enrichedLists.topByCompositeScore,
      noCompetitionOpportunities: enrichedLists.noCompetitionOpportunities,
      bestIskPerM3: enrichedLists.bestIskPerM3,
      trendingUp: enrichedLists.trendingUp,
      byCategory: enrichedLists.byCategory,
      
      timing: {
        marketHistoryQueryMs: result.timing.marketHistoryMs,
        structureOrdersFetchMs: result.timing.structureOrdersMs,
        jitaPriceFetchMs: result.timing.jitaPricesMs,
        analysisMs: result.timing.analysisMs,
        totalMs: totalTime
      }
    }
    
    console.log(`[Market Seeder API] Analysis complete in ${totalTime}ms`)
    
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
