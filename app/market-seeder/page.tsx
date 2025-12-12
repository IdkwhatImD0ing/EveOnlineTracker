"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  ShoppingCart,
  AlertCircle,
  Minus,
  Package,
  RefreshCw,
  Settings2,
  ChevronDown,
  Database,
  Globe,
  BarChart3,
  Copy,
  Check,
  X,
  CheckSquare,
  Eye,
  Trash2,
  AlertTriangle,
  Clock,
  Timer,
  DollarSign,
  Percent,
  Skull,
  HelpCircle,
} from "lucide-react"
import { type CapitalEfficiencyResponse, DEAD_CAPITAL_THRESHOLD_DAYS } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { ItemSearch, TradeableItem } from "@/components/market/item-search"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { FilterSidebar, FilterState, DEFAULT_FILTERS } from "@/components/market-seeder/filter-sidebar"
import { ResultsTable, ProfitAnalysis } from "@/components/market-seeder/results-table"

// Known alliance structures for the dropdown
const KNOWN_STRUCTURES = [
  { id: "1051567430261", name: "3T7-M8 Keepstar" },
] as const

const DEFAULT_STRUCTURE_ID = "1051567430261"

// Supply duration presets for the dropdown
const SUPPLY_DAYS_PRESETS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "1 week" },
  { value: "30", label: "30 days" },
] as const

const DEFAULT_SUPPLY_DAYS = 7

interface TokenData {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

/**
 * Check if a JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(base64))
    // exp is in seconds, Date.now() is in milliseconds
    // Add 60 second buffer to refresh before actual expiry
    return payload.exp * 1000 < Date.now() + 60000
  } catch {
    return true // Assume expired if can't parse
  }
}

/**
 * Extract character_id from JWT token
 */
function getCharacterIdFromToken(token: string): string | null {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(base64))
    // EVE SSO tokens have sub in format "CHARACTER:EVE:<character_id>"
    const sub = payload.sub as string
    if (sub && sub.startsWith("CHARACTER:EVE:")) {
      return sub.replace("CHARACTER:EVE:", "")
    }
    return null
  } catch {
    return null
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
  try {
    const response = await fetch("/api/auth/eve/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch {
    return null
  }
}

// ProfitAnalysis is now imported from @/components/market-seeder/results-table

interface AnalysisResponse {
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

interface ProgressState {
  stage: string
  message: string
  percent: number
}

interface WatchlistItem {
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
}

interface WatchlistResponse {
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

interface DepletionPrediction {
  typeId: number
  name: string
  categoryName: string | null
  groupName: string | null
  currentStock: number
  lowestPrice: number | null
  jitaDailyVolume: number
  estimatedDailySales: number
  daysUntilStockout: number | null
  jitaBuyPrice: number
  profitPerUnit: number
  dailyProfitPotential: number
  priorityScore: number
}

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  loading: Package,
  market_history: Database,
  structure_orders: Globe,
  jita_prices: Globe,
  analyzing: BarChart3,
  filtering: BarChart3,
  scoring: BarChart3,
  ranking: BarChart3,
  // Depletion stages
  starting: Timer,
  orders: Globe,
  items: Package,
  market: Database,
  sorting: BarChart3,
  summary: BarChart3,
}

function ProgressBar({ progress }: { progress: ProgressState }) {
  const StageIcon = STAGE_ICONS[progress.stage] || Loader2

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <StageIcon className={`size-5 ${progress.percent < 100 ? "animate-pulse" : ""} text-primary`} />
        <span className="text-sm font-medium">{progress.message}</span>
        <span className="text-sm text-muted-foreground ml-auto">{progress.percent}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Generate buy text for Eve Online multibuy
 * Each item gets specified days' supply at 5% of Vale volume
 */
/**
 * Get minimum order quantity based on item price
 * Cheaper items need higher minimum orders to be worth the effort
 */
function getMinOrderQuantity(jitaPrice: number): number {
  if (jitaPrice < 10_000_000) return 20      // < 10M ISK: min 20 units
  if (jitaPrice < 50_000_000) return 10      // < 50M ISK: min 10 units
  if (jitaPrice < 100_000_000) return 5      // < 100M ISK: min 5 units
  return 2                                    // >= 100M ISK: min 2 units
}

function generateBuyText(items: ProfitAnalysis[], days: number): string {
  return items.map(item => {
    // X days supply at 5% of Vale volume
    const supplyVolume = item.avgDailyVolume * 0.05 * days
    const minQty = getMinOrderQuantity(item.jitaSellPrice)
    const qty = Math.max(minQty, Math.ceil(supplyVolume))
    return `${item.name} ${qty}`
  }).join('\n')
}

/**
 * Format ISK value with suffix (M, B)
 */
function formatIskShort(value: number): string {
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

export default function MarketSeederPage() {
  // Search form state (sent to API)
  const [structureId, setStructureId] = useState(DEFAULT_STRUCTURE_ID)
  const [isCustomStructure, setIsCustomStructure] = useState(false)
  const [transportCost, setTransportCost] = useState("450")
  const [minProfit, setMinProfit] = useState("100000")
  const [minVolume, setMinVolume] = useState("10") // Minimum daily volume
  const [supplyDays, setSupplyDays] = useState(DEFAULT_SUPPLY_DAYS) // Days of supply to buy
  const [isCustomSupplyDays, setIsCustomSupplyDays] = useState(false)

  // Sidebar filter state (client-side filtering)
  const [filters, setFilters] = useState<FilterState>({
    minMargin: DEFAULT_FILTERS.minMargin,
    maxJitaCost: DEFAULT_FILTERS.maxJitaCost,
    noCompetitionOnly: DEFAULT_FILTERS.noCompetitionOnly,
    selectedCategories: new Set(DEFAULT_FILTERS.selectedCategories),
  })

  // Analysis state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [copySuccess, setCopySuccess] = useState(false)

  // Watchlist state
  const [activeMainTab, setActiveMainTab] = useState<"capital" | "analysis" | "watchlist" | "depletion">("capital")
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([])
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [watchlistCheckedAt, setWatchlistCheckedAt] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [watchlistInitialized, setWatchlistInitialized] = useState(false)
  const [watchlistCopySuccess, setWatchlistCopySuccess] = useState(false)
  const [restockDays, setRestockDays] = useState(7)
  const [restockTopN, setRestockTopN] = useState<number | null>(null) // null = all items
  const [includeCritical, setIncludeCritical] = useState(true)
  const [includeWarning, setIncludeWarning] = useState(true)

  // Depletion predictor state
  const [depletionPredictions, setDepletionPredictions] = useState<DepletionPrediction[]>([])
  const [depletionLoading, setDepletionLoading] = useState(false)
  const [depletionError, setDepletionError] = useState<string | null>(null)
  const [depletionAnalyzedAt, setDepletionAnalyzedAt] = useState<string | null>(null)
  const [depletionProgress, setDepletionProgress] = useState<ProgressState | null>(null)
  const [depletionSummary, setDepletionSummary] = useState<{
    totalItems: number
    criticalCount: number
    warningCount: number
    okCount: number
    noDataCount: number
    totalDailyProfit: number
  } | null>(null)
  const [depletionCopySuccess, setDepletionCopySuccess] = useState(false)
  const [depletionRestockDays, setDepletionRestockDays] = useState(7)
  const [depletionRestockTopN, setDepletionRestockTopN] = useState<number | null>(null)
  const [depletionIncludeCritical, setDepletionIncludeCritical] = useState(true)
  const [depletionIncludeWarning, setDepletionIncludeWarning] = useState(true)

  // Capital efficiency state
  const [capitalData, setCapitalData] = useState<CapitalEfficiencyResponse | null>(null)
  const [capitalLoading, setCapitalLoading] = useState(false)
  const [capitalError, setCapitalError] = useState<string | null>(null)

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem("market-seeder-settings")
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        if (settings.structureId) {
          setStructureId(settings.structureId)
          // Check if it's a custom structure ID
          if (!KNOWN_STRUCTURES.some(s => s.id === settings.structureId)) {
            setIsCustomStructure(true)
          }
        }
        if (settings.transportCost) setTransportCost(settings.transportCost)
        if (settings.minProfit) setMinProfit(settings.minProfit)
        if (settings.minVolume) setMinVolume(settings.minVolume)
        // Load sidebar filter settings
        if (settings.filters) {
          setFilters({
            minMargin: settings.filters.minMargin ?? DEFAULT_FILTERS.minMargin,
            maxJitaCost: settings.filters.maxJitaCost ?? DEFAULT_FILTERS.maxJitaCost,
            noCompetitionOnly: settings.filters.noCompetitionOnly ?? DEFAULT_FILTERS.noCompetitionOnly,
            selectedCategories: settings.filters.selectedCategories 
              ? new Set(settings.filters.selectedCategories) 
              : new Set(DEFAULT_FILTERS.selectedCategories),
          })
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [])

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem(
      "market-seeder-settings",
      JSON.stringify({ 
        structureId, 
        transportCost, 
        minProfit, 
        minVolume,
        filters: {
          minMargin: filters.minMargin,
          maxJitaCost: filters.maxJitaCost,
          noCompetitionOnly: filters.noCompetitionOnly,
          selectedCategories: Array.from(filters.selectedCategories),
        }
      })
    )
  }, [structureId, transportCost, minProfit, minVolume, filters])

  // Selection helper functions
  const toggleItemSelection = useCallback((typeId: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }, [])

  const selectAllItems = useCallback((items: ProfitAnalysis[]) => {
    setSelectedItems(prev => {
      const allSelected = items.every(item => prev.has(item.typeId))
      if (allSelected) {
        // Deselect all items in this list
        const next = new Set(prev)
        items.forEach(item => next.delete(item.typeId))
        return next
      } else {
        // Select all items in this list
        const next = new Set(prev)
        items.forEach(item => next.add(item.typeId))
        return next
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  // Wrapper to clear selection when filters change
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
    setSelectedItems(new Set())
  }, [])

  // Get all selected items from the result
  const getSelectedItemsData = useCallback((): ProfitAnalysis[] => {
    if (!result) return []
    return result.items.filter(item => selectedItems.has(item.typeId))
  }, [result, selectedItems])

  // Filter items based on sidebar filters (client-side)
  const filteredItems = useMemo(() => {
    if (!result) return []
    return result.items.filter(item => 
      item.profitMarginPct >= filters.minMargin &&
      (filters.maxJitaCost === null || item.jitaSellPrice <= filters.maxJitaCost) &&
      filters.selectedCategories.has(item.categoryName) &&
      (!filters.noCompetitionOnly || !item.hasCompetition)
    )
  }, [result, filters])

  // Copy buy text to clipboard
  const copyBuyText = useCallback(async () => {
    const items = getSelectedItemsData()
    if (items.length === 0) return

    // Calculate X days supply at 5% of Vale volume for each item
    const buyText = generateBuyText(items, supplyDays)

    try {
      await navigator.clipboard.writeText(buyText)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [getSelectedItemsData, supplyDays])

  /**
   * Get a valid access token, refreshing if needed
   */
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const savedTokens = localStorage.getItem("eve_sso_tokens")
    if (!savedTokens) return null

    try {
      const parsed = JSON.parse(savedTokens) as TokenData
      
      // Check if token is expired
      if (isTokenExpired(parsed.access_token)) {
        console.log("[Market Seeder] Token expired, refreshing...")
        
        // Try to refresh
        const newTokens = await refreshAccessToken(parsed.refresh_token)
        if (!newTokens) {
          // Refresh failed - user needs to re-login
          localStorage.removeItem("eve_sso_tokens")
          return null
        }

        // Save new tokens
        localStorage.setItem("eve_sso_tokens", JSON.stringify(newTokens))
        console.log("[Market Seeder] Token refreshed successfully")
        return newTokens.access_token
      }

      return parsed.access_token
    } catch {
      return null
    }
  }, [])

  const runAnalysis = useCallback(async () => {
    if (!structureId) {
      setError("Structure ID is required")
      return
    }

    // Get valid token (refresh if expired)
    const accessToken = await getValidToken()
    
    if (!accessToken) {
      setError("Please login with EVE SSO first to access structure market data")
      return
    }

    setIsLoading(true)
    setError(null)
    setProgress({ stage: "connecting", message: "Connecting to server...", percent: 0 })
    clearSelection() // Reset selected items on new search

    try {
      const params = new URLSearchParams({
        structure_id: structureId,
        transportCost,
        minProfit,
        minVolume,
        stream: "true",  // Enable SSE streaming
      })

      // EventSource doesn't support Authorization headers, so we use fetch with streaming
      const response = await fetch(`/api/market-seeder/analyze?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Analysis failed")
      }

      // Check if it's a streaming response
      const contentType = response.headers.get("content-type")
      
      if (contentType?.includes("text/event-stream")) {
        // Handle SSE streaming
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let currentEventType = ""
        let currentEventData = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            
            // Process complete lines in buffer
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""  // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                currentEventData = line.slice(6)
              } else if (line === "") {
                // Empty line = end of event
                if (currentEventType && currentEventData) {
                  try {
                    const data = JSON.parse(currentEventData)
                    
                    if (currentEventType === "progress") {
                      setProgress({
                        stage: data.stage,
                        message: data.message,
                        percent: data.percent,
                      })
                    } else if (currentEventType === "complete") {
                      setResult(data)
                      setProgress(null)
                    } else if (currentEventType === "error") {
                      throw new Error(data.message)
                    }
                  } catch (e) {
                    if (e instanceof SyntaxError) {
                      console.warn("Failed to parse SSE data:", currentEventData)
                    } else {
                      throw e
                    }
                  }
                }
                // Reset for next event
                currentEventType = ""
                currentEventData = ""
              }
            }
          }
          
          // Process any remaining data after stream ends
          if (currentEventType && currentEventData) {
            try {
              const data = JSON.parse(currentEventData)
              if (currentEventType === "complete") {
                setResult(data)
                setProgress(null)
              }
            } catch {
              console.warn("Failed to parse final SSE data")
            }
          }
        }
      } else {
        // Regular JSON response (non-streaming fallback)
        const data = await response.json()
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis")
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }, [structureId, transportCost, minProfit, minVolume, getValidToken, clearSelection])

  // Watchlist functions
  const fetchWatchlist = useCallback(async (checkStock: boolean = true) => {
    setWatchlistLoading(true)
    setWatchlistError(null)

    try {
      const url = '/api/watchlist'
      
      if (checkStock && structureId) {
        const accessToken = await getValidToken()
        if (!accessToken) {
          setWatchlistError("Please login with EVE SSO to check stock levels")
          setWatchlistLoading(false)
          return
        }
        
        const response = await fetch(`${url}?structure_id=${structureId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to fetch watchlist")
        }

        const data: WatchlistResponse = await response.json()
        setWatchlistItems(data.items)
        setWatchlistCheckedAt(data.checked_at)
      } else {
        // Just fetch the list without stock info
        const response = await fetch(url)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to fetch watchlist")
        }
        const data: WatchlistResponse = await response.json()
        setWatchlistItems(data.items)
        setWatchlistCheckedAt(null)
      }
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Failed to fetch watchlist")
    } finally {
      setWatchlistLoading(false)
      setWatchlistInitialized(true)
    }
  }, [structureId, getValidToken])

  const addToWatchlist = useCallback(async (item: TradeableItem) => {
    setAddingItem(true)
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: item.typeId,
          itemName: item.name,
          groupName: item.groupName,
          categoryName: item.categoryName,
          volume: item.volume,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add item")
      }

      // Refresh the watchlist
      await fetchWatchlist(false)
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Failed to add item")
    } finally {
      setAddingItem(false)
    }
  }, [fetchWatchlist])

  const removeFromWatchlist = useCallback(async (typeId: number) => {
    try {
      const response = await fetch(`/api/watchlist/${typeId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to remove item")
      }

      // Update local state immediately
      setWatchlistItems(prev => prev.filter(item => item.type_id !== typeId))
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Failed to remove item")
    }
  }, [])

  // Categorize watchlist items by urgency level
  const watchlistItemsByUrgency = useMemo(() => {
    const critical: WatchlistItem[] = []
    const warning: WatchlistItem[] = []
    
    for (const item of watchlistItems) {
      // Stock 0 = critical, or < 3 days
      if ((item.stock ?? 0) === 0) {
        critical.push(item)
      } else if (item.daysUntilStockout !== null) {
        if (item.daysUntilStockout < 3) {
          critical.push(item)
        } else if (item.daysUntilStockout < 7) {
          warning.push(item)
        }
      }
    }
    
    return { critical, warning }
  }, [watchlistItems])

  // Get items that need restocking based on checkbox filters
  const watchlistItemsToRestock = useMemo(() => {
    const items: WatchlistItem[] = []
    if (includeCritical) items.push(...watchlistItemsByUrgency.critical)
    if (includeWarning) items.push(...watchlistItemsByUrgency.warning)
    return items
  }, [watchlistItemsByUrgency, includeCritical, includeWarning])

  // Items that will actually be copied (after applying topN filter)
  const watchlistItemsToCopy = useMemo(() => {
    if (restockTopN !== null) {
      return watchlistItemsToRestock.slice(0, restockTopN)
    }
    return watchlistItemsToRestock
  }, [watchlistItemsToRestock, restockTopN])

  // Copy watchlist restock items to clipboard
  const copyWatchlistBuyText = useCallback(async () => {
    if (watchlistItemsToCopy.length === 0) return

    // Generate buy text with configurable days of supply
    const buyText = watchlistItemsToCopy.map(item => {
      const qty = Math.max(1, Math.ceil((item.estimatedDailySales ?? 0) * restockDays))
      return `${item.item_name} ${qty}`
    }).join('\n')

    try {
      await navigator.clipboard.writeText(buyText)
      setWatchlistCopySuccess(true)
      setTimeout(() => setWatchlistCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [watchlistItemsToCopy, restockDays])

  // Categorize depletion predictions by urgency level
  const depletionItemsByUrgency = useMemo(() => {
    const critical: DepletionPrediction[] = []
    const warning: DepletionPrediction[] = []
    
    for (const item of depletionPredictions) {
      if (item.daysUntilStockout !== null) {
        if (item.daysUntilStockout < 3) {
          critical.push(item)
        } else if (item.daysUntilStockout < 7) {
          warning.push(item)
        }
      }
    }
    
    return { critical, warning }
  }, [depletionPredictions])

  // Get depletion items to restock based on checkbox filters
  const depletionItemsToRestock = useMemo(() => {
    const items: DepletionPrediction[] = []
    if (depletionIncludeCritical) items.push(...depletionItemsByUrgency.critical)
    if (depletionIncludeWarning) items.push(...depletionItemsByUrgency.warning)
    return items
  }, [depletionItemsByUrgency, depletionIncludeCritical, depletionIncludeWarning])

  // Depletion items that will actually be copied (after applying topN filter)
  const depletionItemsToCopy = useMemo(() => {
    if (depletionRestockTopN !== null) {
      return depletionItemsToRestock.slice(0, depletionRestockTopN)
    }
    return depletionItemsToRestock
  }, [depletionItemsToRestock, depletionRestockTopN])

  // Copy depletion restock items to clipboard
  const copyDepletionBuyText = useCallback(async () => {
    if (depletionItemsToCopy.length === 0) return

    // Generate buy text with configurable days of supply
    const buyText = depletionItemsToCopy.map(item => {
      const qty = Math.max(1, Math.ceil(item.estimatedDailySales * depletionRestockDays))
      return `${item.name} ${qty}`
    }).join('\n')

    try {
      await navigator.clipboard.writeText(buyText)
      setDepletionCopySuccess(true)
      setTimeout(() => setDepletionCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [depletionItemsToCopy, depletionRestockDays])

  // Depletion predictor analysis - analyzes ALL sell orders in structure with SSE progress
  const analyzeDepletion = useCallback(async () => {
    if (!structureId) {
      setDepletionError("Structure ID is required")
      return
    }

    const accessToken = await getValidToken()
    if (!accessToken) {
      setDepletionError("Please login with EVE SSO first")
      return
    }

    setDepletionLoading(true)
    setDepletionError(null)
    setDepletionProgress({ stage: "starting", message: "Connecting...", percent: 0 })

    try {
      const response = await fetch(
        `/api/market-seeder/depletion?structure_id=${structureId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to start analysis")
      }

      // Handle SSE streaming
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let currentEventType = ""
      let currentEventData = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          
          // Process complete lines in buffer
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim()
            } else if (line.startsWith("data: ")) {
              currentEventData = line.slice(6)
            } else if (line === "") {
              // Empty line = end of event
              if (currentEventType && currentEventData) {
                try {
                  const data = JSON.parse(currentEventData)
                  
                  if (currentEventType === "progress") {
                    setDepletionProgress({
                      stage: data.stage,
                      message: data.message,
                      percent: data.percent,
                    })
                  } else if (currentEventType === "complete") {
                    setDepletionPredictions(data.predictions)
                    setDepletionSummary(data.summary)
                    setDepletionAnalyzedAt(data.analyzedAt)
                    setDepletionProgress(null)
                  } else if (currentEventType === "error") {
                    throw new Error(data.message)
                  }
                } catch (e) {
                  if (e instanceof SyntaxError) {
                    console.warn("Failed to parse SSE data:", currentEventData)
                  } else {
                    throw e
                  }
                }
              }
              currentEventType = ""
              currentEventData = ""
            }
          }
        }
      }

    } catch (err) {
      setDepletionError(err instanceof Error ? err.message : "Failed to analyze depletion")
    } finally {
      setDepletionLoading(false)
      setDepletionProgress(null)
    }
  }, [structureId, getValidToken])

  // Capital efficiency analysis
  const fetchCapitalEfficiency = useCallback(async () => {
    const accessToken = await getValidToken()
    if (!accessToken) {
      setCapitalError("Please login with EVE SSO first")
      return
    }

    const characterId = getCharacterIdFromToken(accessToken)
    if (!characterId) {
      setCapitalError("Could not extract character ID from token")
      return
    }

    setCapitalLoading(true)
    setCapitalError(null)

    try {
      const params = new URLSearchParams({
        character_id: characterId,
        transport_cost: transportCost,
      })

      const response = await fetch(`/api/esi/capital-efficiency?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch capital efficiency data")
      }

      const data: CapitalEfficiencyResponse = await response.json()
      setCapitalData(data)

    } catch (err) {
      setCapitalError(err instanceof Error ? err.message : "Failed to analyze capital efficiency")
    } finally {
      setCapitalLoading(false)
    }
  }, [getValidToken, transportCost])

  // Load capital data when switching to capital tab
  useEffect(() => {
    if (activeMainTab === "capital" && !capitalData && !capitalLoading && !capitalError) {
      fetchCapitalEfficiency()
    }
  }, [activeMainTab, capitalData, capitalLoading, capitalError, fetchCapitalEfficiency])

  // Load watchlist when switching to watchlist tab (only once per session)
  useEffect(() => {
    if (activeMainTab === "watchlist" && !watchlistInitialized && !watchlistLoading) {
      fetchWatchlist(false)
    }
  }, [activeMainTab, watchlistInitialized, watchlistLoading, fetchWatchlist])

  // Get existing watchlist type IDs for filtering search results
  const existingWatchlistTypeIds = new Set(watchlistItems.map(item => item.type_id))

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ShoppingCart className="size-8" />
              Market Seeder
            </h1>
            <p className="text-muted-foreground">
              Find the most profitable items to import from Jita to your alliance hub
            </p>
          </div>
        </header>

        {/* Main Tabs: Capital / Analysis / Watchlist / Depletion */}
        <Tabs value={activeMainTab} onValueChange={(v: string) => setActiveMainTab(v as "capital" | "analysis" | "watchlist" | "depletion")} className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="capital" className="gap-2">
              <DollarSign className="size-4" />
              Capital
              {capitalData && capitalData.summary.deadCapitalOrders > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0">
                  {capitalData.summary.deadCapitalOrders}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <BarChart3 className="size-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-2">
              <Eye className="size-4" />
              Watchlist
              {watchlistItems.filter(i => i.needs_restock).length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0">
                  {watchlistItems.filter(i => i.needs_restock).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="depletion" className="gap-2">
              <Timer className="size-4" />
              Depletion
              {depletionSummary && (depletionSummary.criticalCount > 0 || depletionSummary.warningCount > 0) && (
                <Badge 
                  variant={depletionSummary.criticalCount > 0 ? "destructive" : "secondary"} 
                  className={depletionSummary.criticalCount > 0 ? "ml-1 px-1.5 py-0" : "ml-1 px-1.5 py-0 bg-amber-500/20 text-amber-600"}
                >
                  {depletionSummary.criticalCount + depletionSummary.warningCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Capital Efficiency Tab */}
          <TabsContent value="capital" className="space-y-6">
            {/* Header Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="size-5" />
                      Capital Efficiency Dashboard
                    </CardTitle>
                    <CardDescription>
                      Track your ISK-at-work across all market sell orders
                    </CardDescription>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={fetchCapitalEfficiency}
                    disabled={capitalLoading}
                  >
                    {capitalLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    <span className="ml-2">Refresh</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {capitalError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{capitalError}</AlertDescription>
                  </Alert>
                )}
                {!capitalError && !capitalData && !capitalLoading && (
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Login with EVE SSO and click Refresh to analyze your sell orders
                    </AlertDescription>
                  </Alert>
                )}
                {capitalData && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <HelpCircle className="size-4" />
                      <span>How metrics are calculated</span>
                      <ChevronDown className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 mt-2">
                        <ul className="space-y-1 text-xs">
                          <li>• <strong>Est. Daily Sales</strong> = Vale Volume × 5% (hub factor)</li>
                          <li>• <strong>Days to Sell</strong> = Volume Remaining ÷ Est. Daily Sales</li>
                          <li>• <strong>APY</strong> = (Profit ÷ Cost) × (365 ÷ Days to Sell) × 100</li>
                          <li>• <strong>Dead Capital</strong> = Orders taking {`>`}{DEAD_CAPITAL_THRESHOLD_DAYS} days to sell</li>
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {capitalData?.analyzedAt && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Last analyzed: {new Date(capitalData.analyzedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Loading State */}
            {capitalLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Summary Cards */}
            {capitalData && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold">{formatIskShort(capitalData.summary.totalCapitalDeployed)}</p>
                      <p className="text-sm text-muted-foreground">Total ISK Deployed</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {capitalData.summary.totalOrders} active orders
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-emerald-500">
                        {formatIskShort(capitalData.summary.totalDailyRevenue)}
                      </p>
                      <p className="text-sm text-muted-foreground">Est. Daily Revenue</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on 5% of Vale volume
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold">
                        {capitalData.summary.avgDaysToSell.toFixed(1)} days
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Time to Sell</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Capital-weighted average
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={capitalData.summary.effectiveAPY > 100 ? "border-emerald-500/50" : ""}>
                    <CardContent className="p-4">
                      <p className={`text-2xl font-bold ${capitalData.summary.effectiveAPY > 100 ? "text-emerald-500" : capitalData.summary.effectiveAPY > 50 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {capitalData.summary.effectiveAPY.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">Effective APY</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Portfolio-wide return
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Dead Capital Alert */}
                {capitalData.summary.deadCapitalOrders > 0 && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skull className="size-8 text-destructive" />
                        <div className="flex-1">
                          <p className="font-medium text-destructive">Dead Capital Alert</p>
                          <p className="text-sm text-muted-foreground">
                            {capitalData.summary.deadCapitalOrders} orders ({formatIskShort(capitalData.summary.deadCapitalValue)} ISK) 
                            are estimated to take {`>`}{DEAD_CAPITAL_THRESHOLD_DAYS} days to sell
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-destructive">
                            {((capitalData.summary.deadCapitalValue / capitalData.summary.totalCapitalDeployed) * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">of capital</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Capital Breakdown by Efficiency */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Capital Allocation by Efficiency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Fast (<14 days) */}
                      <div className="flex items-center gap-4">
                        <div className="w-24 text-sm font-medium text-emerald-600">Fast</div>
                        <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${capitalData.summary.totalCapitalDeployed > 0 ? (capitalData.summary.fastCapital / capitalData.summary.totalCapitalDeployed) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="w-24 text-sm text-right">{formatIskShort(capitalData.summary.fastCapital)}</div>
                        <div className="w-16 text-xs text-muted-foreground text-right">&lt;14d</div>
                      </div>
                      {/* Moderate (14-30 days) */}
                      <div className="flex items-center gap-4">
                        <div className="w-24 text-sm font-medium text-amber-600">Moderate</div>
                        <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 transition-all"
                            style={{ width: `${capitalData.summary.totalCapitalDeployed > 0 ? (capitalData.summary.moderateCapital / capitalData.summary.totalCapitalDeployed) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="w-24 text-sm text-right">{formatIskShort(capitalData.summary.moderateCapital)}</div>
                        <div className="w-16 text-xs text-muted-foreground text-right">14-30d</div>
                      </div>
                      {/* Slow (30-90 days) */}
                      <div className="flex items-center gap-4">
                        <div className="w-24 text-sm font-medium text-orange-600">Slow</div>
                        <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${capitalData.summary.totalCapitalDeployed > 0 ? (capitalData.summary.slowCapital / capitalData.summary.totalCapitalDeployed) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="w-24 text-sm text-right">{formatIskShort(capitalData.summary.slowCapital)}</div>
                        <div className="w-16 text-xs text-muted-foreground text-right">30-90d</div>
                      </div>
                      {/* Dead (>90 days) */}
                      <div className="flex items-center gap-4">
                        <div className="w-24 text-sm font-medium text-destructive">Dead</div>
                        <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-destructive transition-all"
                            style={{ width: `${capitalData.summary.totalCapitalDeployed > 0 ? (capitalData.summary.deadCapitalValue / capitalData.summary.totalCapitalDeployed) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="w-24 text-sm text-right">{formatIskShort(capitalData.summary.deadCapitalValue)}</div>
                        <div className="w-16 text-xs text-muted-foreground text-right">&gt;90d</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Orders List */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Active Sell Orders</CardTitle>
                    <CardDescription>
                      Sorted by days to sell (slowest first to highlight dead capital)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {capitalData.orders.map((order) => (
                          <Card
                            key={order.orderId}
                            className={
                              order.efficiency === 'dead'
                                ? "border-destructive/50 bg-destructive/5"
                                : order.efficiency === 'slow'
                                  ? "border-orange-500/50 bg-orange-500/5"
                                  : order.efficiency === 'moderate'
                                    ? "border-amber-500/30 bg-amber-500/5"
                                    : order.efficiency === 'fast'
                                      ? "border-emerald-500/30 bg-emerald-500/5"
                                      : ""
                            }
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <EveItemIcon typeId={order.typeId} size={64} className="size-10 shrink-0 rounded" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{order.itemName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {order.volumeRemain.toLocaleString()} units @ {formatIskShort(order.price)} each
                                  </div>
                                </div>
                                <div className="text-right shrink-0 space-y-1">
                                  <div className="text-sm font-medium">{formatIskShort(order.capitalDeployed)}</div>
                                  <div className="flex items-center justify-end gap-2">
                                    {order.daysToSell !== null ? (
                                      <Badge 
                                        variant={order.efficiency === 'dead' ? 'destructive' : 'secondary'}
                                        className={
                                          order.efficiency === 'fast' ? 'bg-emerald-500/20 text-emerald-600' :
                                          order.efficiency === 'moderate' ? 'bg-amber-500/20 text-amber-600' :
                                          order.efficiency === 'slow' ? 'bg-orange-500/20 text-orange-600' :
                                          ''
                                        }
                                      >
                                        {order.daysToSell.toFixed(0)}d to sell
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        No volume data
                                      </Badge>
                                    )}
                                    {order.effectiveAPY !== null && (
                                      <Badge variant="outline" className="gap-1">
                                        <Percent className="size-3" />
                                        {order.effectiveAPY.toFixed(0)}% APY
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Expanded details for slow/dead capital */}
                              {(order.efficiency === 'dead' || order.efficiency === 'slow') && (
                                <div className="mt-2 pt-2 border-t grid grid-cols-4 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Est. Daily Sales:</span>
                                    <span className="ml-1 font-medium">{order.estimatedDailySales.toFixed(1)}/day</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Days Listed:</span>
                                    <span className="ml-1 font-medium">{order.daysListed}d</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Jita Price:</span>
                                    <span className="ml-1 font-medium">{order.jitaBuyPrice ? formatIskShort(order.jitaBuyPrice) : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Profit/Unit:</span>
                                    <span className={`ml-1 font-medium ${order.profitPerUnit && order.profitPerUnit > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                      {order.profitPerUnit ? formatIskShort(order.profitPerUnit) : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                      ))}
                      {capitalData.orders.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <DollarSign className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                          <p>No active sell orders found</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {/* Search Configuration */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Search Settings</CardTitle>
                <CardDescription>Configure your target structure and search parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="structureId">Structure</Label>
                    <Select
                      value={isCustomStructure ? "custom" : structureId}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setIsCustomStructure(true)
                          setStructureId("")
                        } else {
                          setIsCustomStructure(false)
                          setStructureId(value)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a structure" />
                      </SelectTrigger>
                      <SelectContent>
                        {KNOWN_STRUCTURES.map((structure) => (
                          <SelectItem key={structure.id} value={structure.id}>
                            {structure.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Other (Custom ID)</SelectItem>
                      </SelectContent>
                    </Select>
                    {isCustomStructure && (
                      <Input
                        id="structureId"
                        placeholder="Enter structure ID"
                        value={structureId}
                        onChange={(e) => setStructureId(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transportCost">Transport Cost (ISK/m³)</Label>
                    <Input
                      id="transportCost"
                      type="number"
                      value={transportCost}
                      onChange={(e) => setTransportCost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minProfit">Min Profit/Unit (ISK)</Label>
                    <Input
                      id="minProfit"
                      type="number"
                      value={minProfit}
                      onChange={(e) => setMinProfit(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minVolume">Min Vale Vol/Day</Label>
                    <Input
                      id="minVolume"
                      type="number"
                      value={minVolume}
                      onChange={(e) => setMinVolume(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Progress Bar */}
                {progress && (
                  <div className="pt-2">
                    <ProgressBar progress={progress} />
                  </div>
                )}

                <Button onClick={runAnalysis} disabled={isLoading} className="w-full md:w-auto">
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4 mr-2" />
                      Run Analysis
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results with Sidebar */}
            {result && (
              <>
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold">{result.items.length}</p>
                      <p className="text-sm text-muted-foreground">Total Items</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-primary">{filteredItems.length}</p>
                      <p className="text-sm text-muted-foreground">Filtered Items</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold text-emerald-500">
                        {result.summary.itemsNoCompetition}
                      </p>
                      <p className="text-sm text-muted-foreground">No Competition</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-2xl font-bold">{result.summary.avgProfitMargin}%</p>
                      <p className="text-sm text-muted-foreground">Avg Margin</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Selection Action Bar */}
                {selectedItems.size > 0 && (
                  <Card className="sticky top-4 z-10 border-primary/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="size-5 text-primary" />
                          <span className="font-medium">{selectedItems.size} items selected</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Supply:</span>
                          <Select
                            value={isCustomSupplyDays ? "custom" : supplyDays.toString()}
                            onValueChange={(value) => {
                              if (value === "custom") {
                                setIsCustomSupplyDays(true)
                              } else {
                                setIsCustomSupplyDays(false)
                                setSupplyDays(parseInt(value))
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SUPPLY_DAYS_PRESETS.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>
                                  {preset.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          {isCustomSupplyDays && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                value={supplyDays}
                                onChange={(e) => setSupplyDays(Math.max(1, parseInt(e.target.value) || 1))}
                                className="h-7 w-16 text-xs"
                              />
                              <span className="text-xs text-muted-foreground">days</span>
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">@ 5% Vale</span>
                        </div>
                        <div className="flex-1" />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearSelection}
                            className="gap-2"
                          >
                            <X className="size-4" />
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            onClick={copyBuyText}
                            className="gap-2"
                            disabled={copySuccess}
                          >
                            {copySuccess ? (
                              <>
                                <Check className="size-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="size-4" />
                                Copy Buy Text
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sidebar + Table Layout */}
                <div className="flex gap-6">
                  {/* Main Content - Table */}
                  <div className="flex-1 min-w-0">
                    <ResultsTable
                      items={filteredItems}
                      selectedItems={selectedItems}
                      onToggleSelect={toggleItemSelection}
                      onSelectAll={selectAllItems}
                      supplyDays={supplyDays}
                    />
                  </div>

                  {/* Sidebar - Filters */}
                  <div className="w-64 shrink-0 hidden lg:block">
                    <FilterSidebar
                      filters={filters}
                      onFiltersChange={handleFiltersChange}
                      totalItems={result.items.length}
                      filteredCount={filteredItems.length}
                    />
                  </div>
                </div>

                {/* Mobile Filters (collapsible) */}
                <div className="lg:hidden">
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full gap-2">
                        <Settings2 className="size-4" />
                        Filters
                        <ChevronDown className="size-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4">
                      <FilterSidebar
                        filters={filters}
                        onFiltersChange={handleFiltersChange}
                        totalItems={result.items.length}
                        filteredCount={filteredItems.length}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* Timestamp */}
                <p className="text-xs text-muted-foreground text-center">
                  Analysis generated at {new Date(result.generatedAt).toLocaleString()} • {(result.timing.totalMs / 1000).toFixed(1)}s
                </p>
              </>
            )}
          </TabsContent>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist" className="space-y-6">
            {/* Watchlist Header */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Watchlist</CardTitle>
                    <CardDescription>
                      Track specific items and monitor stock levels
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {watchlistCheckedAt && (watchlistItemsByUrgency.critical.length > 0 || watchlistItemsByUrgency.warning.length > 0) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="default" size="sm">
                            <Copy className="size-4" />
                            <span className="ml-2">Copy Restock List</span>
                            <ChevronDown className="size-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          {/* Include filters */}
                          <div className="p-2 space-y-2">
                            <Label className="text-xs text-muted-foreground">Include urgency levels</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="includeCritical" 
                                checked={includeCritical}
                                onCheckedChange={(checked) => setIncludeCritical(checked === true)}
                              />
                              <label 
                                htmlFor="includeCritical" 
                                className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                              >
                                <span className="text-destructive">Critical</span>
                                <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                                  {watchlistItemsByUrgency.critical.length}
                                </Badge>
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="includeWarning" 
                                checked={includeWarning}
                                onCheckedChange={(checked) => setIncludeWarning(checked === true)}
                              />
                              <label 
                                htmlFor="includeWarning" 
                                className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                              >
                                <span className="text-amber-500">Warning</span>
                                <Badge className="px-1.5 py-0 text-xs bg-amber-500/20 text-amber-600">
                                  {watchlistItemsByUrgency.warning.length}
                                </Badge>
                              </label>
                            </div>
                          </div>
                          <DropdownMenuSeparator />
                          {/* Days of supply */}
                          <div className="p-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Days of supply</Label>
                            <Select 
                              value={restockDays.toString()} 
                              onValueChange={(v) => setRestockDays(parseInt(v))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 day</SelectItem>
                                <SelectItem value="3">3 days</SelectItem>
                                <SelectItem value="7">7 days (1 week)</SelectItem>
                                <SelectItem value="14">14 days (2 weeks)</SelectItem>
                                <SelectItem value="30">30 days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Top N items */}
                          <div className="p-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Limit items</Label>
                            <Select 
                              value={restockTopN?.toString() ?? "all"} 
                              onValueChange={(v) => setRestockTopN(v === "all" ? null : parseInt(v))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All matched ({watchlistItemsToRestock.length})</SelectItem>
                                <SelectItem value="5">Top 5</SelectItem>
                                <SelectItem value="10">Top 10</SelectItem>
                                <SelectItem value="20">Top 20</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <DropdownMenuSeparator />
                          {/* Copy button with count */}
                          <div className="p-2">
                            <Button 
                              onClick={copyWatchlistBuyText} 
                              className="w-full"
                              disabled={watchlistCopySuccess || watchlistItemsToCopy.length === 0}
                            >
                              {watchlistCopySuccess ? (
                                <>
                                  <Check className="size-4 mr-2" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="size-4 mr-2" />
                                  Copy {watchlistItemsToCopy.length} items
                                </>
                              )}
                            </Button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchWatchlist(true)}
                      disabled={watchlistLoading || !structureId}
                      title={!structureId ? "Set Structure ID first" : "Check stock levels"}
                    >
                      {watchlistLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      <span className="ml-2">Refresh Stock</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Structure ID reminder */}
                {!structureId && (
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Set a Structure ID in the Analysis tab to check stock levels
                    </AlertDescription>
                  </Alert>
                )}

                {/* Add Item Search */}
                <div className="space-y-2">
                  <Label>Add Item to Watchlist</Label>
                  <ItemSearch
                    onSelect={addToWatchlist}
                    placeholder="Search for items to add..."
                    disabled={addingItem}
                    existingTypeIds={existingWatchlistTypeIds}
                  />
                </div>

                {watchlistError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{watchlistError}</AlertDescription>
                  </Alert>
                )}

                {watchlistCheckedAt && (
                  <p className="text-xs text-muted-foreground">
                    Stock checked at {new Date(watchlistCheckedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Watchlist Summary */}
            {watchlistItems.length > 0 && watchlistCheckedAt && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold">{watchlistItems.length}</p>
                    <p className="text-sm text-muted-foreground">Items Tracked</p>
                  </CardContent>
                </Card>
                <Card className="border-destructive/50">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-destructive">
                      {watchlistItems.filter(i => (i.stock ?? 0) === 0 || (i.daysUntilStockout !== null && i.daysUntilStockout < 3)).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Critical (out/&lt;3 days)</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/50">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-amber-500">
                      {watchlistItems.filter(i => i.daysUntilStockout !== null && i.daysUntilStockout >= 3 && i.daysUntilStockout < 7).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Warning (3-7 days)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-emerald-500">
                      {formatIskShort(watchlistItems.reduce((sum, i) => sum + (i.dailyProfit ?? 0), 0))}
                    </p>
                    <p className="text-sm text-muted-foreground">Daily Profit Potential</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Watchlist Items */}
            {watchlistLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : watchlistItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Eye className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    No items in watchlist yet. Use the search above to add items.
                  </p>
                </CardContent>
              </Card>
            ) : !watchlistCheckedAt ? (
              /* Stock not checked yet - show call-to-action then simplified list */
              <div className="space-y-3">
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <BarChart3 className="size-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground mb-4">
                      Load stock levels and depletion metrics for your {watchlistItems.length} watchlist item{watchlistItems.length !== 1 ? 's' : ''}
                    </p>
                    <Button
                      onClick={() => fetchWatchlist(true)}
                      disabled={watchlistLoading || !structureId}
                    >
                      {watchlistLoading ? (
                        <Loader2 className="size-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="size-4 mr-2" />
                      )}
                      Load Stock Data
                    </Button>
                    {!structureId && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Set a Structure ID in the Analysis tab first
                      </p>
                    )}
                  </CardContent>
                </Card>
                {watchlistItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <EveItemIcon typeId={item.type_id} size={64} className="size-10 shrink-0 rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.item_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.category_name} • {item.group_name}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFromWatchlist(item.type_id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {watchlistItems.map((item) => {
                  // Stock 0 = critical (already out), otherwise base on days until stockout
                  const urgencyLevel = (item.stock ?? 0) === 0
                    ? 'critical'
                    : item.daysUntilStockout === null 
                      ? 'none'
                      : item.daysUntilStockout < 3 
                        ? 'critical' 
                        : item.daysUntilStockout < 7 
                          ? 'warning' 
                          : 'safe'
                  
                  return (
                    <Card
                      key={item.id}
                      className={
                        urgencyLevel === 'critical'
                          ? "border-destructive/50 bg-destructive/5"
                          : urgencyLevel === 'warning'
                            ? "border-amber-500/50 bg-amber-500/5"
                            : urgencyLevel === 'safe'
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : ""
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <EveItemIcon typeId={item.type_id} size={64} className="size-10 shrink-0 rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.item_name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.category_name} • {item.group_name}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs">Current Stock</p>
                                <p className="font-medium">{(item.stock ?? 0).toLocaleString()} units</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Est. Daily Sales</p>
                                <p className="font-medium">{(item.estimatedDailySales ?? 0).toFixed(1)} units/day</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Days Until Stockout</p>
                                <p className={`font-bold ${
                                  urgencyLevel === 'critical' ? 'text-destructive' :
                                  urgencyLevel === 'warning' ? 'text-amber-500' :
                                  urgencyLevel === 'safe' ? 'text-emerald-500' :
                                  'text-muted-foreground'
                                }`}>
                                  {item.daysUntilStockout !== null 
                                    ? `${item.daysUntilStockout.toFixed(1)} days`
                                    : 'No sales data'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Daily Profit</p>
                                <p className="font-medium text-primary">{formatIskShort(item.dailyProfit ?? 0)} ISK</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {urgencyLevel === 'critical' && (item.stock ?? 0) === 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="size-3" />
                                Out of Stock
                              </Badge>
                            )}
                            {urgencyLevel === 'critical' && (item.stock ?? 0) > 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="size-3" />
                                Critical
                              </Badge>
                            )}
                            {urgencyLevel === 'warning' && (
                              <Badge className="gap-1 bg-amber-500/20 text-amber-600 hover:bg-amber-500/30">
                                <Clock className="size-3" />
                                Low Stock
                              </Badge>
                            )}
                            {urgencyLevel === 'safe' && (
                              <Badge variant="secondary" className="gap-1 bg-emerald-500/20 text-emerald-600">
                                <Check className="size-3" />
                                OK
                              </Badge>
                            )}
                            {urgencyLevel === 'none' && (
                              <Badge variant="secondary" className="gap-1">
                                <Minus className="size-3" />
                                No Data
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFromWatchlist(item.type_id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Depletion Predictor Tab */}
          <TabsContent value="depletion" className="space-y-6">
            {/* Depletion Header */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="size-5" />
                      Stock Depletion Predictor
                    </CardTitle>
                    <CardDescription>
                      Predict when your sell orders will deplete and prioritize restocking by profit potential
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {depletionPredictions.length > 0 && (depletionItemsByUrgency.critical.length > 0 || depletionItemsByUrgency.warning.length > 0) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Copy className="size-4" />
                            <span className="ml-2">Copy Restock List</span>
                            <ChevronDown className="size-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          {/* Include filters */}
                          <div className="p-2 space-y-2">
                            <Label className="text-xs text-muted-foreground">Include urgency levels</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="depletionIncludeCritical" 
                                checked={depletionIncludeCritical}
                                onCheckedChange={(checked) => setDepletionIncludeCritical(checked === true)}
                              />
                              <label 
                                htmlFor="depletionIncludeCritical" 
                                className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                              >
                                <span className="text-destructive">Critical</span>
                                <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                                  {depletionItemsByUrgency.critical.length}
                                </Badge>
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="depletionIncludeWarning" 
                                checked={depletionIncludeWarning}
                                onCheckedChange={(checked) => setDepletionIncludeWarning(checked === true)}
                              />
                              <label 
                                htmlFor="depletionIncludeWarning" 
                                className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                              >
                                <span className="text-amber-500">Warning</span>
                                <Badge className="px-1.5 py-0 text-xs bg-amber-500/20 text-amber-600">
                                  {depletionItemsByUrgency.warning.length}
                                </Badge>
                              </label>
                            </div>
                          </div>
                          <DropdownMenuSeparator />
                          {/* Days of supply */}
                          <div className="p-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Days of supply</Label>
                            <Select 
                              value={depletionRestockDays.toString()} 
                              onValueChange={(v) => setDepletionRestockDays(parseInt(v))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 day</SelectItem>
                                <SelectItem value="3">3 days</SelectItem>
                                <SelectItem value="7">7 days (1 week)</SelectItem>
                                <SelectItem value="14">14 days (2 weeks)</SelectItem>
                                <SelectItem value="30">30 days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Top N items */}
                          <div className="p-2 space-y-1">
                            <Label className="text-xs text-muted-foreground">Limit items</Label>
                            <Select 
                              value={depletionRestockTopN?.toString() ?? "all"} 
                              onValueChange={(v) => setDepletionRestockTopN(v === "all" ? null : parseInt(v))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All matched ({depletionItemsToRestock.length})</SelectItem>
                                <SelectItem value="5">Top 5</SelectItem>
                                <SelectItem value="10">Top 10</SelectItem>
                                <SelectItem value="20">Top 20</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <DropdownMenuSeparator />
                          {/* Copy button with count */}
                          <div className="p-2">
                            <Button 
                              onClick={copyDepletionBuyText} 
                              className="w-full"
                              disabled={depletionCopySuccess || depletionItemsToCopy.length === 0}
                            >
                              {depletionCopySuccess ? (
                                <>
                                  <Check className="size-4 mr-2" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="size-4 mr-2" />
                                  Copy {depletionItemsToCopy.length} items
                                </>
                              )}
                            </Button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={analyzeDepletion}
                      disabled={depletionLoading || !structureId}
                      title={!structureId ? "Set Structure ID first" : "Analyze stock depletion for all sell orders"}
                    >
                      {depletionLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <BarChart3 className="size-4" />
                      )}
                      <span className="ml-2">Analyze Depletion</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prerequisites reminder */}
                {!structureId && (
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Set a Structure ID in the Analysis tab first
                    </AlertDescription>
                  </Alert>
                )}

                {depletionError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{depletionError}</AlertDescription>
                  </Alert>
                )}

                {/* Formula explanation */}
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                  <p className="font-medium mb-2">How it works:</p>
                  <p className="text-xs mb-2">Analyzes all items currently being sold in your structure.</p>
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>Est. Daily Sales</strong> = Vale Volume × 5% (hub factor)</li>
                    <li>• <strong>Days Until Stockout</strong> = Current Stock ÷ Est. Daily Sales</li>
                    <li>• <strong>Priority</strong> = Est. Daily Sales × Profit per Unit</li>
                  </ul>
                </div>

                {depletionAnalyzedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last analyzed at {new Date(depletionAnalyzedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Progress Bar */}
            {depletionProgress && (
              <Card>
                <CardContent className="p-4">
                  <ProgressBar progress={depletionProgress} />
                </CardContent>
              </Card>
            )}

            {/* Depletion Summary */}
            {depletionSummary && depletionPredictions.length > 0 && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold">{depletionSummary.totalItems}</p>
                    <p className="text-sm text-muted-foreground">Items Tracked</p>
                  </CardContent>
                </Card>
                <Card className="border-destructive/50">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-destructive">
                      {depletionSummary.criticalCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Critical (&lt;3 days)</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/50">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-amber-500">
                      {depletionSummary.warningCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Warning (3-7 days)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-emerald-500">
                      {formatIskShort(depletionSummary.totalDailyProfit)}
                    </p>
                    <p className="text-sm text-muted-foreground">Daily Profit Potential</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Depletion Predictions List */}
            {depletionLoading && !depletionProgress ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : !depletionLoading && depletionPredictions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Timer className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Click &quot;Analyze Depletion&quot; to analyze all your sell orders
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Already sorted by days until stockout (critical first) from API */}
                {depletionPredictions.map((prediction) => {
                    const urgencyLevel = prediction.daysUntilStockout === null 
                      ? 'none'
                      : prediction.daysUntilStockout < 3 
                        ? 'critical' 
                        : prediction.daysUntilStockout < 7 
                          ? 'warning' 
                          : 'safe'
                    
                    return (
                      <Card
                        key={prediction.typeId}
                        className={
                          urgencyLevel === 'critical'
                            ? "border-destructive/50 bg-destructive/5"
                            : urgencyLevel === 'warning'
                              ? "border-amber-500/50 bg-amber-500/5"
                              : urgencyLevel === 'safe'
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : ""
                        }
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <EveItemIcon typeId={prediction.typeId} size={64} className="size-10 shrink-0 rounded" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{prediction.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {prediction.categoryName} • {prediction.groupName}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                <div>
                                  <p className="text-muted-foreground text-xs">Current Stock</p>
                                  <p className="font-medium">{prediction.currentStock.toLocaleString()} units</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">Est. Daily Sales</p>
                                  <p className="font-medium">{prediction.estimatedDailySales.toFixed(1)} units/day</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">Days Until Stockout</p>
                                  <p className={`font-bold ${
                                    urgencyLevel === 'critical' ? 'text-destructive' :
                                    urgencyLevel === 'warning' ? 'text-amber-500' :
                                    urgencyLevel === 'safe' ? 'text-emerald-500' :
                                    'text-muted-foreground'
                                  }`}>
                                    {prediction.daysUntilStockout !== null 
                                      ? `${prediction.daysUntilStockout.toFixed(1)} days`
                                      : 'No sales data'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">Daily Profit</p>
                                  <p className="font-medium text-primary">{formatIskShort(prediction.dailyProfitPotential)} ISK</p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {urgencyLevel === 'critical' && (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="size-3" />
                                  Critical
                                </Badge>
                              )}
                              {urgencyLevel === 'warning' && (
                                <Badge className="gap-1 bg-amber-500/20 text-amber-600 hover:bg-amber-500/30">
                                  <Clock className="size-3" />
                                  Low Stock
                                </Badge>
                              )}
                              {urgencyLevel === 'safe' && (
                                <Badge variant="secondary" className="gap-1 bg-emerald-500/20 text-emerald-600">
                                  <Check className="size-3" />
                                  OK
                                </Badge>
                              )}
                              {urgencyLevel === 'none' && (
                                <Badge variant="secondary" className="gap-1">
                                  <Minus className="size-3" />
                                  No Data
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Priority: {prediction.priorityScore.toFixed(0)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
