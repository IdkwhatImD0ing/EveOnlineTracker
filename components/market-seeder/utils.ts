import { type ProfitAnalysis } from "./results-table"
import { 
  type ProfitAnalysis as ApiProfitAnalysis,
  type DepletionPrediction, 
  type WatchlistItem,
  DEFAULT_HUB_FACTOR,
} from "@/types/market-seeder"

// ============================================================================
// Constants
// ============================================================================

/**
 * Known alliance structures for the dropdown
 */
export const KNOWN_STRUCTURES = [
  { id: "1051567430261", name: "3T7-M8 Keepstar" },
] as const

export const DEFAULT_STRUCTURE_ID = "1051567430261"

/**
 * Supply duration presets for the dropdown
 */
export const SUPPLY_DAYS_PRESETS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "1 week" },
  { value: "30", label: "30 days" },
] as const

export const DEFAULT_SUPPLY_DAYS = 7

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format ISK value with suffix (K, M, B)
 */
export function formatIskShort(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`
  }
  return value.toString()
}

/**
 * Transform API ProfitAnalysis to UI ProfitAnalysis with formatted fields
 * Adds all the formatted string values needed for display
 * @param item - API item to transform
 * @param hubFactor - Hub factor for demand estimation (default: 0.05)
 */
export function transformApiItemToUiItem(
  item: ApiProfitAnalysis, 
  hubFactor: number = DEFAULT_HUB_FACTOR
): ProfitAnalysis {
  const iskPerDay = item.profitPerUnit * item.avgDailyVolume * hubFactor
  
  return {
    ...item,
    jitaSellPriceFormatted: formatIskShort(item.jitaSellPrice),
    transportCostFormatted: formatIskShort(item.transportCostPerUnit),
    totalCostFormatted: formatIskShort(item.totalCostPerUnit),
    competitorLowestPriceFormatted: item.competitorLowestPrice !== null 
      ? formatIskShort(item.competitorLowestPrice) 
      : null,
    targetSellPriceFormatted: formatIskShort(item.targetSellPrice),
    profitPerUnitFormatted: formatIskShort(item.profitPerUnit),
    profitMarginPctFormatted: `${item.profitMarginPct.toFixed(0)}%`,
    profitPerM3Formatted: formatIskShort(item.profitPerM3),
    iskPerDay,
    iskPerDayFormatted: formatIskShort(iskPerDay),
    compositeScoreFormatted: item.compositeScore.toFixed(0),
  }
}

/**
 * Transform an array of API items to UI items
 * @param items - API items to transform
 * @param hubFactor - Hub factor for demand estimation (default: 0.05)
 */
export function transformApiItemsToUiItems(
  items: ApiProfitAnalysis[], 
  hubFactor: number = DEFAULT_HUB_FACTOR
): ProfitAnalysis[] {
  return items.map(item => transformApiItemToUiItem(item, hubFactor))
}

/**
 * Get minimum order quantity based on item price
 * Cheaper items need higher minimum orders to be worth the effort
 */
export function getMinOrderQuantity(jitaPrice: number): number {
  if (jitaPrice < 10_000_000) return 20      // < 10M ISK: min 20 units
  if (jitaPrice < 50_000_000) return 10      // < 50M ISK: min 10 units
  if (jitaPrice < 100_000_000) return 5      // < 100M ISK: min 5 units
  return 2                                    // >= 100M ISK: min 2 units
}

/**
 * Generate buy text for Eve Online multibuy
 * Each item gets specified days' supply at hub factor % of regional volume
 * @param items - Items to generate buy text for
 * @param days - Days of supply to order
 * @param hubFactor - Hub factor for demand estimation (default: 0.05)
 */
export function generateBuyText(
  items: ProfitAnalysis[], 
  days: number, 
  hubFactor: number = DEFAULT_HUB_FACTOR
): string {
  return items.map(item => {
    // X days supply at hub factor % of regional volume
    const supplyVolume = item.avgDailyVolume * hubFactor * days
    const minQty = getMinOrderQuantity(item.jitaSellPrice)
    const qty = Math.max(minQty, Math.ceil(supplyVolume))
    return `${item.name} ${qty}`
  }).join('\n')
}

/**
 * Generate restock text for Eve Online multibuy from depletion predictions
 */
export function generateRestockText(
  items: DepletionPrediction[],
  days: number
): string {
  return items.map(item => {
    const qty = Math.max(1, Math.ceil(item.estimatedDailySales * days))
    return `${item.name} ${qty}`
  }).join('\n')
}

/**
 * Generate restock text for Eve Online multibuy from watchlist items
 */
export function generateWatchlistRestockText(
  items: WatchlistItem[],
  days: number
): string {
  return items.map(item => {
    const qty = Math.max(1, Math.ceil(item.estimatedDailySales * days))
    return `${item.item_name} ${qty}`
  }).join('\n')
}

/**
 * Get urgency level based on days until stockout
 */
export function getUrgencyLevel(daysUntilStockout: number | null): 'critical' | 'warning' | 'safe' | 'no-data' {
  if (daysUntilStockout === null) return 'no-data'
  if (daysUntilStockout < 3) return 'critical'
  if (daysUntilStockout <= 7) return 'warning'
  return 'safe'
}

/**
 * Get urgency badge color classes
 */
export function getUrgencyClasses(urgency: ReturnType<typeof getUrgencyLevel>): {
  border: string
  bg: string
  text: string
  badge: string
} {
  switch (urgency) {
    case 'critical':
      return {
        border: 'border-red-500/50',
        bg: 'bg-red-500/5',
        text: 'text-red-500',
        badge: 'bg-red-500/20 text-red-600',
      }
    case 'warning':
      return {
        border: 'border-amber-500/50',
        bg: 'bg-amber-500/5',
        text: 'text-amber-500',
        badge: 'bg-amber-500/20 text-amber-600',
      }
    case 'safe':
      return {
        border: 'border-emerald-500/50',
        bg: 'bg-emerald-500/5',
        text: 'text-emerald-500',
        badge: 'bg-emerald-500/20 text-emerald-600',
      }
    default:
      return {
        border: 'border-muted',
        bg: 'bg-muted/50',
        text: 'text-muted-foreground',
        badge: 'bg-muted text-muted-foreground',
      }
  }
}

