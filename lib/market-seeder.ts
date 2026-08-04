/**
 * Market Seeder Algorithm
 * 
 * Core logic for analyzing market data to identify profitable items
 * to import from Jita to an alliance market hub.
 */

import { createClient } from '@/utils/supabase/server'
import { getCachedJitaPrices } from '@/lib/cached-data'
import { config } from '@/lib/config'
import {
  type TradeableItem,
  type JitaDemandMetrics,
  type StructureOrderMap,
  type ProfitAnalysis,
  type TargetPriceResult,
  type AnalysisSummary,
  type CachedStructureOrders,
  type RegionId,
  MARKET_SEEDER_DEFAULTS,
  NO_COMPETITION_MARKUP_TIERS,
  REGION_IDS,
  VOLUME_REGIONS,
  DEFAULT_VOLUME_REGION_ID,
} from '@/types/market-seeder'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ============================================================================
// In-Memory Cache
// ============================================================================

let structureOrdersCache: CachedStructureOrders | null = null

/**
 * Check if cached data is still valid
 */
function isCacheValid(fetchedAt: number, ttlMs: number): boolean {
  return Date.now() - fetchedAt < ttlMs
}

/**
 * Clear all caches (useful for testing)
 */
export function clearCaches(): void {
  structureOrdersCache = null
  jitaPricesCache = null
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Read tradeable items from JSONL file
 */
export async function loadTradeableItems(): Promise<TradeableItem[]> {
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
 * Get region name for logging
 */
function getRegionName(regionId: RegionId): string {
  const region = VOLUME_REGIONS.find(r => r.id === regionId)
  return region?.name ?? `Region ${regionId}`
}

/**
 * Query market history for a specific region with progress callback
 * This provides demand data for market analysis
 */
export async function fetchRegionMarketHistoryWithProgress(
  typeIds: number[],
  regionId: RegionId = DEFAULT_VOLUME_REGION_ID,
  days: number = 30,
  onBatchProgress?: (batch: number, total: number) => void
): Promise<Map<number, JitaDemandMetrics>> {
  const supabase = createClient()
  const result = new Map<number, JitaDemandMetrics>()
  const regionName = getRegionName(regionId)
  
  if (typeIds.length === 0) {
    console.warn(`[Market Seeder] No type IDs provided for ${regionName} market history`)
    return result
  }
  
  const RPC_BATCH_SIZE = 200  // Process 200 type_ids per RPC call to avoid timeouts
  const totalBatches = Math.ceil(typeIds.length / RPC_BATCH_SIZE)
  
  console.log(`[Market Seeder] Fetching ${regionName} market history for ${typeIds.length} items in ${totalBatches} batches...`)
  
  for (let i = 0; i < typeIds.length; i += RPC_BATCH_SIZE) {
    const batchTypeIds = typeIds.slice(i, i + RPC_BATCH_SIZE)
    const batchNum = Math.floor(i / RPC_BATCH_SIZE) + 1
    
    // Send progress update
    onBatchProgress?.(batchNum, totalBatches)
    
    try {
      const { data, error } = await supabase.rpc('get_market_seeder_statistics', {
        p_type_ids: batchTypeIds,
        p_region_id: regionId,
        p_days_back: days
      })
      
      if (error) {
        console.error(`[Market Seeder] ${regionName} RPC batch ${batchNum}/${totalBatches} failed:`, error.message)
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
      
      console.log(`[Market Seeder] ${regionName} RPC batch ${batchNum}/${totalBatches}: ${data?.length || 0} results`)
      
    } catch (err) {
      console.error(`[Market Seeder] ${regionName} RPC batch ${batchNum}/${totalBatches} exception:`, err)
    }
  }
  
  console.log(`[Market Seeder] ${regionName} market history: ${result.size} items with data out of ${typeIds.length} requested`)
  
  return result
}

/**
 * Fetch structure orders from ESI (with caching)
 */
export async function fetchStructureOrders(
  structureId: string,
  authToken: string,
  forceRefresh: boolean = false
): Promise<StructureOrderMap> {
  // Check cache
  if (
    !forceRefresh &&
    structureOrdersCache &&
    structureOrdersCache.structureId === structureId &&
    isCacheValid(structureOrdersCache.fetchedAt, MARKET_SEEDER_DEFAULTS.STRUCTURE_ORDERS_CACHE_TTL)
  ) {
    console.log('[Market Seeder] Using cached structure orders')
    return structureOrdersCache.data
  }
  
  // Fetch from API with all=true parameter
  const response = await fetch(
    `${config.baseUrl}/api/esi/structure-orders?structure_id=${structureId}&all=true`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  )
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch structure orders: ${error}`)
  }
  
  const data = await response.json()
  
  // Convert to StructureOrderMap
  const orderMap: StructureOrderMap = {}
  for (const order of data.orders_by_type || []) {
    orderMap[order.type_id] = {
      lowestSellPrice: order.lowest_price,
      totalVolume: order.total_volume,
      orderCount: order.order_count
    }
  }
  
  // Update cache
  structureOrdersCache = {
    data: orderMap,
    fetchedAt: Date.now(),
    structureId
  }
  
  return orderMap
}

/**
 * ESI Market Order interface
 */
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
 * Jita sell price data (from ESI regional orders)
 */
export interface JitaSellPrice {
  typeId: number
  lowestSellPrice: number
}

/**
 * Cached Jita prices with TTL
 */
interface CachedJitaPrices {
  data: Map<number, JitaSellPrice>
  fetchedAt: number
}

let jitaPricesCache: CachedJitaPrices | null = null

const ESI_BASE = 'https://esi.evetech.net'

/**
 * Fetch current Jita sell prices from ESI regional market orders
 * Uses cached function for efficiency when no progress callback needed
 */
export async function fetchJitaSellPrices(
  typeIds: number[],
  forceRefresh: boolean = false
): Promise<Map<number, JitaSellPrice>> {
  if (forceRefresh) {
    // Use the progress version with batching for force refresh
    return fetchJitaSellPricesWithProgress(typeIds, undefined, forceRefresh)
  }
  
  // Use Next.js cached version
  console.log(`[Market Seeder] Using cached Jita prices for ${typeIds.length} items`)
  const cachedPrices = await getCachedJitaPrices(typeIds)
  
  // Convert to JitaSellPrice format
  const result = new Map<number, JitaSellPrice>()
  for (const [typeId, priceData] of cachedPrices) {
    result.set(typeId, {
      typeId: priceData.typeId,
      lowestSellPrice: priceData.lowestSellPrice
    })
  }
  return result
}

/**
 * Fetch Jita sell prices with progress callback
 */
export async function fetchJitaSellPricesWithProgress(
  typeIds: number[],
  onBatchProgress?: (batch: number, total: number) => void,
  forceRefresh: boolean = false
): Promise<Map<number, JitaSellPrice>> {
  // Check cache
  if (
    !forceRefresh &&
    jitaPricesCache &&
    isCacheValid(jitaPricesCache.fetchedAt, MARKET_SEEDER_DEFAULTS.JITA_PRICES_CACHE_TTL)
  ) {
    console.log('[Market Seeder] Using cached Jita prices')
    return jitaPricesCache.data
  }
  
  const pricesMap = new Map<number, JitaSellPrice>()
  const CONCURRENT_REQUESTS = 20  // ESI rate limit friendly
  const totalItems = typeIds.length
  const totalBatches = Math.ceil(totalItems / CONCURRENT_REQUESTS)
  
  console.log(`[Market Seeder] Fetching Jita sell prices for ${totalItems} items from ESI...`)
  
  // Process in concurrent batches
  for (let i = 0; i < totalItems; i += CONCURRENT_REQUESTS) {
    const batch = typeIds.slice(i, i + CONCURRENT_REQUESTS)
    const batchNum = Math.floor(i / CONCURRENT_REQUESTS) + 1
    
    // Send progress update
    onBatchProgress?.(batchNum, totalBatches)
    
    // Fetch all items in this batch concurrently
    const promises = batch.map(async (typeId) => {
      try {
        const response = await fetch(
          `${ESI_BASE}/markets/${REGION_IDS.THE_FORGE}/orders/?type_id=${typeId}&order_type=sell`,
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
        
        return { typeId, lowestSellPrice: lowestPrice }
      } catch {
        return null
      }
    })
    
    const results = await Promise.all(promises)
    
    // Add successful results to map
    let successCount = 0
    for (const result of results) {
      if (result) {
        pricesMap.set(result.typeId, result)
        successCount++
      }
    }
    
    // Log progress every 10 batches
    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(`[Market Seeder] ESI prices batch ${batchNum}/${totalBatches}: ${successCount}/${batch.length} with prices`)
    }
    
    // Small delay between batches to respect rate limits
    if (i + CONCURRENT_REQUESTS < totalItems) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  console.log(`[Market Seeder] Jita prices: ${pricesMap.size} items with sell orders out of ${totalItems}`)
  
  // Update cache
  jitaPricesCache = {
    data: pricesMap,
    fetchedAt: Date.now()
  }
  
  return pricesMap
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Get the no-competition markup multiplier based on Jita price
 * Uses tiered pricing: cheaper items get higher markups, expensive items lower markups
 * 
 * Tiers:
 * - < 500K ISK: 4.0x (300% margin)
 * - < 2M ISK: 3.0x (200% margin)
 * - < 10M ISK: 2.0x (100% margin)
 * - < 50M ISK: 1.7x (70% margin)
 * - >= 50M ISK: 1.4x (40% margin)
 */
export function getNoCompetitionMarkup(jitaPrice: number): number {
  for (const tier of NO_COMPETITION_MARKUP_TIERS) {
    if (jitaPrice < tier.maxPrice) {
      return tier.multiplier
    }
  }
  // Fallback (should never reach due to Infinity in last tier)
  return MARKET_SEEDER_DEFAULTS.NO_COMPETITION_MARKUP
}

/**
 * Calculate target sell price based on competition
 * Uses tiered markup for no-competition items based on Jita price
 */
export function calculateTargetPrice(
  jitaSellPrice: number,
  structureLowestSell: number | null
): TargetPriceResult {
  if (structureLowestSell === null) {
    // No competition: apply tiered markup based on Jita price
    const markup = getNoCompetitionMarkup(jitaSellPrice)
    return {
      price: jitaSellPrice * markup,
      hasCompetition: false,
      competitorPrice: null
    }
  } else {
    // Has competition: match competitor price
    return {
      price: structureLowestSell,
      hasCompetition: true,
      competitorPrice: structureLowestSell
    }
  }
}

/**
 * Calculate profit analysis for a single item
 */
export function analyzeItem(
  item: TradeableItem,
  jitaDemand: JitaDemandMetrics | undefined,
  structureOrder: { lowestSellPrice: number; totalVolume: number; orderCount: number } | undefined,
  jitaPrice: JitaSellPrice | undefined,
  transportCostPerM3: number
): ProfitAnalysis | null {
  // Skip if no Jita price data
  if (!jitaPrice || jitaPrice.lowestSellPrice <= 0) {
    return null
  }
  
  // Calculate costs
  const jitaSellPrice = jitaPrice.lowestSellPrice
  const transportCostPerUnit = item.volume * transportCostPerM3
  const totalCostPerUnit = jitaSellPrice + transportCostPerUnit
  
  // Calculate target price
  const targetPriceResult = calculateTargetPrice(
    jitaSellPrice,
    structureOrder?.lowestSellPrice || null
  )
  
  // Calculate profit metrics
  const profitPerUnit = targetPriceResult.price - totalCostPerUnit
  const profitMarginPct = totalCostPerUnit > 0 ? (profitPerUnit / totalCostPerUnit) * 100 : 0
  const profitPerM3 = item.volume > 0 ? profitPerUnit / item.volume : 0
  
  // Get demand metrics (default to 0 if no history)
  const avgDailyVolume = jitaDemand?.avgDailyVolume || 0
  const totalVolume30d = jitaDemand?.totalVolume30d || 0
  const trendDirection = jitaDemand?.trendDirection || 'stable'
  
  return {
    typeId: item.typeId,
    name: item.name,
    categoryName: item.categoryName,
    groupName: item.groupName,
    volumePerUnit: item.volume,
    metaGroupName: item.metaGroupName || 'Tech I',
    
    jitaSellPrice,
    transportCostPerUnit,
    totalCostPerUnit,
    
    hasCompetition: targetPriceResult.hasCompetition,
    competitorLowestPrice: targetPriceResult.competitorPrice,
    targetSellPrice: targetPriceResult.price,
    
    profitPerUnit,
    profitMarginPct,
    profitPerM3,
    
    avgDailyVolume,
    totalVolume30d,
    trendDirection,
    
    compositeScore: 0  // Calculated later after normalization
  }
}

/**
 * Calculate composite profitability score
 * Normalizes values across all items and applies weights
 * Then multiplies by sqrt(avgDailyVolume) to prioritize high-volume items
 */
export function calculateCompositeScores(items: ProfitAnalysis[]): void {
  if (items.length === 0) return
  
  // Find max values for normalization
  const maxProfitPerM3 = Math.max(...items.map(i => i.profitPerM3), 1)
  const maxDailyVolume = Math.max(...items.map(i => i.avgDailyVolume), 1)
  const maxProfitPerUnit = Math.max(...items.map(i => i.profitPerUnit), 1)
  
  // Calculate scores
  for (const item of items) {
    // Normalize each factor to 0-100 scale
    const marginScore = Math.min(item.profitMarginPct, 100)  // Cap at 100%
    const profitPerM3Score = (item.profitPerM3 / maxProfitPerM3) * 100
    const demandScore = (item.avgDailyVolume / maxDailyVolume) * 100
    const absoluteProfitScore = (item.profitPerUnit / maxProfitPerUnit) * 100
    
    // Bonus for no competition
    const competitionBonus = item.hasCompetition ? 0 : MARKET_SEEDER_DEFAULTS.BONUS_NO_COMPETITION
    
    // Calculate base score from weighted factors
    const baseScore = 
      marginScore * MARKET_SEEDER_DEFAULTS.WEIGHT_MARGIN +
      profitPerM3Score * MARKET_SEEDER_DEFAULTS.WEIGHT_PROFIT_PER_M3 +
      demandScore * MARKET_SEEDER_DEFAULTS.WEIGHT_DEMAND +
      absoluteProfitScore * MARKET_SEEDER_DEFAULTS.WEIGHT_ABSOLUTE_PROFIT +
      competitionBonus
    
    // Apply volume multiplier: sqrt(avgDailyVolume)
    // This heavily favors high-volume items over rare expensive items
    // 10 vol/day = 3.2x, 100 vol/day = 10x, 1000 vol/day = 31.6x
    const volumeMultiplier = Math.sqrt(Math.max(item.avgDailyVolume, 1))
    item.compositeScore = baseScore * volumeMultiplier
  }
}

/**
 * Apply minimum threshold filters (server-side)
 * Note: minMargin and noCompetition are now filtered client-side for better UX
 */
export function applyFilters(
  items: ProfitAnalysis[],
  minProfitIsk: number,
  minJitaPrice: number = MARKET_SEEDER_DEFAULTS.MIN_JITA_PRICE,
  minDailyVolume: number = MARKET_SEEDER_DEFAULTS.MIN_DAILY_VOLUME,
): ProfitAnalysis[] {
  return items.filter(item => 
    item.profitPerUnit >= minProfitIsk &&
    item.jitaSellPrice >= minJitaPrice &&
    item.avgDailyVolume >= minDailyVolume &&
    item.profitPerUnit > 0  // Must be profitable
  )
}

/**
 * Generate analysis summary statistics
 */
export function generateSummary(
  totalAnalyzed: number,
  filteredItems: ProfitAnalysis[]
): AnalysisSummary {
  const withCompetition = filteredItems.filter(i => i.hasCompetition).length
  const noCompetition = filteredItems.length - withCompetition
  
  const avgMargin = filteredItems.length > 0
    ? filteredItems.reduce((sum, i) => sum + i.profitMarginPct, 0) / filteredItems.length
    : 0
    
  const avgProfitPerM3 = filteredItems.length > 0
    ? filteredItems.reduce((sum, i) => sum + i.profitPerM3, 0) / filteredItems.length
    : 0
  
  return {
    totalItemsAnalyzed: totalAnalyzed,
    itemsPassingFilters: filteredItems.length,
    itemsWithCompetition: withCompetition,
    itemsNoCompetition: noCompetition,
    avgProfitMargin: Math.round(avgMargin * 100) / 100,
    avgProfitPerM3: Math.round(avgProfitPerM3)
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Progress callback type for streaming updates
 */
export type ProgressCallback = (
  stage: string,
  message: string,
  percent: number,
  details?: Record<string, unknown>
) => void

export interface AnalyzeOptions {
  structureId: string
  authToken: string
  transportCostPerM3?: number
  minProfitIsk?: number
  minDailyVolume?: number
  days?: number
  /** Region ID for volume/demand data (default: Vale of the Silent) */
  volumeRegionId?: RegionId
}

export interface AnalyzeOptionsWithProgress extends AnalyzeOptions {
  onProgress?: ProgressCallback
}

export interface AnalyzeResult {
  items: ProfitAnalysis[]
  summary: AnalysisSummary
  timing: {
    loadItemsMs: number
    marketHistoryMs: number
    structureOrdersMs: number
    jitaPricesMs: number
    analysisMs: number
    totalMs: number
  }
}

/**
 * Run full market seeder analysis with progress updates
 */
export async function analyzeMarketWithProgress(options: AnalyzeOptionsWithProgress): Promise<AnalyzeResult> {
  const startTime = Date.now()
  const {
    structureId,
    authToken,
    transportCostPerM3 = MARKET_SEEDER_DEFAULTS.TRANSPORT_COST_PER_M3,
    minProfitIsk = MARKET_SEEDER_DEFAULTS.MIN_PROFIT_ISK,
    minDailyVolume = MARKET_SEEDER_DEFAULTS.MIN_DAILY_VOLUME,
    days = MARKET_SEEDER_DEFAULTS.DAYS_TO_ANALYZE,
    volumeRegionId = DEFAULT_VOLUME_REGION_ID,
    onProgress
  } = options
  
  const regionName = getRegionName(volumeRegionId)
  
  // Helper to send progress if callback provided
  const progress = (stage: string, message: string, percent: number, details?: Record<string, unknown>) => {
    console.log(`[Market Seeder] ${message}`)
    onProgress?.(stage, message, percent, details)
  }
  
  // Step 1: Load tradeable items
  progress('loading', 'Loading tradeable items...', 0)
  const loadItemsStart = Date.now()
  const tradeableItems = await loadTradeableItems()
  const loadItemsMs = Date.now() - loadItemsStart
  progress('loading', `Loaded ${tradeableItems.length} tradeable items`, 5, { itemCount: tradeableItems.length })
  
  // Extract type IDs for batch queries
  const typeIds = tradeableItems.map(item => item.typeId)
  
  // Step 2: Fetch market history for selected region (using batched RPC with progress)
  progress('market_history', `Fetching ${regionName} market history from database...`, 10)
  const marketHistoryStart = Date.now()
  const regionMarketHistory = await fetchRegionMarketHistoryWithProgress(typeIds, volumeRegionId, days, (batch, total) => {
    const batchPercent = 10 + Math.round((batch / total) * 25)
    progress('market_history', `Fetching ${regionName} market history... ${batch}/${total} batches`, batchPercent, { batch, total })
  })
  const marketHistoryMs = Date.now() - marketHistoryStart
  progress('market_history', `Fetched ${regionMarketHistory.size} ${regionName} market history records`, 35, { count: regionMarketHistory.size })
  
  // Step 3: Fetch structure orders
  progress('structure_orders', 'Fetching structure orders from ESI...', 40)
  const structureOrdersStart = Date.now()
  const structureOrders = await fetchStructureOrders(structureId, authToken)
  const structureOrdersMs = Date.now() - structureOrdersStart
  progress('structure_orders', `Fetched ${Object.keys(structureOrders).length} structure orders`, 45, { count: Object.keys(structureOrders).length })
  
  // Step 4: Fetch Jita sell prices from ESI with progress
  progress('jita_prices', 'Fetching current Jita prices from ESI...', 50)
  const jitaPricesStart = Date.now()
  const jitaPrices = await fetchJitaSellPricesWithProgress(typeIds, (batch, total) => {
    const batchPercent = 50 + Math.round((batch / total) * 35)
    progress('jita_prices', `Fetching Jita prices... ${batch}/${total} batches`, batchPercent, { batch, total })
  })
  const jitaPricesMs = Date.now() - jitaPricesStart
  progress('jita_prices', `Fetched ${jitaPrices.size} Jita prices`, 85, { count: jitaPrices.size })
  
  // Step 5: Analyze each item
  progress('analyzing', 'Analyzing profit opportunities...', 88)
  const analysisStart = Date.now()
  const allAnalyzed: ProfitAnalysis[] = []
  
  for (const item of tradeableItems) {
    const analysis = analyzeItem(
      item,
      regionMarketHistory.get(item.typeId),  // Use selected region for demand metrics
      structureOrders[item.typeId],
      jitaPrices.get(item.typeId),  // Use Jita prices for cost basis
      transportCostPerM3
    )
    
    if (analysis) {
      allAnalyzed.push(analysis)
    }
  }
  
  // Step 6: Apply filters (server-side: minProfit, minVolume, minPrice)
  progress('filtering', 'Applying filters...', 90)
  const filteredItems = applyFilters(allAnalyzed, minProfitIsk, MARKET_SEEDER_DEFAULTS.MIN_JITA_PRICE, minDailyVolume)
  
  // Step 7: Calculate composite scores
  progress('scoring', 'Calculating composite scores...', 92)
  calculateCompositeScores(filteredItems)
  
  const analysisMs = Date.now() - analysisStart
  const totalMs = Date.now() - startTime
  
  // Generate summary
  const summary = generateSummary(tradeableItems.length, filteredItems)
  
  progress('complete', `Analysis complete: ${filteredItems.length} items pass filters`, 100, { 
    itemCount: filteredItems.length,
    totalMs 
  })
  
  return {
    items: filteredItems,
    summary,
    timing: {
      loadItemsMs,
      marketHistoryMs,
      structureOrdersMs,
      jitaPricesMs,
      analysisMs,
      totalMs
    }
  }
}

/**
 * Run full market seeder analysis (without progress - backwards compatibility)
 */
export async function analyzeMarket(options: AnalyzeOptions): Promise<AnalyzeResult> {
  return analyzeMarketWithProgress(options)
}

/**
 * Sort items by composite score (returns all items, no slicing)
 * Filtering and sorting is now handled client-side for better UX
 */
export function generateRankedLists(items: ProfitAnalysis[]) {
  // Return all items sorted by composite score (default sort)
  const allItems = [...items].sort((a, b) => b.compositeScore - a.compositeScore)
  
  return {
    allItems
  }
}

