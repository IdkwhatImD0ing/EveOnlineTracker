import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Readable } from 'stream'
import unbzip2 from 'unbzip2-stream'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

/**
 * EVERef bulk market history import.
 *
 * Replaces the old per-item ESI scrape (52 cron jobs, ~21k ESI calls/day):
 * EVERef publishes the exact same data as one compressed CSV per day at
 * https://data.everef.net/market-history/. One download covers every region.
 *
 * Publication timing (measured Jul 2026): the file for EVE-date D appears on
 * D+1 after ~11:05 UTC but fills in gradually as EVERef's rate-limited scrape
 * progresses - files were observed still gaining rows on D+2 through D+5.
 * Upserts are idempotent, so each run re-imports the last DEFAULT_DAYS_BACK
 * dates and stragglers self-heal on later runs.
 */

// Make the function's time budget explicit; all work runs inside after()
export const maxDuration = 300

const EVEREF_BASE = 'https://data.everef.net/market-history'
const DOWNLOAD_TIMEOUT_MS = 60_000

// Regions the app tracks (The Forge/Jita, Vale of the Silent, Deklein)
const TRACKED_REGIONS = new Set([10000002, 10000003, 10000035])

// Keep a small buffer over the 90-day window the analytics RPCs query
const RETENTION_DAYS = 100

// Files were observed completing as late as D+5 - cover the whole window
const DEFAULT_DAYS_BACK = 6
const MAX_DAYS_BACK = 30
const SUPABASE_BATCH_SIZE = 1000
const ATH_BATCH_SIZE = 2000

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

/**
 * Load the tradeable type_id universe from the SDE dump (same filter the old
 * ESI importer applied, so the table keeps the same item population).
 */
async function loadTradeableTypeIds(): Promise<Set<number>> {
  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')

  if (!fs.existsSync(filePath)) {
    throw new Error(`Tradeable items file not found: ${filePath}`)
  }

  const typeIds = new Set<number>()
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const item = JSON.parse(line) as { typeId: number }
      if (item.typeId) typeIds.add(item.typeId)
    } catch {
      // Skip invalid lines
    }
  }

  return typeIds
}

function isoDateDaysAgoUTC(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().split('T')[0]
}

/**
 * Download and decompress one EVERef daily dump.
 * Returns null when the file is not published yet (404).
 */
async function downloadDailyDump(dateStr: string): Promise<string | null> {
  const year = dateStr.slice(0, 4)
  const url = `${EVEREF_BASE}/${year}/market-history-${dateStr}.csv.bz2`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'EveIndustryTracker/1.0' },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
  })

  if (response.status === 404) return null
  if (!response.ok || !response.body) {
    throw new Error(`EVERef download failed: HTTP ${response.status} for ${url}`)
  }

  const nodeStream = Readable.fromWeb(response.body as unknown as import('stream/web').ReadableStream)
  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    nodeStream
      .pipe(unbzip2())
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', () => resolve())
      .on('error', reject)
  })

  return Buffer.concat(chunks).toString('utf-8')
}

/**
 * Parse the EVERef CSV (header: average,date,highest,lowest,order_count,
 * volume,http_last_modified,region_id,type_id - order not assumed) and keep
 * only tracked regions + tradeable items.
 */
function parseDump(
  csv: string,
  tradeableTypeIds: Set<number>
): MarketHistoryRow[] {
  const lines = csv.split('\n')
  if (lines.length < 2) return []

  const header = lines[0].trim().split(',').map(h => h.replace(/"/g, '').trim())
  const col = (name: string) => header.indexOf(name)
  const iAverage = col('average')
  const iDate = col('date')
  const iHighest = col('highest')
  const iLowest = col('lowest')
  const iOrderCount = col('order_count')
  const iVolume = col('volume')
  const iRegionId = col('region_id')
  const iTypeId = col('type_id')

  if ([iAverage, iDate, iHighest, iLowest, iOrderCount, iVolume, iRegionId, iTypeId].includes(-1)) {
    throw new Error(`Unexpected EVERef CSV header: ${lines[0]}`)
  }

  const now = new Date().toISOString()
  const rows: MarketHistoryRow[] = []
  // Tolerate quoted fields even though current dumps don't quote
  const field = (parts: string[], i: number) => (parts[i] ?? '').replace(/"/g, '').trim()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',')
    const regionId = parseInt(field(parts, iRegionId), 10)
    if (!TRACKED_REGIONS.has(regionId)) continue

    const typeId = parseInt(field(parts, iTypeId), 10)
    if (!tradeableTypeIds.has(typeId)) continue

    const date = field(parts, iDate)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    rows.push({
      type_id: typeId,
      date,
      average: parseFloat(field(parts, iAverage)),
      highest: parseFloat(field(parts, iHighest)),
      lowest: parseFloat(field(parts, iLowest)),
      order_count: parseInt(field(parts, iOrderCount), 10) || 0,
      volume: parseInt(field(parts, iVolume), 10) || 0,
      region_id: regionId,
      updated_at: now
    })
  }

  return rows
}

async function upsertRows(rows: MarketHistoryRow[]): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createClient()
  let inserted = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i += SUPABASE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SUPABASE_BATCH_SIZE)
    const { error } = await supabase
      .from('market_history')
      .upsert(batch, { onConflict: 'type_id,date,region_id', ignoreDuplicates: false })

    if (error) {
      errors.push(`Batch ${Math.floor(i / SUPABASE_BATCH_SIZE) + 1}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  return { inserted, errors }
}

/**
 * Fold the day's highs into the market_ath table (migration 018) so the
 * sell-opportunities all-time-high keeps growing even though market_history
 * itself only retains ~100 days. record_market_ath is monotonic (GREATEST),
 * so re-folding the same data is always safe.
 */
async function updateAllTimeHighs(rows: MarketHistoryRow[]): Promise<void> {
  const supabase = createClient()

  // One entry per (type, region): the max high in this batch
  const maxima = new Map<string, { type_id: number; region_id: number; highest: number; date: string }>()
  for (const row of rows) {
    if (!row.highest || isNaN(row.highest)) continue
    const key = `${row.type_id}:${row.region_id}`
    const existing = maxima.get(key)
    if (!existing || row.highest > existing.highest) {
      maxima.set(key, { type_id: row.type_id, region_id: row.region_id, highest: row.highest, date: row.date })
    }
  }

  const entries = [...maxima.values()]
  for (let i = 0; i < entries.length; i += ATH_BATCH_SIZE) {
    const batch = entries.slice(i, i + ATH_BATCH_SIZE)
    const { error } = await supabase.rpc('record_market_ath', { p_entries: batch })
    if (error) {
      // Non-fatal per batch: later runs re-fold the same dates, and ATH lags
      // harmlessly until migration 018 is applied
      console.error(`[EVERef Import] record_market_ath batch ${Math.floor(i / ATH_BATCH_SIZE) + 1} failed:`, error.message)
    }
  }
}

/**
 * Prune old rows. Skipped until market_ath exists (i.e. migration 018 has
 * run) so we can never delete history before its all-time highs are seeded.
 */
async function enforceRetention(): Promise<void> {
  const supabase = createClient()

  const { error: athError } = await supabase
    .from('market_ath')
    .select('type_id', { head: true, count: 'exact' })
    .limit(1)

  if (athError) {
    console.warn('[EVERef Import] Skipping retention: market_ath not available (run migration 018 first)')
    return
  }

  const cutoff = isoDateDaysAgoUTC(RETENTION_DAYS)
  const { error } = await supabase
    .from('market_history')
    .delete()
    .lt('date', cutoff)

  if (error) {
    console.error('[EVERef Import] Retention delete failed:', error.message)
  } else {
    console.log(`[EVERef Import] Pruned rows older than ${cutoff}`)
  }
}

async function logImportRun(log: {
  region_id: number
  target_date: string
  items: number
  rows_fetched: number
  rows_inserted: number
  duration_ms: number
  db_upsert_ms: number | null
  fatal_error: string | null
}): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('market_history_import_logs').insert({
      mode: 'everef',
      region_id: log.region_id,
      chunk: null,
      total_chunks: null,
      target_date: log.target_date,
      items_total: log.items,
      items_success: log.items,
      items_failed: 0,
      items_with_data: log.items,
      rows_fetched: log.rows_fetched,
      rows_inserted: log.rows_inserted,
      duration_ms: log.duration_ms,
      esi_fetch_ms: null,
      db_upsert_ms: log.db_upsert_ms,
      error_breakdown: null,
      fatal_error: log.fatal_error
    })
    if (error) {
      console.error('[EVERef Import] Failed to log import run:', error.message)
    }
  } catch (err) {
    console.error('[EVERef Import] Error logging import run:', err)
  }
}

async function importDate(dateStr: string, tradeableTypeIds: Set<number>): Promise<void> {
  const startTime = Date.now()
  console.log(`[EVERef Import] Importing ${dateStr}...`)

  try {
    const csv = await downloadDailyDump(dateStr)
    if (csv === null) {
      console.log(`[EVERef Import] No file published yet for ${dateStr}, skipping`)
      await logImportRun({
        region_id: 0,
        target_date: dateStr,
        items: 0,
        rows_fetched: 0,
        rows_inserted: 0,
        duration_ms: Date.now() - startTime,
        db_upsert_ms: null,
        fatal_error: 'file not yet published (404)'
      })
      return
    }

    const rows = parseDump(csv, tradeableTypeIds)
    console.log(`[EVERef Import] ${dateStr}: ${rows.length} rows for tracked regions after filtering`)

    if (rows.length === 0) {
      await logImportRun({
        region_id: 0,
        target_date: dateStr,
        items: 0,
        rows_fetched: 0,
        rows_inserted: 0,
        duration_ms: Date.now() - startTime,
        db_upsert_ms: null,
        fatal_error: null
      })
      return
    }

    // Upsert per region so each region's log row reports its real outcome
    const byRegion = new Map<number, MarketHistoryRow[]>()
    for (const row of rows) {
      const list = byRegion.get(row.region_id) ?? []
      list.push(row)
      byRegion.set(row.region_id, list)
    }

    let totalInserted = 0
    for (const [regionId, regionRows] of byRegion) {
      const upsertStart = Date.now()
      const { inserted, errors } = await upsertRows(regionRows)
      totalInserted += inserted

      if (errors.length > 0) {
        console.error(`[EVERef Import] Upsert errors for ${dateStr} region ${regionId}:`, errors)
      }

      await logImportRun({
        region_id: regionId,
        target_date: dateStr,
        items: new Set(regionRows.map(r => r.type_id)).size,
        rows_fetched: regionRows.length,
        rows_inserted: inserted,
        duration_ms: Date.now() - startTime,
        db_upsert_ms: Date.now() - upsertStart,
        fatal_error: errors.length > 0 ? errors.join('; ') : null
      })
    }

    // Fold ATH from the parsed rows (safe even if some upserts failed - the
    // data comes from the dump, not the DB, and the fold is monotonic)
    await updateAllTimeHighs(rows)

    console.log(`[EVERef Import] ${dateStr} complete: ${totalInserted} rows upserted in ${Date.now() - startTime}ms`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[EVERef Import] Fatal error for ${dateStr}:`, message)
    await logImportRun({
      region_id: 0,
      target_date: dateStr,
      items: 0,
      rows_fetched: 0,
      rows_inserted: 0,
      duration_ms: Date.now() - startTime,
      db_upsert_ms: null,
      fatal_error: message
    })
  }
}

/**
 * GET /api/cron/market-history-import
 *
 * Query Parameters:
 *   - date (optional): Import a single specific date (YYYY-MM-DD), e.g. for backfill
 *   - days_back (optional): Import the last N dates (default 6, max 30)
 *
 * Auth: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Fail closed if the secret is not configured
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date')

  let dates: string[]
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    dates = [dateParam]
  } else {
    const daysBack = Math.min(
      Math.max(parseInt(searchParams.get('days_back') || String(DEFAULT_DAYS_BACK), 10) || DEFAULT_DAYS_BACK, 1),
      MAX_DAYS_BACK
    )
    // Oldest first: completed dates finish fully before newer partial files
    dates = Array.from({ length: daysBack }, (_, i) => isoDateDaysAgoUTC(daysBack - i))
  }

  // Run in the background so cron-job.org's 30s timeout never bites
  after(async () => {
    try {
      const tradeableTypeIds = await loadTradeableTypeIds()
      console.log(`[EVERef Import] Loaded ${tradeableTypeIds.size} tradeable type ids`)

      for (const dateStr of dates) {
        await importDate(dateStr, tradeableTypeIds)
      }

      await enforceRetention()
    } catch (error) {
      console.error('[EVERef Import] Fatal background error:', error)
    }
  })

  return NextResponse.json({
    status: 'started',
    message: 'EVERef import running in background. Check Vercel logs for "[EVERef Import]" entries.',
    job: {
      dates,
      tracked_regions: [...TRACKED_REGIONS],
      retention_days: RETENTION_DAYS
    }
  })
}
