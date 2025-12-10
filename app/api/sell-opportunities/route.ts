import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAppraisal } from '@/lib/janice'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// Cache for tradeable type IDs
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

interface MarketStats {
  type_id: number
  all_time_high: number
  mean_price: number
}

/**
 * Get market statistics (ATH and mean price) from market_history for given type_ids
 * Uses RPC function for efficiency, falls back to per-item pagination if RPC fails
 */
async function getMarketStats(typeIds: number[]): Promise<Map<number, MarketStats>> {
  const supabase = createClient()
  const result = new Map<number, MarketStats>()

  if (typeIds.length === 0) return result

  console.log(`[Sell Opportunities] Fetching market stats for ${typeIds.length} type_ids...`)

  // Try RPC function first (much faster - single query)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_sell_statistics', {
      p_type_ids: typeIds,
      p_region_id: 10000002  // The Forge (Jita)
    })

  if (!rpcError && rpcData && rpcData.length > 0) {
    // RPC succeeded - use the results
    console.log(`[Sell Opportunities] RPC returned ${rpcData.length} results`)
    
    for (const row of rpcData as { type_id: number; all_time_high: number; mean_price: number }[]) {
      result.set(row.type_id, {
        type_id: row.type_id,
        all_time_high: row.all_time_high,
        mean_price: row.mean_price,
      })
    }
  } else {
    // RPC failed - fall back to per-item pagination
    if (rpcError) {
      console.warn(`[Sell Opportunities] RPC failed, using fallback: ${rpcError.message}`)
    } else {
      console.warn(`[Sell Opportunities] RPC returned no data, using fallback`)
    }
    
    return await getMarketStatsFallback(typeIds, supabase)
  }

  console.log(`[Sell Opportunities] Market stats: requested ${typeIds.length} type_ids, found data for ${result.size}`)
  
  // Log items without data for debugging
  const missingIds = typeIds.filter(id => !result.has(id))
  if (missingIds.length > 0) {
    console.log(`[Sell Opportunities] Missing market data for type_ids: ${missingIds.slice(0, 10).join(', ')}${missingIds.length > 10 ? '...' : ''}`)
  }

  return result
}

/**
 * Fallback: Query each type_id individually with pagination
 * Used when RPC function is not available
 */
async function getMarketStatsFallback(
  typeIds: number[],
  supabase: ReturnType<typeof createClient>
): Promise<Map<number, MarketStats>> {
  const result = new Map<number, MarketStats>()
  const statsByType = new Map<number, { maxHigh: number; sumAvg: number; count: number }>()

  console.log(`[Sell Opportunities] Fallback: fetching stats for ${typeIds.length} type_ids individually...`)

  for (const typeId of typeIds) {
    // Paginate to get all rows for this type_id
    const allRows: { highest: number; average: number }[] = []
    let page = 0
    const PAGE_SIZE = 1000
    
    while (true) {
      const { data, error } = await supabase
        .from('market_history')
        .select('highest, average')
        .eq('type_id', typeId)
        .eq('region_id', 10000002) // The Forge (Jita)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (error) {
        console.error(`[Sell Opportunities] Supabase error for type ${typeId}:`, error)
        break
      }
      
      if (!data || data.length === 0) {
        break
      }
      
      allRows.push(...data)
      
      // If we got less than PAGE_SIZE, we've reached the end
      if (data.length < PAGE_SIZE) {
        break
      }
      
      page++
    }
    
    // Aggregate this type_id's data
    if (allRows.length > 0) {
      let maxHigh = 0
      let sumAvg = 0
      
      for (const row of allRows) {
        if (row.highest > maxHigh) {
          maxHigh = row.highest
        }
        sumAvg += row.average
      }
      
      statsByType.set(typeId, {
        maxHigh,
        sumAvg,
        count: allRows.length,
      })
    }
  }
  
  console.log(`[Sell Opportunities] Fallback fetched stats for ${statsByType.size}/${typeIds.length} type_ids`)

  // Convert to final result
  for (const [typeId, stats] of statsByType) {
    result.set(typeId, {
      type_id: typeId,
      all_time_high: stats.maxHigh,
      mean_price: stats.count > 0 ? stats.sumAvg / stats.count : 0,
    })
  }

  // Log items without data for debugging
  const missingIds = typeIds.filter(id => !result.has(id))
  if (missingIds.length > 0) {
    console.log(`[Sell Opportunities] Missing market data for type_ids: ${missingIds.slice(0, 10).join(', ')}${missingIds.length > 10 ? '...' : ''}`)
  }

  return result
}

/**
 * Get current Jita sell prices using Janice API
 */
async function getCurrentPrices(items: AssetInput[]): Promise<Map<number, number>> {
  const result = new Map<number, number>()

  if (items.length === 0) return result

  try {
    // Build input for Janice API - one item per line
    const input = items.map(item => `${item.type_name} x1`).join('\n')
    const appraisal = await createAppraisal(input)

    // Map results back by type_id
    for (const appItem of appraisal.items) {
      result.set(appItem.typeId, appItem.sellPrice)
    }
  } catch (error) {
    console.error('[Sell Opportunities] Janice API error:', error)
    // Return empty map - prices will show as 0
  }

  return result
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

    // Get type_ids for queries
    const typeIds = assets.map(a => a.type_id)

    // Fetch market stats and current prices in parallel
    const [marketStatsMap, currentPricesMap] = await Promise.all([
      getMarketStats(typeIds),
      getCurrentPrices(assets),
    ])

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

