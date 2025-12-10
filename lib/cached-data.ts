/**
 * Cached Data Functions
 * 
 * Uses Next.js 16 "use cache" directive with cacheLife profiles
 * to reduce redundant API calls across pages and routes.
 * 
 * Cache Profiles:
 * - "minutes": 5 min stale, 1 min revalidate, 1 hour expire
 * - "hours": 5 min stale, 1 hour revalidate, 1 day expire
 */

import { cacheLife } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

// ============================================================================
// Constants
// ============================================================================

const ESI_BASE = 'https://esi.evetech.net/latest'
const REGION_THE_FORGE = 10000002 // Jita's region

const JANICE_API_BASE = 'https://janice.e-351.com/api/rest/v2'
const JITA_MARKET_ID = 2

// ============================================================================
// Types
// ============================================================================

export interface JitaPrice {
  typeId: number
  lowestSellPrice: number
}

export interface MarketStatistics {
  type_id: number
  all_time_high: number
  mean_price: number
}

export interface MarketHistoryArrays {
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

export interface JaniceItem {
  typeId: number
  itemName: string
  sellPrice: number
  buyPrice: number
  splitPrice: number
  volume: number
}

// ============================================================================
// Janice API (Cached)
// ============================================================================

/**
 * Get Jita prices for items via Janice API
 * Cached for 5 minutes (prices change frequently)
 * 
 * @param itemNames - Array of item names to price (sorted for consistent cache keys)
 * @returns Map of item name to prices
 */
export async function getCachedJaniceAppraisal(
  itemNames: string[]
): Promise<Map<string, JaniceItem>> {
  'use cache'
  cacheLife('minutes')
  
  const result = new Map<string, JaniceItem>()
  
  if (itemNames.length === 0) return result
  
  // Sort for consistent cache keys
  const sortedNames = [...itemNames].sort()
  const input = sortedNames.map(name => `${name} x1`).join('\n')
  
  const apiKey = process.env.JANICE_API_KEY
  if (!apiKey) {
    console.warn('[Cached Data] JANICE_API_KEY not set')
    return result
  }
  
  const params = new URLSearchParams({
    market: JITA_MARKET_ID.toString(),
    persist: 'false',
    compactize: 'true',
  })

  try {
    const response = await fetch(`${JANICE_API_BASE}/appraisal?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-ApiKey': apiKey,
      },
      body: input,
    })

    if (!response.ok) {
      console.error(`[Cached Data] Janice API error: ${response.status}`)
      return result
    }

    const appraisal = await response.json()
    
    for (const item of appraisal.items || []) {
      result.set(item.itemType.name, {
        typeId: item.itemType.eid,
        itemName: item.itemType.name,
        sellPrice: item.immediatePrices.sellPrice,
        buyPrice: item.immediatePrices.buyPrice,
        splitPrice: item.immediatePrices.splitPrice,
        volume: item.itemType.volume,
      })
    }
  } catch (error) {
    console.error('[Cached Data] Janice API fetch error:', error)
  }
  
  return result
}

// ============================================================================
// ESI API (Cached - Individual Prices)
// ============================================================================

/**
 * Fetch a SINGLE item's lowest Jita sell price from ESI
 * Each typeId is cached individually for 5 minutes
 * 
 * This means:
 * - getCachedJitaPrices([34, 35]) caches prices for 34 and 35 separately
 * - getCachedJitaPrices([34, 36]) reuses cached 34, only fetches 36
 */
async function getCachedSingleJitaPrice(typeId: number): Promise<JitaPrice | null> {
  'use cache'
  cacheLife('minutes')
  
  try {
    const response = await fetch(
      `${ESI_BASE}/markets/${REGION_THE_FORGE}/orders/?type_id=${typeId}&order_type=sell`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EveIndustryTracker/1.0'
        }
      }
    )

    if (!response.ok) {
      return null
    }

    const orders = await response.json()
    
    if (orders.length === 0) {
      return null
    }

    // Find the lowest sell price
    const lowestPrice = orders.reduce(
      (min: number, order: { price: number }) => order.price < min ? order.price : min,
      orders[0].price
    )

    return { typeId, lowestSellPrice: lowestPrice }
  } catch {
    return null
  }
}

/**
 * Get current Jita sell prices from ESI for multiple items
 * Each individual price is cached separately for 5 minutes
 * 
 * @param typeIds - Array of type IDs
 * @returns Map of typeId to JitaPrice
 */
export async function getCachedJitaPrices(
  typeIds: number[]
): Promise<Map<number, JitaPrice>> {
  const result = new Map<number, JitaPrice>()
  
  if (typeIds.length === 0) return result
  
  // Fetch in batches of 20 concurrent requests
  // Each individual call to getCachedSingleJitaPrice is cached separately
  const BATCH_SIZE = 20
  
  for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
    const batch = typeIds.slice(i, i + BATCH_SIZE)
    
    // Each of these calls checks/populates its own cache entry
    const promises = batch.map(typeId => getCachedSingleJitaPrice(typeId))
    const results = await Promise.all(promises)
    
    for (const price of results) {
      if (price) {
        result.set(price.typeId, price)
      }
    }
    
    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < typeIds.length) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  return result
}

// ============================================================================
// Supabase (Cached)
// ============================================================================

/**
 * Get market statistics (ATH and mean price) for items
 * Uses RPC function get_sell_statistics
 * Cached for 1 hour (market history is updated daily)
 * 
 * @param typeIds - Array of type IDs (will be sorted for consistent cache keys)
 * @param regionId - Region ID (default: The Forge / Jita)
 * @returns Map of typeId to MarketStatistics
 */
export async function getCachedMarketStatistics(
  typeIds: number[],
  regionId: number = REGION_THE_FORGE
): Promise<Map<number, MarketStatistics>> {
  'use cache'
  cacheLife('hours')
  
  const result = new Map<number, MarketStatistics>()
  
  if (typeIds.length === 0) return result
  
  // Sort for consistent cache keys
  const sortedIds = [...typeIds].sort((a, b) => a - b)
  
  const supabase = createClient()
  
  const { data, error } = await supabase.rpc('get_sell_statistics', {
    p_type_ids: sortedIds,
    p_region_id: regionId
  })
  
  if (error) {
    console.error('[Cached Data] get_sell_statistics RPC error:', error.message)
    return result
  }
  
  if (data && Array.isArray(data)) {
    for (const row of data as MarketStatistics[]) {
      result.set(row.type_id, {
        type_id: row.type_id,
        all_time_high: row.all_time_high,
        mean_price: row.mean_price,
      })
    }
  }
  
  return result
}

/**
 * Get market history arrays for signal analysis
 * Uses RPC function get_market_history_arrays
 * Cached for 1 hour (market history is updated daily)
 * 
 * @param typeIds - Array of type IDs (will be sorted for consistent cache keys)
 * @param daysBack - Number of days of history to fetch
 * @param regionId - Region ID (default: The Forge / Jita)
 * @returns Map of typeId to MarketHistoryArrays
 */
export async function getCachedMarketHistoryArrays(
  typeIds: number[],
  daysBack: number = 90,
  regionId: number = REGION_THE_FORGE
): Promise<Map<number, MarketHistoryArrays>> {
  'use cache'
  cacheLife('hours')
  
  const result = new Map<number, MarketHistoryArrays>()
  
  if (typeIds.length === 0) return result
  
  // Sort for consistent cache keys
  const sortedIds = [...typeIds].sort((a, b) => a - b)
  
  const supabase = createClient()
  
  // Process in batches to avoid timeouts
  const BATCH_SIZE = 100
  
  for (let i = 0; i < sortedIds.length; i += BATCH_SIZE) {
    const batch = sortedIds.slice(i, i + BATCH_SIZE)
    
    const { data, error } = await supabase.rpc('get_market_history_arrays', {
      p_type_ids: batch,
      p_region_id: regionId,
      p_days_back: daysBack
    })
    
    if (error) {
      // Function might not exist yet - that's OK, just log and continue
      if (error.message.includes('function') || error.message.includes('does not exist')) {
        console.warn('[Cached Data] get_market_history_arrays not available')
        break
      }
      console.error('[Cached Data] get_market_history_arrays RPC error:', error.message)
      continue
    }
    
    if (data && Array.isArray(data)) {
      for (const row of data as MarketHistoryArrays[]) {
        result.set(row.type_id, row)
      }
    }
  }
  
  return result
}

/**
 * Get basic market statistics using get_market_statistics RPC
 * Cached for 1 hour (market history is updated daily)
 * 
 * @param typeIds - Array of type IDs
 * @param daysBack - Number of days of history
 * @param regionId - Region ID
 * @returns Array of statistics objects
 */
export async function getCachedBasicMarketStatistics(
  typeIds: number[],
  daysBack: number = 30,
  regionId: number = REGION_THE_FORGE
): Promise<{
  type_id: number
  mean_price: number
  std_dev: number
  avg_volume: number
  data_points: number
  volatility: number
}[]> {
  'use cache'
  cacheLife('hours')
  
  if (typeIds.length === 0) return []
  
  // Sort for consistent cache keys
  const sortedIds = [...typeIds].sort((a, b) => a - b)
  
  const supabase = createClient()
  const allResults: {
    type_id: number
    mean_price: number
    std_dev: number
    avg_volume: number
    data_points: number
    volatility: number
  }[] = []
  
  // Process in batches
  const BATCH_SIZE = 200
  
  for (let i = 0; i < sortedIds.length; i += BATCH_SIZE) {
    const batch = sortedIds.slice(i, i + BATCH_SIZE)
    
    const { data, error } = await supabase.rpc('get_market_statistics', {
      p_type_ids: batch,
      p_region_id: regionId,
      p_days_back: daysBack,
      p_min_data_points: 3
    })
    
    if (error) {
      console.error('[Cached Data] get_market_statistics RPC error:', error.message)
      continue
    }
    
    if (data && Array.isArray(data)) {
      allResults.push(...data)
    }
  }
  
  return allResults
}

/**
 * Get market seeder statistics (volume, trend, etc.)
 * Uses RPC function get_market_seeder_statistics
 * Cached for 1 hour
 * 
 * @param typeIds - Array of type IDs
 * @param days - Number of days to analyze
 * @param regionId - Region ID
 * @returns Map of typeId to demand metrics
 */
export async function getCachedMarketSeederStatistics(
  typeIds: number[],
  days: number = 30,
  regionId: number = REGION_THE_FORGE
): Promise<Map<number, {
  typeId: number
  totalVolume30d: number
  avgDailyVolume: number
  avgPrice: number
  totalOrders: number
  recentAvgVolume: number
  olderAvgVolume: number
  trendDirection: 'up' | 'down' | 'stable'
}>> {
  'use cache'
  cacheLife('hours')
  
  const result = new Map<number, {
    typeId: number
    totalVolume30d: number
    avgDailyVolume: number
    avgPrice: number
    totalOrders: number
    recentAvgVolume: number
    olderAvgVolume: number
    trendDirection: 'up' | 'down' | 'stable'
  }>()
  
  if (typeIds.length === 0) return result
  
  // Sort for consistent cache keys
  const sortedIds = [...typeIds].sort((a, b) => a - b)
  
  const supabase = createClient()
  
  // Process in batches
  const BATCH_SIZE = 200
  
  for (let i = 0; i < sortedIds.length; i += BATCH_SIZE) {
    const batch = sortedIds.slice(i, i + BATCH_SIZE)
    
    const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
      p_type_ids: batch,
      p_region_id: regionId,
      p_days_back: days
    })
    
    if (error) {
      console.error('[Cached Data] get_market_seeder_statistics RPC error:', error.message)
      continue
    }
    
    if (data && Array.isArray(data)) {
      for (const row of data as {
        type_id: number
        total_volume: number
        avg_daily_volume: number
        avg_price: number
        total_orders: number
        recent_avg_volume: number
        older_avg_volume: number
        trend_direction: string
      }[]) {
        result.set(row.type_id, {
          typeId: row.type_id,
          totalVolume30d: row.total_volume || 0,
          avgDailyVolume: row.avg_daily_volume || 0,
          avgPrice: row.avg_price || 0,
          totalOrders: row.total_orders || 0,
          recentAvgVolume: row.recent_avg_volume || 0,
          olderAvgVolume: row.older_avg_volume || 0,
          trendDirection: (row.trend_direction as 'up' | 'down' | 'stable') || 'stable'
        })
      }
    }
  }
  
  return result
}

