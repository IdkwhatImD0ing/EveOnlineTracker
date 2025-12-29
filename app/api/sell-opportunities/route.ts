import { NextRequest, NextResponse } from 'next/server'
import { getCachedMarketStatistics, getCachedJaniceAppraisal } from '@/lib/cached-data'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole } from '@/types/auth'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// Cache for tradeable type IDs (file-based, doesn't change)
let tradeableTypeIdsCache: Set<number> | null = null

/**
 * Load tradeable item type IDs from JSONL file
 */
async function loadTradeableTypeIds(): Promise<Set<number>> {
  if (tradeableTypeIdsCache) return tradeableTypeIdsCache

  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  
  if (!fs.existsSync(filePath)) {
    console.warn('[Sell Opportunities] tradeable-items.jsonl not found')
    return new Set()
  }

  const typeIds = new Set<number>()
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const item = JSON.parse(line)
        typeIds.add(item.typeId)
      } catch {
        // Skip invalid lines
      }
    }
  }

  tradeableTypeIdsCache = typeIds
  console.log(`[Sell Opportunities] Loaded ${typeIds.size} tradeable type IDs`)
  return typeIds
}

interface AssetInput {
  type_id: number
  type_name: string
  quantity: number
}

interface SellOpportunity {
  type_id: number
  type_name: string
  quantity: number
  current_sell_price: number
  all_time_high: number
  mean_price: number
  percent_of_ath: number
  percent_of_mean: number
  total_value: number
  recommendation: 'sell' | 'hold' | 'wait'
  recommendation_text: string
}


/**
 * Determine recommendation based on percentage of ATH
 */
function getRecommendation(percentOfATH: number): { recommendation: 'sell' | 'hold' | 'wait'; text: string } {
  if (percentOfATH > 100) {
    return { recommendation: 'sell', text: 'NEW ALL-TIME HIGH - Sell now!' }
  } else if (percentOfATH >= 80) {
    return { recommendation: 'sell', text: 'Good time to sell - near all-time high' }
  } else if (percentOfATH >= 60) {
    return { recommendation: 'hold', text: 'Consider holding - moderate pricing' }
  } else {
    return { recommendation: 'wait', text: 'Wait for better prices' }
  }
}

/**
 * POST /api/sell-opportunities
 * 
 * Analyzes assets against historical prices to identify sell opportunities.
 * 
 * Request Body:
 *   {
 *     "assets": [
 *       { "type_id": 34, "type_name": "Tritanium", "quantity": 1000000 },
 *       ...
 *     ]
 *   }
 * 
 * Returns opportunities sorted by percent_of_ath descending (best sell opportunities first).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const body = await request.json()
    const allAssets: AssetInput[] = body.assets

    if (!allAssets || !Array.isArray(allAssets) || allAssets.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain an "assets" array with at least one item' },
        { status: 400 }
      )
    }

    // Load tradeable type IDs and filter assets
    const tradeableTypeIds = await loadTradeableTypeIds()
    const assets = allAssets.filter(a => tradeableTypeIds.has(a.type_id))
    
    // Track items without market data
    const skippedItems = allAssets.filter(a => !tradeableTypeIds.has(a.type_id))

    if (assets.length === 0) {
      return NextResponse.json({
        opportunities: [],
        summary: {
          total_items: 0,
          sell_now_count: 0,
          hold_count: 0,
          wait_count: 0,
          total_value: 0,
          sell_now_value: 0,
          items_with_ath_data: 0,
        },
        skipped: {
          count: skippedItems.length,
          reason: 'No market history data available',
          items: skippedItems.slice(0, 10).map(i => i.type_name), // Show first 10
        },
      })
    }

    // Get type_ids and item names for queries
    const typeIds = assets.map(a => a.type_id)
    const itemNames = assets.map(a => a.type_name)

    // Fetch market stats and current prices in parallel (using cached functions)
    const [marketStatsMap, janiceAppraisalMap] = await Promise.all([
      getCachedMarketStatistics(typeIds),
      getCachedJaniceAppraisal(itemNames),
    ])

    // Build a map from type_id to sell price using Janice results
    const currentPricesMap = new Map<number, number>()
    for (const asset of assets) {
      const janiceItem = janiceAppraisalMap.get(asset.type_name)
      if (janiceItem) {
        currentPricesMap.set(asset.type_id, janiceItem.sellPrice)
      }
    }

    // Build opportunities list
    const opportunities: SellOpportunity[] = []

    for (const asset of assets) {
      const currentPrice = currentPricesMap.get(asset.type_id) || 0
      const stats = marketStatsMap.get(asset.type_id)
      const ath = stats?.all_time_high || 0
      const meanPrice = stats?.mean_price || 0

      // Calculate percentage of ATH (handle edge cases)
      let percentOfATH = 0
      if (ath > 0 && currentPrice > 0) {
        percentOfATH = Math.round((currentPrice / ath) * 100)
      } else if (currentPrice > 0 && ath === 0) {
        // No historical data - treat current price as 100%
        percentOfATH = 100
      }

      // Calculate percentage of mean price
      let percentOfMean = 0
      if (meanPrice > 0 && currentPrice > 0) {
        percentOfMean = Math.round((currentPrice / meanPrice) * 100)
      } else if (currentPrice > 0 && meanPrice === 0) {
        percentOfMean = 100
      }

      const { recommendation, text } = getRecommendation(percentOfATH)

      opportunities.push({
        type_id: asset.type_id,
        type_name: asset.type_name,
        quantity: asset.quantity,
        current_sell_price: currentPrice,
        all_time_high: ath,
        mean_price: meanPrice,
        percent_of_ath: percentOfATH,
        percent_of_mean: percentOfMean,
        total_value: currentPrice * asset.quantity,
        recommendation,
        recommendation_text: text,
      })
    }

    // Sort by percent_of_ath descending (best opportunities first)
    opportunities.sort((a, b) => b.percent_of_ath - a.percent_of_ath)

    // Calculate summary statistics
    const sellRecommendations = opportunities.filter(o => o.recommendation === 'sell')
    const totalSellValue = sellRecommendations.reduce((sum, o) => sum + o.total_value, 0)
    const totalValue = opportunities.reduce((sum, o) => sum + o.total_value, 0)

    return NextResponse.json({
      opportunities,
      summary: {
        total_items: opportunities.length,
        sell_now_count: sellRecommendations.length,
        hold_count: opportunities.filter(o => o.recommendation === 'hold').length,
        wait_count: opportunities.filter(o => o.recommendation === 'wait').length,
        total_value: totalValue,
        sell_now_value: totalSellValue,
        items_with_ath_data: opportunities.filter(o => o.all_time_high > 0).length,
      },
      skipped: skippedItems.length > 0 ? {
        count: skippedItems.length,
        reason: 'Not in tradeable items list',
        items: skippedItems.slice(0, 10).map(i => i.type_name),
      } : null,
      debug: {
        items_requested: assets.length,
        items_with_market_data: opportunities.filter(o => o.all_time_high > 0).length,
        items_missing_data: opportunities.filter(o => o.all_time_high === 0).map(o => ({ name: o.type_name, type_id: o.type_id })).slice(0, 10),
      },
    })

  } catch (error) {
    console.error('[Sell Opportunities] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze sell opportunities' },
      { status: 500 }
    )
  }
}

