import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const ESI_BASE = 'https://esi.evetech.net'
const REGION_THE_FORGE = 10000002 // Jita's region

// Batch configuration
const CONCURRENT_REQUESTS = 50 // Number of parallel ESI requests
const BATCH_DELAY_MS = 100 // Delay between batches to respect rate limits
const SUPABASE_BATCH_SIZE = 1000 // Max rows per Supabase upsert

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

interface ESIMarketHistoryEntry {
  average: number
  date: string
  highest: number
  lowest: number
  order_count: number
  volume: number
}

interface MarketHistoryRow {
  type_id: number
  date: string
  average: number
  highest: number
  lowest: number
  order_count: number
  volume: number
  region_id: number
  updated_at: string
}

interface FetchResult {
  typeId: number
  success: boolean
  entries: number
  error?: string
}

/**
 * Read tradeable items from JSONL file
 */
async function readTradeableItems(): Promise<TradeableItem[]> {
  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Tradeable items file not found: ${filePath}`)
  }

  const items: TradeableItem[] = []
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        items.push(JSON.parse(line) as TradeableItem)
      } catch {
        // Skip invalid lines
      }
    }
  }

  return items
}

/**
 * Fetch market history for a single type from ESI
 */
async function fetchMarketHistory(
  typeId: number,
  regionId: number
): Promise<{ entries: ESIMarketHistoryEntry[]; error?: string }> {
  try {
    const response = await fetch(
      `${ESI_BASE}/markets/${regionId}/history/?type_id=${typeId}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Compatibility-Date': '2025-11-06',
          'User-Agent': 'EveIndustryTracker/1.0'
        }
      }
    )

    if (!response.ok) {
      // 404 means no market data for this item - not an error, just empty
      if (response.status === 404) {
        return { entries: [] }
      }
      return { entries: [], error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { entries: data }
  } catch (error) {
    return { 
      entries: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Process items in batches with concurrency control
 */
async function processBatches(
  items: TradeableItem[],
  regionId: number,
  sevenDaysAgoStr: string
): Promise<{ rows: MarketHistoryRow[]; results: FetchResult[] }> {
  const allRows: MarketHistoryRow[] = []
  const allResults: FetchResult[] = []
  const now = new Date().toISOString()

  // Process in batches of CONCURRENT_REQUESTS
  for (let i = 0; i < items.length; i += CONCURRENT_REQUESTS) {
    const batch = items.slice(i, i + CONCURRENT_REQUESTS)
    
    // Fetch all items in this batch concurrently
    const batchPromises = batch.map(async (item) => {
      const { entries, error } = await fetchMarketHistory(item.typeId, regionId)
      
      if (error) {
        return {
          result: { typeId: item.typeId, success: false, entries: 0, error } as FetchResult,
          rows: [] as MarketHistoryRow[]
        }
      }

      // Filter to last 7 days
      const recentEntries = entries.filter(e => e.date >= sevenDaysAgoStr)
      
      // Convert to rows
      const rows: MarketHistoryRow[] = recentEntries.map(entry => ({
        type_id: item.typeId,
        date: entry.date,
        average: entry.average,
        highest: entry.highest,
        lowest: entry.lowest,
        order_count: entry.order_count,
        volume: entry.volume,
        region_id: regionId,
        updated_at: now
      }))

      return {
        result: { typeId: item.typeId, success: true, entries: rows.length } as FetchResult,
        rows
      }
    })

    const batchResults = await Promise.all(batchPromises)
    
    for (const { result, rows } of batchResults) {
      allResults.push(result)
      allRows.push(...rows)
    }

    // Log progress
    const processed = Math.min(i + CONCURRENT_REQUESTS, items.length)
    console.log(`[Market History] Processed ${processed}/${items.length} items (${allRows.length} rows)`)

    // Delay between batches to respect rate limits
    if (i + CONCURRENT_REQUESTS < items.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  return { rows: allRows, results: allResults }
}

/**
 * Upsert rows to Supabase in batches
 */
async function upsertToSupabase(rows: MarketHistoryRow[]): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createClient()
  let inserted = 0
  const errors: string[] = []

  // Process in batches of SUPABASE_BATCH_SIZE
  for (let i = 0; i < rows.length; i += SUPABASE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SUPABASE_BATCH_SIZE)
    
    const { error } = await supabase
      .from('market_history')
      .upsert(batch, {
        onConflict: 'type_id,date,region_id',
        ignoreDuplicates: false
      })

    if (error) {
      errors.push(`Batch ${Math.floor(i / SUPABASE_BATCH_SIZE) + 1}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  return { inserted, errors }
}

/**
 * GET /api/esi/market-history
 * 
 * Fetches market history for all tradeable items from ESI
 * and stores the last 7 days in Supabase.
 * 
 * This endpoint is designed to be called by a weekly cron job.
 * 
 * Query Parameters:
 *   - region_id (optional): The region ID. Defaults to 10000002 (The Forge/Jita)
 *   - limit (optional): Limit number of items to process (for testing)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const regionId = parseInt(searchParams.get('region_id') || String(REGION_THE_FORGE))
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

  console.log(`[Market History] Starting batch fetch for region ${regionId}`)

  try {
    // Step 1: Read tradeable items
    let items = await readTradeableItems()
    console.log(`[Market History] Loaded ${items.length} tradeable items`)

    // Apply limit if specified (for testing)
    if (limit && limit > 0) {
      items = items.slice(0, limit)
      console.log(`[Market History] Limited to ${items.length} items`)
    }

    // Step 2: Calculate date filter (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    // Step 3: Fetch market history from ESI in batches
    console.log(`[Market History] Fetching from ESI (${CONCURRENT_REQUESTS} concurrent)...`)
    const { rows, results } = await processBatches(items, regionId, sevenDaysAgoStr)

    const esiFetchTime = Date.now() - startTime
    console.log(`[Market History] ESI fetch complete in ${esiFetchTime}ms`)

    // Step 4: Upsert to Supabase
    console.log(`[Market History] Upserting ${rows.length} rows to Supabase...`)
    const supabaseStartTime = Date.now()
    const { inserted, errors: supabaseErrors } = await upsertToSupabase(rows)
    const supabaseTime = Date.now() - supabaseStartTime

    // Step 5: Calculate stats
    const successfulFetches = results.filter(r => r.success).length
    const failedFetches = results.filter(r => !r.success)
    const itemsWithData = results.filter(r => r.success && r.entries > 0).length
    const totalTime = Date.now() - startTime

    console.log(`[Market History] Complete! ${inserted} rows in ${totalTime}ms`)

    return NextResponse.json({
      success: true,
      summary: {
        total_items: items.length,
        successful_fetches: successfulFetches,
        failed_fetches: failedFetches.length,
        items_with_market_data: itemsWithData,
        total_rows: rows.length,
        rows_inserted: inserted
      },
      timing: {
        esi_fetch_ms: esiFetchTime,
        supabase_upsert_ms: supabaseTime,
        total_ms: totalTime
      },
      config: {
        region_id: regionId,
        concurrent_requests: CONCURRENT_REQUESTS,
        date_from: sevenDaysAgoStr
      },
      errors: {
        esi_failures: failedFetches.slice(0, 10), // Show first 10 failures
        supabase_errors: supabaseErrors
      }
    })

  } catch (error) {
    console.error('[Market History] Fatal error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch market history',
        timing: { total_ms: Date.now() - startTime }
      },
      { status: 500 }
    )
  }
}

