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
 * Stock depletion prediction for a watchlist item
 * Used to predict when items will sell out and prioritize restocking
 */
export interface DepletionPrediction {
  // Item info
  typeId: number
  name: string
  categoryName: string | null
  groupName: string | null
  
  // Stock data
  currentStock: number              // Current units in structure
  lowestPrice: number | null        // Current sell price in structure
  
  // Demand estimation
  jitaDailyVolume: number           // Average daily volume in Jita
  estimatedDailySales: number       // jitaDailyVolume * hubFactor
  
  // Depletion metrics
  daysUntilStockout: number | null  // currentStock / estimatedDailySales (null if no sales)
  
  // Profit metrics
  jitaBuyPrice: number              // Cost to acquire from Jita
  profitPerUnit: number             // lowestPrice - jitaBuyPrice (or estimated)
  dailyProfitPotential: number      // estimatedDailySales * profitPerUnit
  
  // Priority score for ranking
  priorityScore: number             // Higher = more urgent to restock
  
  // User ownership - used for "Hide Owned Items" filter
  userHasInInventory?: boolean      // True if any linked character has this item in their hangar
  userHasSellOrder?: boolean        // True if any linked character has an active sell order for this item
  
  // Competition - true if other sellers have orders for this item
  hasCompetition?: boolean          // True if total structure stock > user's sell order volume
}

/**
 * Hub factor presets for estimating local demand from regional volume
 * The hub factor represents what percentage of regional volume your hub sees
 */
export const HUB_FACTOR_PRESETS = [
  { value: 0.01, label: '1%', description: 'Very small hub' },
  { value: 0.02, label: '2%', description: 'Small hub' },
  { value: 0.05, label: '5%', description: 'Medium hub (default)' },
  { value: 0.10, label: '10%', description: 'Large hub' },
  { value: 0.15, label: '15%', description: 'Very large hub' },
  { value: 0.20, label: '20%', description: 'Major trade hub' },
] as const

export type HubFactorPreset = typeof HUB_FACTOR_PRESETS[number]
export type HubFactorValue = typeof HUB_FACTOR_PRESETS[number]['value']

/**
 * Default hub factor: 5% (0.05)
 */
export const DEFAULT_HUB_FACTOR = 0.05

/**
 * @deprecated Use DEFAULT_HUB_FACTOR instead
 * Kept for backwards compatibility
 */
export const VALE_HUB_FACTOR = DEFAULT_HUB_FACTOR

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
  
  // User ownership (optional - populated when user data is available)
  userHasInInventory?: boolean    // True if any linked character has this item in their hangar
  userHasSellOrder?: boolean      // True if any linked character has an active sell order for this item
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
 * 
 * Note: API now returns all items in a single array. Client handles:
 * - Filtering (by margin, competition, category)
 * - Sorting (by score, margin, profit, etc.)
 * - Pagination
 */
export interface MarketSeederResponse {
  success: boolean
  generatedAt: string
  
  // Config used
  config: {
    structureId: string
    transportCostPerM3: number
    minProfitIsk: number
    minDailyVolume: number
    daysAnalyzed: number
  }
  
  // Summary
  summary: AnalysisSummary
  
  // All items sorted by composite score (client handles filtering/sorting/pagination)
  items: ProfitAnalysis[]
  
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
 * Tiered markup configuration for no-competition pricing
 * Cheaper items can sustain higher margins, expensive items need lower margins
 */
export const NO_COMPETITION_MARKUP_TIERS = [
  { maxPrice: 500_000, multiplier: 4.0 },      // < 500K ISK: 4x (300% margin)
  { maxPrice: 2_000_000, multiplier: 3.0 },    // < 2M ISK: 3x (200% margin)
  { maxPrice: 10_000_000, multiplier: 2.0 },   // < 10M ISK: 2x (100% margin)
  { maxPrice: 50_000_000, multiplier: 1.7 },   // < 50M ISK: 1.7x (70% margin)
  { maxPrice: Infinity, multiplier: 1.4 },     // >= 50M ISK: 1.4x (40% margin)
] as const

/**
 * Default configuration values
 */
export const MARKET_SEEDER_DEFAULTS = {
  TRANSPORT_COST_PER_M3: 450,
  MIN_PROFIT_MARGIN_PCT: 10,
  MIN_PROFIT_ISK: 100000,
  MIN_JITA_PRICE: 10000,
  MIN_DAILY_VOLUME: 10,
  NO_COMPETITION_MARKUP: 1.40,  // Fallback markup (used for >= 50M ISK items)
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
  THE_FORGE: 10000002,      // Jita
  VALE_OF_SILENT: 10000003, // Vale of the Silent (alliance hub)
  DEKLEIN: 10000035,        // Deklein (null-sec)
  DOMAIN: 10000043,         // Amarr
  SINQ_LAISON: 10000032,    // Dodixie
  HEIMATAR: 10000030,       // Rens
} as const

export type RegionId = typeof REGION_IDS[keyof typeof REGION_IDS]

/**
 * Volume regions available for market analysis
 * These are regions with market history data for volume/demand metrics
 */
export const VOLUME_REGIONS = [
  { id: REGION_IDS.VALE_OF_SILENT, name: 'Vale of the Silent', shortName: 'Vale', description: 'Null-sec alliance territory' },
  { id: REGION_IDS.DEKLEIN, name: 'Deklein', shortName: 'Deklein', description: 'Null-sec (Goonswarm)' },
  { id: REGION_IDS.THE_FORGE, name: 'The Forge', shortName: 'Jita', description: 'High-sec trade hub' },
] as const

export type VolumeRegion = typeof VOLUME_REGIONS[number]
export const DEFAULT_VOLUME_REGION_ID = REGION_IDS.VALE_OF_SILENT

// ============================================================================
// Capital Efficiency Types
// ============================================================================

/**
 * Dead capital threshold in days
 * Orders taking longer than this to sell are considered "dead capital"
 */
export const DEAD_CAPITAL_THRESHOLD_DAYS = 90

/**
 * Capital efficiency analysis for a single sell order
 */
export interface CapitalOrder {
  // Order info
  orderId: number
  typeId: number
  itemName: string
  categoryName: string | null
  groupName: string | null
  
  // Character info - which account owns this order
  characterId: number
  characterName: string
  
  // Order details
  price: number                    // Sell price per unit
  volumeRemain: number             // Units remaining
  volumeTotal: number              // Original order volume
  locationId: number               // Structure ID
  issued: string                   // ISO date string
  
  // Capital metrics
  capitalDeployed: number          // price * volumeRemain (ISK tied up)
  
  // Demand estimation
  jitaDailyVolume: number          // Avg daily volume in Jita
  estimatedDailySales: number      // jitaDailyVolume * hubFactor
  
  // Time metrics
  daysToSell: number | null        // volumeRemain / estimatedDailySales
  daysListed: number               // Days since order was created
  
  // Profit metrics (requires Jita price)
  jitaBuyPrice: number | null      // Cost to acquire from Jita
  transportCost: number            // Estimated transport cost
  profitPerUnit: number | null     // price - jitaBuyPrice - transportCost
  totalProfit: number | null       // profitPerUnit * volumeRemain
  
  // APY calculation
  effectiveAPY: number | null      // (profit/cost) * (365/daysToSell) * 100
  
  // Status flags
  isDeadCapital: boolean           // daysToSell > threshold
  efficiency: 'fast' | 'moderate' | 'slow' | 'dead' | 'unknown'
}

/**
 * Per-character capital summary
 */
export interface CharacterCapitalSummary {
  characterId: number
  characterName: string
  capitalDeployed: number           // Total ISK deployed by this character
  orderCount: number                // Number of orders
  percentage: number                // Percentage of total capital
  dailyRevenue: number              // Estimated daily revenue
  effectiveAPY: number              // Character's portfolio APY
}

/**
 * Full capital efficiency analysis response
 */
export interface CapitalEfficiencyResponse {
  success: boolean
  characterId: number
  analyzedAt: string
  
  // Summary metrics
  summary: {
    totalCapitalDeployed: number     // Sum of all sell order values
    totalOrders: number              // Number of active sell orders
    totalDailyRevenue: number        // Estimated daily revenue
    avgDaysToSell: number            // Capital-weighted average
    effectiveAPY: number             // Portfolio-wide APY
    
    // Dead capital
    deadCapitalThreshold: number     // Days threshold used
    deadCapitalValue: number         // ISK in slow orders
    deadCapitalOrders: number        // Count of dead orders
    
    // Breakdown by efficiency
    fastCapital: number              // ISK in <14 day orders
    moderateCapital: number          // ISK in 14-30 day orders
    slowCapital: number              // ISK in 30-90 day orders
    
    // Breakdown by character
    byCharacter: CharacterCapitalSummary[]
  }
  
  // Per-order breakdown
  orders: CapitalOrder[]
  
  // Config used
  config: {
    hubFactor: number
    transportCostPerM3: number
    deadCapitalThresholdDays: number
  }
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Progress state for SSE streaming operations
 */
export interface ProgressState {
  stage: string
  message: string
  percent: number
}

// ============================================================================
// Watchlist Types
// ============================================================================

/**
 * Watchlist item with stock and depletion metrics
 */
export interface WatchlistItem {
  id: string
  type_id: number
  item_name: string
  group_name: string | null
  category_name: string | null
  volume: number | null
  created_at: string
  stock: number
  lowest_price: number | null
  needs_restock: boolean
  // Depletion metrics
  estimatedDailySales: number
  daysUntilStockout: number | null
  jitaPrice: number | null
  profitPerUnit: number
  dailyProfit: number
  // Sell order status - true if user has a sell order for this item
  hasSellOrder: boolean
}

/**
 * Watchlist API response
 */
export interface WatchlistResponse {
  success: boolean
  items: WatchlistItem[]
  structure_id: string | null
  checked_at: string | null
  summary?: {
    total: number
    needs_restock: number
    in_stock: number
    criticalCount: number
    warningCount: number
    okCount: number
    noDataCount: number
    totalDailyProfit: number
  }
}

// ============================================================================
// Undercut Tracker Types
// ============================================================================

/**
 * Item being undercut by a competitor
 */
export interface UndercutItem {
  type_id: number
  type_name: string
  your_order_id: number
  your_price: number
  your_price_formatted: string
  your_volume_remain: number
  competitor_price: number
  competitor_price_formatted: string
  competitor_order_id: number
  undercut_price: number
  undercut_price_formatted: string
  undercut_price_eve: string
  price_difference: number
  price_difference_formatted: string
  tick_size: number
  // Days to lowest calculation
  competitors_below_count: number
  competitors_below_volume: number
  vale_daily_volume: number
  estimated_daily_sales: number
  days_to_lowest: number | null
  // Character info - which account owns this order
  character_id: number
  character_name: string
  // Profitability fields
  jita_price: number | null
  jita_price_formatted: string | null
  volume: number  // m³
  min_profitable_price: number | null  // jita_price * 1.1 + (volume * 500)
  min_profitable_price_formatted: string | null
  is_profitable: boolean  // undercut_price >= min_profitable_price
}

/**
 * Item where you have the lowest price
 */
export interface SafeItem {
  type_id: number
  type_name: string
  your_order_id: number
  your_price: number
  your_price_formatted: string
  your_volume_remain: number
  next_competitor_price: number | null
  next_competitor_price_formatted: string | null
  // Character info - which account owns this order
  character_id: number
  character_name: string
}

/**
 * Undercut check API response
 */
export interface UndercutData {
  undercut_items: UndercutItem[]
  safe_items: SafeItem[]
  summary: {
    undercut_count: number
    profitable_undercut_count: number
    unprofitable_undercut_count: number
    safe_count: number
    total_orders_in_structure: number
    structure_id: string
    total_structure_orders: number
  }
  timing: {
    total_ms: number
  }
}

// ============================================================================
// Sell Order Generator Types
// ============================================================================

/**
 * Character info for sell order items
 */
export interface SellOrderItemCharacter {
  id: number
  name: string
}

/**
 * Item for sell order generation
 */
export interface SellOrderItem {
  type_id: number
  type_name: string
  quantity: number
  characters: SellOrderItemCharacter[]  // Characters that have this item in inventory
  has_competition: boolean
  has_existing_order: boolean  // True if user already has a sell order for this item
  order_characters: SellOrderItemCharacter[]  // Characters that have active sell orders for this item
  jita_price: number
  jita_price_formatted: string
  competitor_price: number | null
  competitor_price_formatted: string | null
  sell_price: number
  sell_price_formatted: string
  sell_price_eve: string
  vale_daily_volume: number
  estimated_daily_sales: number
  isk_per_day: number
  isk_per_day_formatted: string
}

/**
 * Item with existing sell order (filtered out)
 */
export interface ExistingOrderItem {
  type_id: number
  type_name: string
  quantity: number
  characters: SellOrderItemCharacter[]  // Characters that have this item in inventory
  order_characters: SellOrderItemCharacter[]  // Characters that have sell orders for this item
}

/**
 * Sell order generator API response
 */
export interface SellOrderData {
  items: SellOrderItem[]
  items_with_existing_orders: ExistingOrderItem[]  // Backwards compat - derived from items with has_existing_order
  summary: {
    total_items: number
    total_with_competition: number
    total_no_competition: number
    total_isk_per_day: number
    total_isk_per_day_formatted: string
    total_with_existing_orders: number  // Count of items with existing sell orders
  }
  timing: {
    total_ms: number
  }
}

// ============================================================================
// Analysis Response Types
// ============================================================================

/**
 * Analysis response from /api/market-seeder/analyze (SSE streaming)
 */
export interface AnalysisResponse {
  success: boolean
  generatedAt: string
  config: {
    structureId: string
    transportCostPerM3: number
    minProfitIsk: number
    minDailyVolume: number
    daysAnalyzed: number
  }
  summary: {
    totalItemsAnalyzed: number
    itemsPassingFilters: number
    itemsWithCompetition: number
    itemsNoCompetition: number
    avgProfitMargin: number
    avgProfitPerM3: number
  }
  items: ProfitAnalysis[]
  timing: {
    totalMs: number
  }
}

// ============================================================================
// Order History Types
// ============================================================================

/**
 * Historical order item aggregated by type
 * Shows profit performance for completed sell orders
 */
export interface HistoricalOrderItem {
  typeId: number
  typeName: string
  categoryName: string | null
  quantitySold: number
  orderCount: number
  avgSellPrice: number
  totalRevenue: number
  jitaPrice: number | null
  estimatedCost: number      // Jita + transport
  totalProfit: number
  profitMargin: number       // percentage
}

/**
 * Order history API response
 */
export interface OrderHistoryData {
  success: boolean
  items: HistoricalOrderItem[]
  summary: {
    totalOrders: number
    totalRevenue: number
    totalProfit: number
    avgProfitMargin: number
    charactersQueried: number
  }
  period: '3d' | '7d' | '30d'
  analyzedAt: string
  config: {
    transportCostPerM3: number
  }
}

/**
 * Time period options for order history
 */
export const ORDER_HISTORY_PERIODS = [
  { value: '3d', label: '3 Days', days: 3 },
  { value: '7d', label: '7 Days', days: 7 },
  { value: '30d', label: '30 Days', days: 30 },
] as const

export type OrderHistoryPeriod = '3d' | '7d' | '30d'

// ============================================================================
// Trading Velocity Types
// ============================================================================

/**
 * Daily profit entry for velocity tracking
 */
export interface DailyProfitEntry {
  date: string           // YYYY-MM-DD format
  profit: number         // ISK profit for the day
  revenue: number        // Total ISK revenue
  orders: number         // Number of orders completed
}

/**
 * Top performing item for velocity analysis
 */
export interface TopPerformerItem {
  typeId: number
  typeName: string
  categoryName: string | null
  totalProfit: number
  totalRevenue: number
  orderCount: number
  quantitySold: number
  profitPerDay: number   // Average profit per day over the period
}

/**
 * Trend analysis for trading performance
 */
export interface VelocityTrend {
  direction: 'up' | 'down' | 'stable'
  percentChange: number   // Percentage change between recent and older periods
  recentAvg: number       // Average profit for last 7 days
  olderAvg: number        // Average profit for days before last 7
}

/**
 * Summary statistics for velocity analysis
 */
export interface VelocitySummary {
  avgProfitPerDay: number
  bestDay: { date: string; profit: number }
  worstDay: { date: string; profit: number }
  totalProfit: number
  totalRevenue: number
  totalOrders: number
  daysWithData: number
  charactersQueried: number
}

/**
 * Trading velocity API response
 */
export interface TradingVelocityResponse {
  success: boolean
  dailyProfit: DailyProfitEntry[]
  topItems: TopPerformerItem[]
  trend: VelocityTrend
  summary: VelocitySummary
  period: VelocityPeriod
  analyzedAt: string
  config: {
    transportCostPerM3: number
  }
}

/**
 * Trading goal stored in localStorage
 */
export interface TradingGoal {
  dailyTarget: number          // Target ISK per day (e.g., 1_000_000_000)
  setAt: string                // ISO date when goal was set
  notificationsEnabled: boolean
}

/**
 * Time period options for velocity analysis
 */
export const VELOCITY_PERIODS = [
  { value: '7d', label: '7 Days', days: 7 },
  { value: '30d', label: '30 Days', days: 30 },
  { value: '90d', label: '90 Days', days: 90 },
] as const

export type VelocityPeriod = '7d' | '30d' | '90d'

