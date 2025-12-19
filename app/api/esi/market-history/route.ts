import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const ESI_BASE = 'https://esi.evetech.net'
const REGION_THE_FORGE = 10000002 // Jita's region

// Batch configuration
const CONCURRENT_REQUESTS = 10 // Number of parallel ESI requests (reduced to avoid rate limits)
const BATCH_DELAY_MS = 500 // Delay between batches to respect rate limits
const SUPABASE_BATCH_SIZE = 1000 // Max rows per Supabase upsert

// Fetch modes
type FetchMode = 'initial' | 'daily' | 'legacy' | 'verify' | 'test_assets' | 'backfill'
const DEFAULT_INITIAL_DAYS = 365
const DEFAULT_LEGACY_DAYS = 7
const DEFAULT_TOTAL_CHUNKS = 24 // Split items into 24 chunks for hourly cron jobs

// Debug file paths
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'market-history-cache.jsonl')
const REPORT_FILE_PATH = path.join(process.cwd(), 'data', 'import-report.json')

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

interface ImportReport {
  timestamp: string
  mode: string
  total_items: number
  successful: number
  failed: number
  items_with_data: number
  total_rows: number
  by_error: Record<string, number>
  items: Array<{
    type_id: number
    rows: number
    status: 'success' | 'error' | 'no_data'
    error?: string
  }>
}

/**
 * Clear the local cache file (start fresh)
 */
function clearLocalCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      fs.unlinkSync(CACHE_FILE_PATH)
    }
  } catch (error) {
    console.error('[Market History] Failed to clear cache:', error)
  }
}

/**
 * Append rows to local JSONL cache file
 */
function appendToLocalCache(rows: MarketHistoryRow[]): void {
  try {
    const lines = rows.map(row => JSON.stringify(row)).join('\n')
    fs.appendFileSync(CACHE_FILE_PATH, lines + '\n', { encoding: 'utf-8' })
  } catch (error) {
    console.error('[Market History] Failed to write to cache:', error)
  }
}

/**
 * Generate and save import report
 */
function saveImportReport(
  results: FetchResult[],
  mode: string,
  totalRows: number
): ImportReport {
  const report: ImportReport = {
    timestamp: new Date().toISOString(),
    mode,
    total_items: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    items_with_data: results.filter(r => r.success && r.entries > 0).length,
    total_rows: totalRows,
    by_error: {},
    items: []
  }

  // Count errors by type
  for (const r of results) {
    if (r.error) {
      report.by_error[r.error] = (report.by_error[r.error] || 0) + 1
    }
  }

  // Add per-item status
  for (const r of results) {
    report.items.push({
      type_id: r.typeId,
      rows: r.entries,
      status: r.error ? 'error' : (r.entries > 0 ? 'success' : 'no_data'),
      error: r.error
    })
  }

  // Save to file
  try {
    fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(report, null, 2), { encoding: 'utf-8' })
    console.log(`[Market History] Import report saved to ${REPORT_FILE_PATH}`)
  } catch (error) {
    console.error('[Market History] Failed to save report:', error)
  }

  return report
}

/**
 * Verify specific type_ids exist in the database
 */
async function verifyTypeIdsInDB(typeIds: number[], regionId: number): Promise<{
  found: Array<{ type_id: number; row_count: number; date_range: { min: string; max: string } }>
  missing: number[]
}> {
  const supabase = createClient()
  const found: Array<{ type_id: number; row_count: number; date_range: { min: string; max: string } }> = []
  const missing: number[] = []

  for (const typeId of typeIds) {
    const { data, error } = await supabase
      .from('market_history')
      .select('date')
      .eq('type_id', typeId)
      .eq('region_id', regionId)
      .order('date', { ascending: true })

    if (error) {
      console.error(`[Market History] Verify error for type ${typeId}:`, error)
      missing.push(typeId)
      continue
    }

    if (!data || data.length === 0) {
      missing.push(typeId)
    } else {
      found.push({
        type_id: typeId,
        row_count: data.length,
        date_range: {
          min: data[0].date,
          max: data[data.length - 1].date
        }
      })
    }
  }

  return { found, missing }
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
  regionId: number,
  retryCount = 0
): Promise<{ entries: ESIMarketHistoryEntry[]; error?: string }> {
  const MAX_RETRIES = 5 // For server errors only
  const BASE_RATE_LIMIT_DELAY = 15000 // 15 seconds base wait on rate limit
  
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
      
      // 420 means rate limited - ALWAYS wait and retry (infinite retries)
      if (response.status === 420) {
        // Exponential backoff: 15s, 30s, 60s, 120s, then cap at 120s
        const waitTime = Math.min(BASE_RATE_LIMIT_DELAY * Math.pow(2, retryCount), 120000)
        console.log(`[Market History] RATE LIMITED on type ${typeId} - waiting ${waitTime / 1000}s (attempt ${retryCount + 1})`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return fetchMarketHistory(typeId, regionId, retryCount + 1)
      }
      
      // 502/503/504 - server errors, retry with limit
      if ([502, 503, 504].includes(response.status) && retryCount < MAX_RETRIES) {
        const waitTime = 2000 * (retryCount + 1)
        console.log(`[Market History] Server error ${response.status} on type ${typeId}, waiting ${waitTime / 1000}s...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return fetchMarketHistory(typeId, regionId, retryCount + 1)
      }
      
      return { entries: [], error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { entries: data }
  } catch (error) {
    // Network errors - retry with limit
    if (retryCount < MAX_RETRIES) {
      const waitTime = 2000 * (retryCount + 1)
      console.log(`[Market History] Network error on type ${typeId}, waiting ${waitTime / 1000}s...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return fetchMarketHistory(typeId, regionId, retryCount + 1)
    }
    return { 
      entries: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get date string for N days ago
 */
function getDateStringDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

/**
 * Get yesterday's date string
 */
function getYesterdayDateString(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

/**
 * Process items in batches with concurrency control
 */
async function processBatches(
  items: TradeableItem[],
  regionId: number,
  fromDateStr: string,
  toDateStr?: string, // Optional: for daily mode, only fetch a single day
  saveToCache = false // Whether to save fetched data to local cache
): Promise<{ rows: MarketHistoryRow[]; results: FetchResult[] }> {
  const allRows: MarketHistoryRow[] = []
  const allResults: FetchResult[] = []
  const now = new Date().toISOString()

  // Clear cache if saving
  if (saveToCache) {
    clearLocalCache()
    console.log(`[Market History] Local cache cleared, will save to ${CACHE_FILE_PATH}`)
  }

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

      // Filter entries based on date range
      let filteredEntries: ESIMarketHistoryEntry[]
      if (toDateStr) {
        // Daily mode: only include entries for the specific date
        filteredEntries = entries.filter(e => e.date === toDateStr)
      } else {
        // Initial/Legacy mode: include all entries from fromDateStr onwards
        filteredEntries = entries.filter(e => e.date >= fromDateStr)
      }
      
      // Convert to rows
      const rows: MarketHistoryRow[] = filteredEntries.map(entry => ({
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
    
    const batchRows: MarketHistoryRow[] = []
    for (const { result, rows } of batchResults) {
      allResults.push(result)
      allRows.push(...rows)
      batchRows.push(...rows)
      if (result.error) {
        // Log non-404 errors immediately (404 is expected for many items)
        if (!result.error.includes('404')) {
          console.log(`[Market History] ERROR for type ${result.typeId}: ${result.error}`)
        }
      }
    }

    // Save batch to local cache
    if (saveToCache && batchRows.length > 0) {
      appendToLocalCache(batchRows)
    }

    // Log progress with error count
    const processed = Math.min(i + CONCURRENT_REQUESTS, items.length)
    const totalErrors = allResults.filter(r => r.error).length
    console.log(`[Market History] Processed ${processed}/${items.length} items (${allRows.length} rows, ${totalErrors} errors)`)
    
    // Log error breakdown every 500 items
    if (processed % 500 === 0 || processed === items.length) {
      const errorCounts: Record<string, number> = {}
      for (const r of allResults) {
        if (r.error) {
          errorCounts[r.error] = (errorCounts[r.error] || 0) + 1
        }
      }
      if (Object.keys(errorCounts).length > 0) {
        console.log(`[Market History] Error breakdown: ${JSON.stringify(errorCounts)}`)
      }
    }

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

// Category name to ID mapping for filtering
const CATEGORY_NAME_TO_ID: Record<string, number> = {
  'ship': 6,
  'ships': 6,
  'module': 7,
  'modules': 7,
  'charge': 8,
  'charges': 8,
  'ammo': 8,
  'drone': 18,
  'drones': 18,
  'implant': 20,
  'implants': 20,
  'booster': 20,
  'boosters': 20,
  'deployable': 22,
  'deployables': 22,
  'subsystem': 32,
  'subsystems': 32,
  'fighter': 87,
  'fighters': 87
}

/**
 * Parameters for background market history processing
 */
interface MarketHistoryParams {
  mode: FetchMode
  days: number
  regionId: number
  limit?: number
  chunk?: number
  totalChunks: number
  categoryFilter: Set<number> | null
  saveCache: boolean
  saveReport: boolean
  skipDb: boolean
}

/**
 * Process market history in the background (called via after())
 * This function handles the heavy ESI fetching and database operations
 */
async function processMarketHistoryBackground(params: MarketHistoryParams): Promise<void> {
  const startTime = Date.now()
  const { mode, days, regionId, limit, chunk, totalChunks, categoryFilter, saveCache, saveReport, skipDb } = params

  try {
    // Step 1: Read tradeable items
    let items = await readTradeableItems()
    console.log(`[Market History BG] Loaded ${items.length} tradeable items`)

    // Apply category filter if specified
    if (categoryFilter) {
      const beforeCount = items.length
      items = items.filter(item => categoryFilter.has(item.categoryId))
      console.log(`[Market History BG] Filtered to ${items.length} items (from ${beforeCount}) by categories: [${Array.from(categoryFilter).join(', ')}]`)
      
      // Log breakdown by category
      const categoryBreakdown: Record<string, number> = {}
      for (const item of items) {
        categoryBreakdown[item.categoryName] = (categoryBreakdown[item.categoryName] || 0) + 1
      }
      console.log(`[Market History BG] Category breakdown: ${JSON.stringify(categoryBreakdown)}`)
    }

    // Apply limit if specified (for testing)
    if (limit && limit > 0) {
      items = items.slice(0, limit)
      console.log(`[Market History BG] Limited to ${items.length} items`)
    }

    // Apply chunk filter if specified (for distributed cron jobs)
    if (chunk !== undefined) {
      const beforeCount = items.length
      items = items.filter(item => item.typeId % totalChunks === chunk)
      console.log(`[Market History BG] Chunk ${chunk}/${totalChunks}: filtered to ${items.length} items (from ${beforeCount})`)
    }

    // Step 2: Calculate date filter based on mode
    let fromDateStr: string
    let toDateStr: string | undefined
    let modeDescription: string

    switch (mode) {
      case 'initial':
        fromDateStr = getDateStringDaysAgo(days)
        toDateStr = undefined
        modeDescription = `initial (last ${days} days)`
        break
      
      case 'backfill':
        fromDateStr = getDateStringDaysAgo(days)
        toDateStr = undefined
        modeDescription = `backfill (last ${days} days${chunk !== undefined ? `, chunk ${chunk}/${totalChunks}` : ''})`
        break
      
      case 'daily':
        const yesterday = getYesterdayDateString()
        fromDateStr = yesterday
        toDateStr = yesterday
        modeDescription = `daily (${yesterday} only${chunk !== undefined ? `, chunk ${chunk}/${totalChunks}` : ''})`
        break
      
      case 'legacy':
      default:
        fromDateStr = getDateStringDaysAgo(DEFAULT_LEGACY_DAYS)
        toDateStr = undefined
        modeDescription = `legacy (last ${DEFAULT_LEGACY_DAYS} days)`
        break
    }

    console.log(`[Market History BG] Mode: ${modeDescription}, from: ${fromDateStr}${toDateStr ? `, to: ${toDateStr}` : ''}`)

    // Step 3: Fetch market history from ESI in batches
    console.log(`[Market History BG] Fetching from ESI (${CONCURRENT_REQUESTS} concurrent)...`)
    const { rows, results } = await processBatches(items, regionId, fromDateStr, toDateStr, saveCache)

    const esiFetchTime = Date.now() - startTime
    console.log(`[Market History BG] ESI fetch complete in ${esiFetchTime}ms`)

    // Step 4: Save import report if requested
    if (saveReport) {
      saveImportReport(results, mode, rows.length)
    }

    // Step 5: Upsert to Supabase unless skip_db is set
    let inserted = 0

    if (!skipDb && rows.length > 0) {
      console.log(`[Market History BG] Upserting ${rows.length} rows to Supabase...`)
      const supabaseStartTime = Date.now()
      const upsertResult = await upsertToSupabase(rows)
      inserted = upsertResult.inserted
      const supabaseTime = Date.now() - supabaseStartTime
      
      if (upsertResult.errors.length > 0) {
        console.error(`[Market History BG] Supabase errors: ${JSON.stringify(upsertResult.errors)}`)
      }
      console.log(`[Market History BG] Supabase upsert complete in ${supabaseTime}ms`)
    } else if (skipDb) {
      console.log(`[Market History BG] Skipping database (skip_db=true)`)
    }

    // Step 6: Log final stats
    const successfulFetches = results.filter(r => r.success).length
    const failedFetches = results.filter(r => !r.success).length
    const itemsWithData = results.filter(r => r.success && r.entries > 0).length
    const totalTime = Date.now() - startTime

    console.log(`[Market History BG] Complete! mode=${mode}, region=${regionId}, chunk=${chunk ?? 'all'}/${totalChunks}`)
    console.log(`[Market History BG] Stats: ${successfulFetches} success, ${failedFetches} failed, ${itemsWithData} with data, ${inserted} rows inserted, ${totalTime}ms total`)

  } catch (error) {
    console.error('[Market History BG] Fatal error in background processing:', error)
  }
}

/**
 * GET /api/esi/market-history
 * 
 * Fetches market history for all tradeable items from ESI and stores in Supabase.
 * 
 * Modes:
 *   - initial: Fetch last N days (default 365) for initial data population
 *   - daily: Fetch only yesterday's data (for daily cron job - efficient append)
 *   - backfill: Like initial but designed for manual chunked backfill (smaller default chunks)
 *   - legacy: Fetch last 7 days (original behavior)
 *   - verify: Check if specific type_ids exist in database (no ESI calls)
 *   - test_assets: Fetch only specific type_ids (for testing)
 * 
 * Query Parameters:
 *   - mode (optional): 'initial' | 'daily' | 'backfill' | 'legacy' | 'verify' | 'test_assets'. Defaults to 'legacy'
 *   - days (optional): Number of days for 'initial'/'backfill' modes. Defaults to 365
 *   - region_id (optional): The region ID. Defaults to 10000002 (The Forge/Jita)
 *   - chunk (optional): Which chunk to process (0 to total_chunks-1). Used with daily cron jobs.
 *   - total_chunks (optional): Total number of chunks to split items into. Defaults to 24.
 *                              Each item is assigned to chunk = typeId % total_chunks (deterministic, no duplicates/misses)
 *   - limit (optional): Limit number of items to process (for testing)
 *   - type_ids (optional): Comma-separated type_ids for 'verify' or 'test_assets' modes
 *   - categories (optional): Comma-separated category names or IDs to filter items
 *                           Names: ship, module, charge, drone, implant, deployable, subsystem, fighter
 *                           IDs: 6, 7, 8, 18, 20, 22, 32, 87
 *   - save_cache (optional): 'true' to save fetched data to local JSONL file
 *   - save_report (optional): 'true' to generate import report JSON
 *   - skip_db (optional): 'true' to fetch without storing to database (cache only)
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET for cron job authentication (Vercel Cron uses Authorization: Bearer)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const mode = (searchParams.get('mode') || 'legacy') as FetchMode
  const days = parseInt(searchParams.get('days') || String(DEFAULT_INITIAL_DAYS))
  const regionId = parseInt(searchParams.get('region_id') || String(REGION_THE_FORGE))
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
  const typeIdsParam = searchParams.get('type_ids')
  const categoriesParam = searchParams.get('categories')
  const saveCache = searchParams.get('save_cache') === 'true'
  const saveReport = searchParams.get('save_report') === 'true'
  const skipDb = searchParams.get('skip_db') === 'true'
  
  // Chunking parameters for distributed cron jobs
  const chunkParam = searchParams.get('chunk')
  const totalChunksParam = searchParams.get('total_chunks')
  const chunk = chunkParam !== null ? parseInt(chunkParam) : undefined
  const totalChunks = totalChunksParam !== null ? parseInt(totalChunksParam) : DEFAULT_TOTAL_CHUNKS

  // Debug: Log raw request URL and all query parameters
  console.log(`[Market History] Request URL: ${request.url}`)
  console.log(`[Market History] Query params: ${JSON.stringify(Object.fromEntries(searchParams.entries()))}`)
  console.log(`[Market History] Parsed - chunk: ${chunkParam} (${typeof chunkParam}), total_chunks: ${totalChunksParam} (${typeof totalChunksParam})`)

  // Parse categories filter
  let categoryFilter: Set<number> | null = null
  if (categoriesParam) {
    categoryFilter = new Set<number>()
    for (const cat of categoriesParam.split(',')) {
      const trimmed = cat.trim().toLowerCase()
      // Try as category name first
      if (CATEGORY_NAME_TO_ID[trimmed]) {
        categoryFilter.add(CATEGORY_NAME_TO_ID[trimmed])
      } else {
        // Try as numeric ID
        const numId = parseInt(trimmed)
        if (!isNaN(numId)) {
          categoryFilter.add(numId)
        }
      }
    }
    if (categoryFilter.size === 0) {
      categoryFilter = null
    }
  }

  console.log(`[Market History] Starting batch fetch - mode: ${mode}, region: ${regionId}${chunk !== undefined ? `, chunk: ${chunk}/${totalChunks}` : ''}${categoryFilter ? `, categories: [${Array.from(categoryFilter).join(', ')}]` : ''}`)

  try {
    // Handle VERIFY mode - just check DB, no ESI calls
    if (mode === 'verify') {
      if (!typeIdsParam) {
        return NextResponse.json(
          { error: 'type_ids parameter required for verify mode (comma-separated)' },
          { status: 400 }
        )
      }
      
      const typeIds = typeIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      console.log(`[Market History] Verifying ${typeIds.length} type_ids in database...`)
      
      const { found, missing } = await verifyTypeIdsInDB(typeIds, regionId)
      
      return NextResponse.json({
        success: true,
        mode: 'verify',
        region_id: regionId,
        requested: typeIds.length,
        found_count: found.length,
        missing_count: missing.length,
        found,
        missing,
        timing: { total_ms: Date.now() - startTime }
      })
    }

    // Handle TEST_ASSETS mode - fetch only specific type_ids
    if (mode === 'test_assets') {
      if (!typeIdsParam) {
        return NextResponse.json(
          { error: 'type_ids parameter required for test_assets mode (comma-separated)' },
          { status: 400 }
        )
      }
      
      const typeIds = typeIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      console.log(`[Market History] Testing ${typeIds.length} specific type_ids...`)
      
      // Create fake TradeableItem objects for the specified type_ids
      const items: TradeableItem[] = typeIds.map(typeId => ({
        typeId,
        name: `Item ${typeId}`,
        groupId: 0,
        groupName: 'Unknown',
        categoryId: 0,
        categoryName: 'Unknown',
        volume: 0,
        marketGroupId: null
      }))
      
      // Use initial mode date range for testing
      const fromDateStr = getDateStringDaysAgo(days)
      
      console.log(`[Market History] Fetching from ESI for ${items.length} items...`)
      const { rows, results } = await processBatches(items, regionId, fromDateStr, undefined, saveCache)
      
      const esiFetchTime = Date.now() - startTime
      console.log(`[Market History] ESI fetch complete in ${esiFetchTime}ms`)
      
      // Save report if requested
      let report: ImportReport | null = null
      if (saveReport) {
        report = saveImportReport(results, 'test_assets', rows.length)
      }
      
      // Upsert to Supabase unless skip_db is set
      let inserted = 0
      let supabaseErrors: string[] = []
      let supabaseTime = 0
      
      if (!skipDb && rows.length > 0) {
        console.log(`[Market History] Upserting ${rows.length} rows to Supabase...`)
        const supabaseStartTime = Date.now()
        const upsertResult = await upsertToSupabase(rows)
        inserted = upsertResult.inserted
        supabaseErrors = upsertResult.errors
        supabaseTime = Date.now() - supabaseStartTime
      } else if (skipDb) {
        console.log(`[Market History] Skipping database (skip_db=true)`)
      }
      
      const totalTime = Date.now() - startTime
      
      return NextResponse.json({
        success: true,
        mode: 'test_assets',
        type_ids_tested: typeIds,
        summary: {
          total_items: items.length,
          successful_fetches: results.filter(r => r.success).length,
          failed_fetches: results.filter(r => !r.success).length,
          items_with_data: results.filter(r => r.success && r.entries > 0).length,
          total_rows: rows.length,
          rows_inserted: inserted,
          skip_db: skipDb
        },
        results: results.map(r => ({
          type_id: r.typeId,
          success: r.success,
          rows_fetched: r.entries,
          error: r.error
        })),
        timing: {
          esi_fetch_ms: esiFetchTime,
          supabase_upsert_ms: supabaseTime,
          total_ms: totalTime
        },
        files: {
          cache_saved: saveCache ? CACHE_FILE_PATH : null,
          report_saved: saveReport ? REPORT_FILE_PATH : null
        },
        errors: {
          supabase_errors: supabaseErrors
        }
      })
    }

    // Standard modes: initial, daily, legacy, backfill
    // These are typically triggered by cron jobs, so we use after() to process in background
    // This allows us to return immediately and avoid cron-job.org's 30 second timeout
    
    // Validate chunk parameter early
    if (chunk !== undefined && (chunk < 0 || chunk >= totalChunks)) {
      return NextResponse.json(
        { error: `Invalid chunk: ${chunk}. Must be between 0 and ${totalChunks - 1}` },
        { status: 400 }
      )
    }

    // Build mode description for response
    let modeDescription: string
    switch (mode) {
      case 'initial':
        modeDescription = `initial (last ${days} days)`
        break
      case 'backfill':
        modeDescription = `backfill (last ${days} days${chunk !== undefined ? `, chunk ${chunk}/${totalChunks}` : ''})`
        break
      case 'daily':
        modeDescription = `daily (yesterday only${chunk !== undefined ? `, chunk ${chunk}/${totalChunks}` : ''})`
        break
      case 'legacy':
      default:
        modeDescription = `legacy (last ${DEFAULT_LEGACY_DAYS} days)`
        break
    }

    // Build params for background processing
    const backgroundParams: MarketHistoryParams = {
      mode,
      days,
      regionId,
      limit,
      chunk,
      totalChunks,
      categoryFilter,
      saveCache,
      saveReport,
      skipDb
    }

    // Schedule background processing using after()
    // This runs AFTER the response is sent, allowing cron-job.org to close connection
    after(async () => {
      await processMarketHistoryBackground(backgroundParams)
    })

    console.log(`[Market History] Background job scheduled - mode: ${mode}, region: ${regionId}, chunk: ${chunk ?? 'all'}/${totalChunks}`)

    // Return immediately with job info
    // cron-job.org will receive this within seconds, avoiding the 30s timeout
    return NextResponse.json({
      status: 'started',
      message: 'Processing in background. Check Vercel logs for progress.',
      job: {
        mode: mode,
        mode_description: modeDescription,
        region_id: regionId,
        chunk: chunk ?? null,
        total_chunks: totalChunks,
        category_filter: categoryFilter ? Array.from(categoryFilter) : null,
        days: mode === 'initial' || mode === 'backfill' ? days : undefined,
        skip_db: skipDb,
        save_cache: saveCache,
        save_report: saveReport
      },
      note: 'Results will be logged. Check Vercel Function logs for "[Market History BG]" entries.'
    })

  } catch (error) {
    console.error('[Market History] Fatal error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch market history',
        mode: mode,
        timing: { total_ms: Date.now() - startTime }
      },
      { status: 500 }
    )
  }
}

