/**
 * Direct ESI Market History
 *
 * Fetches /markets/{region_id}/history/ straight from ESI with per-(region, type)
 * caching. Used by the market-history chart, which needs ESI's full ~13-month
 * depth (the market_history table only retains ~100 days) and costs just one
 * call per region per item.
 *
 * Everything else (watchlist, essentials, sell-order tools, scanners) reads
 * the market_history table, which the EVERef bulk import keeps current - a
 * structure-wide scan through this module would serialize thousands of calls
 * against ESI's dedicated 300 req/min/IP limit and blow Vercel's function
 * timeout, so keep new consumers of this module to small item counts.
 *
 * ESI serves ~13 months of daily rows per (region, type) and refreshes once
 * per day at ~11:05 UTC. Uncached fetches are paced through a module-level
 * gate to stay under the endpoint's per-IP limit; cache hits never touch it.
 */

import { cacheLife } from 'next/cache'

const ESI_BASE = 'https://esi.evetech.net'
const ESI_COMPATIBILITY_DATE = '2025-11-06'

// 220ms spacing keeps one instance under ESI's 5 req/s ceiling for this
// endpoint. Other instances share the IP budget - another reason callers
// must stay small (the chart needs 3 slots per view).
const REQUEST_SPACING_MS = 220
const MAX_SERVER_ERROR_RETRIES = 3
const MAX_RATE_LIMIT_RETRIES = 3
const BASE_RATE_LIMIT_DELAY_MS = 5000

export interface EsiHistoryEntry {
  average: number
  date: string
  highest: number
  lowest: number
  order_count: number
  volume: number
}

export interface HistoryArrayStats {
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

// ============================================================================
// Rate-limited ESI fetch
// ============================================================================

// Serializes the START of each network request; each caller waits for the
// previous slot plus the spacing delay. Cache hits bypass this entirely.
let rateGate: Promise<void> = Promise.resolve()

function nextRequestSlot(): Promise<void> {
  const slot = rateGate.then(
    () => new Promise<void>(resolve => setTimeout(resolve, REQUEST_SPACING_MS))
  )
  // Swallow rejection on the shared chain so one failure can't poison the gate
  rateGate = slot.catch(() => {})
  return slot
}

/**
 * Fetch full market history (~13 months) for one type in one region.
 * Throws on persistent failure so transient errors are never cached as
 * "no data". 404/400 mean the item/region genuinely has no market history.
 */
async function fetchHistoryFromEsi(
  regionId: number,
  typeId: number,
  retryCount = 0
): Promise<EsiHistoryEntry[]> {
  await nextRequestSlot()
  console.log(`[ESI History] Fetching type ${typeId} region ${regionId} (cache miss)`)

  const response = await fetch(
    `${ESI_BASE}/markets/${regionId}/history/?type_id=${typeId}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-Compatibility-Date': ESI_COMPATIBILITY_DATE,
        'User-Agent': 'EveIndustryTracker/1.0'
      }
    }
  )

  if (response.ok) {
    return response.json()
  }

  // No market data for this item/region - a real answer, safe to cache
  if (response.status === 404 || response.status === 400) {
    return []
  }

  // 420 = ESI error limit, 429 = rate limited
  if (response.status === 420 || response.status === 429) {
    if (retryCount >= MAX_RATE_LIMIT_RETRIES) {
      throw new Error(`ESI rate limited (type ${typeId}, region ${regionId})`)
    }
    const waitTime = Math.min(BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, retryCount), 20000)
    console.warn(`[ESI History] Rate limited on type ${typeId}, waiting ${waitTime / 1000}s`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
    return fetchHistoryFromEsi(regionId, typeId, retryCount + 1)
  }

  if ([500, 502, 503, 504].includes(response.status) && retryCount < MAX_SERVER_ERROR_RETRIES) {
    await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)))
    return fetchHistoryFromEsi(regionId, typeId, retryCount + 1)
  }

  throw new Error(`ESI history HTTP ${response.status} (type ${typeId}, region ${regionId})`)
}

/**
 * Cached per-(region, type) history. The underlying data only changes once a
 * day (~11:05 UTC), so the 1-hour "hours" profile costs at most 24 ESI calls
 * per item per day while keeping entries independently reusable across
 * requests.
 */
export async function getCachedRegionTypeHistory(
  regionId: number,
  typeId: number
): Promise<EsiHistoryEntry[]> {
  'use cache'
  cacheLife('hours')
  return fetchHistoryFromEsi(regionId, typeId)
}

// ============================================================================
// Statistics (parity with the get_market_history_arrays RPC)
// ============================================================================

function isoDateDaysAgoUTC(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().split('T')[0]
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Chart-shaped arrays + summary stats for one item, matching
 * get_market_history_arrays (migration 016): dates ascending, population
 * std dev, volatility = std_dev / mean.
 * Returns null when the window has no data.
 */
export function computeHistoryArrays(
  typeId: number,
  entries: EsiHistoryEntry[],
  daysBack: number
): HistoryArrayStats | null {
  const fromDate = isoDateDaysAgoUTC(daysBack)
  const rows = entries
    .filter(e => e.date >= fromDate)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  if (rows.length === 0) return null

  const prices = rows.map(r => r.average)
  const meanPrice = prices.reduce((sum, p) => sum + p, 0) / rows.length
  const variance =
    prices.reduce((sum, p) => sum + (p - meanPrice) * (p - meanPrice), 0) / rows.length
  const stdDev = Math.sqrt(variance)
  const avgVolume = rows.reduce((sum, r) => sum + r.volume, 0) / rows.length

  return {
    type_id: typeId,
    dates: rows.map(r => r.date),
    prices,
    volumes: rows.map(r => r.volume),
    highs: rows.map(r => r.highest),
    lows: rows.map(r => r.lowest),
    data_points: rows.length,
    mean_price: round(meanPrice, 2),
    std_dev: round(stdDev, 4),
    avg_volume: round(avgVolume, 0),
    volatility: meanPrice > 0 ? round(stdDev / meanPrice, 4) : 0
  }
}
