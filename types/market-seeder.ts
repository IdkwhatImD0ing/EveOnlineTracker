/**
 * Market Seeder Types
 * 
 * TypeScript interfaces for the market seeder analysis algorithm.
 * Used to identify profitable items to import from Jita to alliance market hub.
 */

// ============================================================================
// Input Types
// ============================================================================

/**
 * Tradeable item from data/tradeable-items.jsonl
 */
export interface TradeableItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: 'Module' | 'Charge' | 'Booster' | 'Ship'
  volume: number  // m³ per unit
  marketGroupId: number | null
}

/**
 * Jita market history demand metrics (aggregated from Supabase)
 */
export interface JitaDemandMetrics {
  typeId: number
  totalVolume30d: number      // Total units sold in 30 days
  avgDailyVolume: number      // Average units/day
  avgPrice: number            // Average ISK per unit
  totalOrders: number         // Liquidity indicator
  recentAvgVolume: number     // Last 7 days avg (trend detection)
  olderAvgVolume: number      // Days 8-30 avg (baseline)
  trendDirection: 'up' | 'down' | 'stable'  // Computed from recent vs older
}

/**
 * Structure order data (from ESI via /api/esi/structure-orders)
 */
export interface StructureOrderData {
  type_id: number
  lowest_price: number
  total_volume: number
  order_count: number
}

/**
 * Map of type_id to structure order data
 */
export interface StructureOrderMap {
  [typeId: number]: {
    lowestSellPrice: number
    totalVolume: number
    orderCount: number
  }
}

/**
 * Jita sell price data (from ESI regional orders)
 */
export interface JitaSellPrice {
  typeId: number
  lowestSellPrice: number  // Lowest sell order price in Jita
}

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Full profit analysis for a single item
 */
export interface ProfitAnalysis {
  // Item info
  typeId: number
  name: string
  categoryName: string
  groupName: string
  volumePerUnit: number  // m³
  
  // Costs
  jitaSellPrice: number           // Acquisition cost per unit
  transportCostPerUnit: number    // volume × transport rate (ISK/m³)
  totalCostPerUnit: number        // jitaSellPrice + transportCost
  
  // Target price in alliance hub
  hasCompetition: boolean
  competitorLowestPrice: number | null
  targetSellPrice: number         // Either competitor price or 40% markup
  
  // Profit metrics
  profitPerUnit: number           // targetSellPrice - totalCostPerUnit
  profitMarginPct: number         // (profit / cost) × 100
  profitPerM3: number             // profitPerUnit / volume
  
  // Demand metrics (from Jita history)
  avgDailyVolume: number
  totalVolume30d: number
  trendDirection: 'up' | 'down' | 'stable'
  
  // Composite score
  compositeScore: number          // Weighted profitability score (0-100+)
}

/**
 * Target price calculation result
 */
export interface TargetPriceResult {
  price: number
  hasCompetition: boolean
  competitorPrice: number | null
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Query parameters for /api/market-seeder/analyze
 */
export interface MarketSeederParams {
  structure_id: string            // Required: Target structure ID
  limit?: number                  // Max items per category (default: 50)
  minMargin?: number              // Minimum profit margin % (default: 10)
  minProfit?: number              // Minimum profit per unit ISK (default: 100000)
  minVolume?: number              // Minimum daily volume (default: 10)
  noCompetitionOnly?: boolean     // Only show items with no competition (default: false)
  transportCost?: number          // ISK per m³ (default: 450)
  days?: number                   // Days of market history to analyze (default: 30)
}

/**
 * Summary statistics for the analysis
 */
export interface AnalysisSummary {
  totalItemsAnalyzed: number
  itemsPassingFilters: number
  itemsWithCompetition: number
  itemsNoCompetition: number
  avgProfitMargin: number
  avgProfitPerM3: number
}

/**
 * Full API response from /api/market-seeder/analyze
 */
export interface MarketSeederResponse {
  success: boolean
  generatedAt: string
  
  // Config used
  config: {
    structureId: string
    transportCostPerM3: number
    minMarginPct: number
    minProfitIsk: number
    daysAnalyzed: number
  }
  
  // Summary
  summary: AnalysisSummary
  
  // Ranked lists
  topByCompositeScore: ProfitAnalysis[]       // Best overall items
  noCompetitionOpportunities: ProfitAnalysis[] // Items with no competition (40% markup)
  bestIskPerM3: ProfitAnalysis[]               // Best transport efficiency
  trendingUp: ProfitAnalysis[]                 // Items with increasing demand
  
  // Category breakdown
  byCategory: {
    Module: ProfitAnalysis[]
    Ship: ProfitAnalysis[]
    Charge: ProfitAnalysis[]
    Booster: ProfitAnalysis[]
  }
  
  // Timing info
  timing: {
    marketHistoryQueryMs: number
    structureOrdersFetchMs: number
    jitaPriceFetchMs: number
    analysisMs: number
    totalMs: number
  }
}

/**
 * Error response
 */
export interface MarketSeederError {
  success: false
  error: string
  details?: string
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cached structure orders with TTL
 */
export interface CachedStructureOrders {
  data: StructureOrderMap
  fetchedAt: number
  structureId: string
}

/**
 * Cached Jita prices with TTL
 */
export interface CachedJitaPrices {
  data: Map<number, JitaSellPrice>
  fetchedAt: number
}

// ============================================================================
// Algorithm Configuration
// ============================================================================

/**
 * Default configuration values
 */
export const MARKET_SEEDER_DEFAULTS = {
  TRANSPORT_COST_PER_M3: 450,
  MIN_PROFIT_MARGIN_PCT: 10,
  MIN_PROFIT_ISK: 100000,
  MIN_JITA_PRICE: 10000,
  MIN_DAILY_VOLUME: 10,
  NO_COMPETITION_MARKUP: 1.40,  // 40% markup when no competition
  DAYS_TO_ANALYZE: 30,
  
  // Cache TTLs in milliseconds
  STRUCTURE_ORDERS_CACHE_TTL: 5 * 60 * 1000,  // 5 minutes
  JITA_PRICES_CACHE_TTL: 5 * 60 * 1000,       // 5 minutes
  
  // Composite score weights
  WEIGHT_MARGIN: 0.25,
  WEIGHT_PROFIT_PER_M3: 0.30,
  WEIGHT_DEMAND: 0.25,
  WEIGHT_ABSOLUTE_PROFIT: 0.20,
  BONUS_NO_COMPETITION: 15,
  
  // Output limits
  DEFAULT_LIMIT_PER_CATEGORY: 50,
  MAX_LIMIT: 200,
} as const

/**
 * Region IDs for reference
 */
export const REGION_IDS = {
  THE_FORGE: 10000002,  // Jita
  DOMAIN: 10000043,     // Amarr
  SINQ_LAISON: 10000032, // Dodixie
  HEIMATAR: 10000030,   // Rens
} as const

