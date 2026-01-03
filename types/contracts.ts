/**
 * Contract Seeding Types
 * 
 * TypeScript interfaces for the contract analysis feature.
 * Used to identify profitable public contracts where Jita buy price < contract price.
 */

// ============================================================================
// ESI API Response Types
// ============================================================================

/**
 * Public contract from ESI /contracts/public/{region_id}
 */
export interface ESIPublicContract {
  buyout?: number                    // Buyout price (for Auctions only)
  collateral?: number                // Collateral price (for Couriers only)
  contract_id: number
  date_expired: string               // ISO date-time
  date_issued: string                // ISO date-time
  days_to_complete?: number          // Number of days to perform the contract
  end_location_id?: number           // End location ID (for Couriers)
  for_corporation: boolean           // true if issued on behalf of corporation
  issuer_corporation_id: number
  issuer_id: number
  price?: number                     // Price (for ItemsExchange and Auctions)
  reward?: number                    // Remuneration (for Couriers only)
  start_location_id?: number         // Start location ID (for Couriers)
  title?: string
  type: 'unknown' | 'item_exchange' | 'auction' | 'courier' | 'loan'
  volume?: number                    // Volume of items in the contract
}

/**
 * Contract item from ESI /contracts/public/items/{contract_id}
 */
export interface ESIContractItem {
  is_blueprint_copy?: boolean
  is_included: boolean               // true = issuer is selling, false = issuer is buying
  item_id?: number                   // Unique ID for item being sold
  material_efficiency?: number       // ME level (blueprints)
  quantity: number
  record_id: number                  // Unique ID for the record
  runs?: number                      // Runs remaining (blueprint copies), -1 for originals
  time_efficiency?: number           // TE level (blueprints)
  type_id: number
}

// ============================================================================
// Analyzed Types
// ============================================================================

/**
 * Item within an analyzed contract with pricing
 */
export interface ContractItemWithPrice {
  type_id: number
  type_name: string
  quantity: number
  is_included: boolean
  is_blueprint_copy?: boolean
  jita_buy_price: number             // Per-unit Jita buy price
  total_jita_value: number           // quantity * jita_buy_price
}

/**
 * Analyzed contract opportunity with profit metrics
 */
export interface ContractOpportunity {
  // Contract info
  contract_id: number
  type: 'item_exchange' | 'auction'
  title: string | null
  
  // Pricing
  contract_price: number             // Price to buy this contract
  total_jita_value: number           // Sum of all items' Jita values
  
  // Profit metrics
  profit: number                     // contract_price - total_jita_value (negative = profitable to buy)
  profit_margin: number              // (profit / total_jita_value) * 100
  
  // Contract details
  issuer_id: number
  issuer_corporation_id: number
  for_corporation: boolean
  date_issued: string
  date_expired: string
  volume: number | null              // Total volume in m³
  
  // Location
  start_location_id: number | null
  
  // Items
  items: ContractItemWithPrice[]
  item_count: number                 // Number of unique item types
  total_quantity: number             // Total quantity of all items
  
  // Analysis metadata
  items_priced: number               // How many items we could price
  items_missing_price: number        // Items without Jita price data
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Query parameters for /api/contracts/analyze
 */
export interface ContractAnalyzeParams {
  region_id?: number                 // Default: The Forge (10000002)
  min_profit?: number                // Minimum profit in ISK (default: 1000000)
  min_margin?: number                // Minimum profit margin % (default: 5)
  max_contract_price?: number        // Maximum contract price to analyze
  include_auctions?: boolean         // Include auction contracts (default: false)
}

/**
 * Summary statistics for contract analysis
 */
export interface ContractAnalysisSummary {
  total_contracts_fetched: number    // Total contracts from ESI
  item_exchange_contracts: number    // Contracts of type item_exchange
  contracts_analyzed: number         // Contracts we fetched items for
  profitable_contracts: number       // Contracts with positive profit margin
  avg_profit_margin: number          // Average margin of profitable contracts
  total_potential_profit: number     // Sum of all potential profit
}

/**
 * API response from /api/contracts/analyze
 */
export interface ContractAnalyzeResponse {
  success: boolean
  generated_at: string
  region_id: number
  region_name: string
  
  // Summary
  summary: ContractAnalysisSummary
  
  // Profitable opportunities (sorted by profit margin desc)
  opportunities: ContractOpportunity[]
  
  // Config used
  config: {
    min_profit: number
    min_margin: number
    max_contract_price: number | null
    include_auctions: boolean
  }
  
  // Timing
  timing: {
    contracts_fetch_ms: number
    items_fetch_ms: number
    jita_prices_ms: number
    analysis_ms: number
    total_ms: number
  }
}

/**
 * Error response
 */
export interface ContractAnalyzeError {
  success: false
  error: string
  details?: string
}

// ============================================================================
// Progress Types
// ============================================================================

/**
 * Progress state for SSE streaming
 */
export interface ContractAnalysisProgress {
  stage: 'connecting' | 'contracts' | 'items' | 'prices' | 'analyzing' | 'complete' | 'error'
  message: string
  percent: number
  current?: number                   // Current item being processed
  total?: number                     // Total items to process
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Region IDs for contract analysis
 */
export const CONTRACT_REGIONS = [
  { id: 10000002, name: 'The Forge', shortName: 'Jita' },
  { id: 10000043, name: 'Domain', shortName: 'Amarr' },
  { id: 10000032, name: 'Sinq Laison', shortName: 'Dodixie' },
  { id: 10000030, name: 'Heimatar', shortName: 'Rens' },
  { id: 10000042, name: 'Metropolis', shortName: 'Hek' },
] as const

export type ContractRegion = typeof CONTRACT_REGIONS[number]

/**
 * Default configuration values
 */
export const CONTRACT_ANALYSIS_DEFAULTS = {
  REGION_ID: 10000002,               // The Forge (Jita)
  MIN_PROFIT: 1_000_000,             // 1M ISK minimum profit
  MIN_MARGIN: 5,                     // 5% minimum margin
  MAX_CONTRACTS_TO_ANALYZE: 500,     // Limit for performance
  BATCH_SIZE: 20,                    // Concurrent requests for item fetching
} as const

