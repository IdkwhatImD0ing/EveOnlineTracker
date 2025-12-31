"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ShoppingCart,
  DollarSign,
  BarChart3,
  Eye,
  Timer,
  Package,
} from "lucide-react"
import {
  type CapitalEfficiencyResponse,
  type WatchlistItem,
  type WatchlistResponse,
  type DepletionPrediction,
  type UndercutItem,
  type UndercutData,
  type SellOrderItem,
  type SellOrderData,
  type AnalysisResponse,
  type ProgressState,
  type OrderHistoryData,
  type OrderHistoryPeriod,
} from "@/types/market-seeder"
import { type HistoryFilterState } from "@/components/market-seeder/history-filter-sidebar"
import { type ProfitAnalysis } from "@/components/market-seeder/results-table"
import { type FilterState, DEFAULT_FILTERS } from "@/components/market-seeder/filter-sidebar"
import { type StockFilterState, DEFAULT_STOCK_FILTERS, type StockItemData } from "@/components/market-seeder/stock-tracker"
import { type TradeableItem } from "@/components/market/item-search"
import {
  DEFAULT_STRUCTURE_ID,
  DEFAULT_SUPPLY_DAYS,
  generateBuyText,
  transformApiItemsToUiItems,
} from "@/components/market-seeder/utils"
import { RegionSelector, useVolumeRegion, HubFactorSelector, useHubFactor } from "@/components/ui/region-selector"

// Tab components
import { CapitalTab } from "@/components/market-seeder/capital-tab"
import { AnalysisTab } from "@/components/market-seeder/analysis-tab"
import { WatchlistTab } from "@/components/market-seeder/watchlist-tab"
import { EssentialsTab } from "@/components/market-seeder/essentials-tab"
import { DepletionTab } from "@/components/market-seeder/depletion-tab"
import { MarketTab } from "@/components/market-seeder/market-tab"

export default function MarketSeederPage() {
  // ============================================================================
  // Volume Region & Hub Factor State
  // ============================================================================
  const { regionId: volumeRegionId, setRegionId: setVolumeRegionId, regionInfo } = useVolumeRegion()
  const { hubFactor, setHubFactor, hubFactorPercent } = useHubFactor()

  // ============================================================================
  // Search Form State
  // ============================================================================
  const [structureId, setStructureId] = useState(DEFAULT_STRUCTURE_ID)
  const [isCustomStructure, setIsCustomStructure] = useState(false)
  const [transportCost, setTransportCost] = useState("450")
  const [supplyDays, setSupplyDays] = useState(DEFAULT_SUPPLY_DAYS)
  const [isCustomSupplyDays, setIsCustomSupplyDays] = useState(false)

  // ============================================================================
  // Sidebar Filter State (Analysis Tab)
  // ============================================================================
  const [filters, setFilters] = useState<FilterState>({
    minMargin: DEFAULT_FILTERS.minMargin,
    maxJitaCost: DEFAULT_FILTERS.maxJitaCost,
    minOrdersPerDay: DEFAULT_FILTERS.minOrdersPerDay,
    minProfitPerDay: DEFAULT_FILTERS.minProfitPerDay,
    noCompetitionOnly: DEFAULT_FILTERS.noCompetitionOnly,
    hideInInventory: DEFAULT_FILTERS.hideInInventory,
    hideWithSellOrders: DEFAULT_FILTERS.hideWithSellOrders,
    selectedCategories: new Set(DEFAULT_FILTERS.selectedCategories),
  })

  // ============================================================================
  // Analysis State
  // ============================================================================
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [copySuccess, setCopySuccess] = useState(false)

  // ============================================================================
  // Tab Navigation State
  // ============================================================================
  const [activeMainTab, setActiveMainTab] = useState<"capital" | "analysis" | "watchlist" | "essentials" | "depletion" | "market">("capital")

  // ============================================================================
  // Watchlist State
  // ============================================================================
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([])
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [watchlistCheckedAt, setWatchlistCheckedAt] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [watchlistInitialized, setWatchlistInitialized] = useState(false)
  const [watchlistCopySuccess, setWatchlistCopySuccess] = useState(false)
  const [restockDays, setRestockDays] = useState(7)
  const [restockTopN, setRestockTopN] = useState<number | null>(null)
  const [includeCritical, setIncludeCritical] = useState(true)
  const [includeWarning, setIncludeWarning] = useState(true)
  const [watchlistFilters, setWatchlistFilters] = useState<StockFilterState>({
    selectedUrgency: new Set(DEFAULT_STOCK_FILTERS.selectedUrgency),
    selectedCategories: new Set(DEFAULT_STOCK_FILTERS.selectedCategories),
    hideSellOrderItems: DEFAULT_STOCK_FILTERS.hideSellOrderItems,
    competitionFilter: DEFAULT_STOCK_FILTERS.competitionFilter,
    minOrdersPerDay: DEFAULT_STOCK_FILTERS.minOrdersPerDay,
    minProfitPerDay: DEFAULT_STOCK_FILTERS.minProfitPerDay,
    maxJitaCost: DEFAULT_STOCK_FILTERS.maxJitaCost,
  })
  // Watchlist selection state
  const [watchlistSelectedItems, setWatchlistSelectedItems] = useState<Set<number>>(new Set())
  const [watchlistSupplyDays, setWatchlistSupplyDays] = useState(7)
  const [watchlistIsCustomSupplyDays, setWatchlistIsCustomSupplyDays] = useState(false)

  // ============================================================================
  // Essentials State (Nullsec Essentials - separate from personal watchlist)
  // ============================================================================
  const [essentialsItems, setEssentialsItems] = useState<WatchlistItem[]>([])
  const [essentialsLoading, setEssentialsLoading] = useState(false)
  const [essentialsError, setEssentialsError] = useState<string | null>(null)
  const [essentialsCheckedAt, setEssentialsCheckedAt] = useState<string | null>(null)
  const [essentialsInitialized, setEssentialsInitialized] = useState(false)
  const [essentialsCopySuccess, setEssentialsCopySuccess] = useState(false)
  const [essentialsRestockDays, setEssentialsRestockDays] = useState(7)
  const [essentialsRestockTopN, setEssentialsRestockTopN] = useState<number | null>(null)
  const [essentialsIncludeCritical, setEssentialsIncludeCritical] = useState(true)
  const [essentialsIncludeWarning, setEssentialsIncludeWarning] = useState(true)
  const [essentialsFilters, setEssentialsFilters] = useState<StockFilterState>({
    selectedUrgency: new Set(DEFAULT_STOCK_FILTERS.selectedUrgency),
    selectedCategories: new Set(DEFAULT_STOCK_FILTERS.selectedCategories),
    hideSellOrderItems: DEFAULT_STOCK_FILTERS.hideSellOrderItems,
    competitionFilter: DEFAULT_STOCK_FILTERS.competitionFilter,
    minOrdersPerDay: DEFAULT_STOCK_FILTERS.minOrdersPerDay,
    minProfitPerDay: DEFAULT_STOCK_FILTERS.minProfitPerDay,
    maxJitaCost: DEFAULT_STOCK_FILTERS.maxJitaCost,
  })
  // Essentials selection state
  const [essentialsSelectedItems, setEssentialsSelectedItems] = useState<Set<number>>(new Set())
  const [essentialsSupplyDays, setEssentialsSupplyDays] = useState(7)
  const [essentialsIsCustomSupplyDays, setEssentialsIsCustomSupplyDays] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // ============================================================================
  // Depletion Predictor State
  // ============================================================================
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
  const [depletionFilters, setDepletionFilters] = useState<StockFilterState>({
    selectedUrgency: new Set(DEFAULT_STOCK_FILTERS.selectedUrgency),
    selectedCategories: new Set(DEFAULT_STOCK_FILTERS.selectedCategories),
    hideSellOrderItems: DEFAULT_STOCK_FILTERS.hideSellOrderItems,
    competitionFilter: DEFAULT_STOCK_FILTERS.competitionFilter,
    minOrdersPerDay: DEFAULT_STOCK_FILTERS.minOrdersPerDay,
    minProfitPerDay: DEFAULT_STOCK_FILTERS.minProfitPerDay,
    maxJitaCost: DEFAULT_STOCK_FILTERS.maxJitaCost,
  })
  // Depletion selection state
  const [depletionSelectedItems, setDepletionSelectedItems] = useState<Set<number>>(new Set())
  const [depletionSupplyDays, setDepletionSupplyDays] = useState(7)
  const [depletionIsCustomSupplyDays, setDepletionIsCustomSupplyDays] = useState(false)

  // ============================================================================
  // Capital Efficiency State
  // ============================================================================
  const [capitalData, setCapitalData] = useState<CapitalEfficiencyResponse | null>(null)
  const [capitalLoading, setCapitalLoading] = useState(false)
  const [capitalError, setCapitalError] = useState<string | null>(null)
  const [capitalProgress, setCapitalProgress] = useState<ProgressState | null>(null)

  // ============================================================================
  // Undercut Tracker State
  // ============================================================================
  const [undercutData, setUndercutData] = useState<UndercutData | null>(null)
  const [undercutLoading, setUndercutLoading] = useState(false)
  const [undercutError, setUndercutError] = useState<string | null>(null)
  const [undercutCopiedId, setUndercutCopiedId] = useState<number | null>(null)

  // ============================================================================
  // Sell Order Generator State
  // ============================================================================
  const [sellOrderData, setSellOrderData] = useState<SellOrderData | null>(null)
  const [sellOrderLoading, setSellOrderLoading] = useState(false)
  const [sellOrderError, setSellOrderError] = useState<string | null>(null)
  const [sellCopiedNameId, setSellCopiedNameId] = useState<number | null>(null)
  const [sellCopiedPriceId, setSellCopiedPriceId] = useState<number | null>(null)
  const [activeMarketSubTab, setActiveMarketSubTab] = useState<"undercut" | "sell" | "history">("undercut")
  const [sellMinQuantity, setSellMinQuantity] = useState<number>(1)
  const [sellProgress, setSellProgress] = useState<ProgressState | null>(null)
  const [sellCompetitionFilter, setSellCompetitionFilter] = useState<"all" | "no_competition" | "with_competition">("all")
  const [sellSortBy, setSellSortBy] = useState<"isk_per_day" | "volume" | "price">("isk_per_day")
  const [sellMinIskPerDay, setSellMinIskPerDay] = useState<number>(0)
  const [sellCopySuccess, setSellCopySuccess] = useState(false)

  // ============================================================================
  // Order History State
  // ============================================================================
  const [historyData, setHistoryData] = useState<OrderHistoryData | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyPeriod, setHistoryPeriod] = useState<OrderHistoryPeriod>('7d')
  const [historyFilters, setHistoryFilters] = useState<HistoryFilterState>({
    selectedCategories: new Set([
      "Module", "Ship", "Charge", "Booster",
      "Drone", "Fighter", "Implant", "Deployable", "Subsystem"
    ]),
    profitStatus: 'all',
    minMargin: null,
    minQuantitySold: null,
  })

  // ============================================================================
  // Settings Persistence
  // ============================================================================
  useEffect(() => {
    const saved = localStorage.getItem("market-seeder-settings")
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        if (settings.structureId) {
          setStructureId(settings.structureId)
          if (!["1051567430261"].includes(settings.structureId)) {
            setIsCustomStructure(true)
          }
        }
        if (settings.transportCost) setTransportCost(settings.transportCost)
        if (settings.filters) {
          setFilters({
            minMargin: settings.filters.minMargin ?? DEFAULT_FILTERS.minMargin,
            maxJitaCost: settings.filters.maxJitaCost ?? DEFAULT_FILTERS.maxJitaCost,
            minOrdersPerDay: settings.filters.minOrdersPerDay ?? DEFAULT_FILTERS.minOrdersPerDay,
            minProfitPerDay: settings.filters.minProfitPerDay ?? DEFAULT_FILTERS.minProfitPerDay,
            noCompetitionOnly: settings.filters.noCompetitionOnly ?? DEFAULT_FILTERS.noCompetitionOnly,
            hideInInventory: settings.filters.hideInInventory ?? DEFAULT_FILTERS.hideInInventory,
            hideWithSellOrders: settings.filters.hideWithSellOrders ?? DEFAULT_FILTERS.hideWithSellOrders,
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

  useEffect(() => {
    localStorage.setItem(
      "market-seeder-settings",
      JSON.stringify({
        structureId,
        transportCost,
        filters: {
          minMargin: filters.minMargin,
          maxJitaCost: filters.maxJitaCost,
          minOrdersPerDay: filters.minOrdersPerDay,
          minProfitPerDay: filters.minProfitPerDay,
          noCompetitionOnly: filters.noCompetitionOnly,
          hideInInventory: filters.hideInInventory,
          hideWithSellOrders: filters.hideWithSellOrders,
          selectedCategories: Array.from(filters.selectedCategories),
        }
      })
    )
  }, [structureId, transportCost, filters])

  // ============================================================================
  // Analysis Tab Functions
  // ============================================================================
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
        const next = new Set(prev)
        items.forEach(item => next.delete(item.typeId))
        return next
      } else {
        const next = new Set(prev)
        items.forEach(item => next.add(item.typeId))
        return next
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
    setSelectedItems(new Set())
  }, [])

  // Transform API items to UI items with formatted fields (once)
  const transformedItems = useMemo((): ProfitAnalysis[] => {
    if (!result) return []
    return transformApiItemsToUiItems(result.items)
  }, [result])

  const getSelectedItemsData = useCallback((): ProfitAnalysis[] => {
    return transformedItems.filter(item => selectedItems.has(item.typeId))
  }, [transformedItems, selectedItems])

  const filteredItems = useMemo(() => {
    return transformedItems.filter(item => {
      const ordersPerDay = item.avgDailyVolume * hubFactor
      const profitPerDay = item.profitPerUnit * item.avgDailyVolume * hubFactor
      return (
        item.profitMarginPct >= filters.minMargin &&
        (filters.maxJitaCost === null || item.jitaSellPrice <= filters.maxJitaCost) &&
        (filters.minOrdersPerDay === null || ordersPerDay >= filters.minOrdersPerDay) &&
        (filters.minProfitPerDay === null || profitPerDay >= filters.minProfitPerDay) &&
        filters.selectedCategories.has(item.categoryName) &&
        (!filters.noCompetitionOnly || !item.hasCompetition) &&
        (!filters.hideInInventory || !item.userHasInInventory) &&
        (!filters.hideWithSellOrders || !item.userHasSellOrder)
      )
    })
  }, [transformedItems, filters, hubFactor])

  const copyBuyText = useCallback(async () => {
    const items = getSelectedItemsData()
    if (items.length === 0) return

    const buyText = generateBuyText(items, supplyDays, hubFactor)

    try {
      await navigator.clipboard.writeText(buyText)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [getSelectedItemsData, supplyDays, hubFactor])

  const runAnalysis = useCallback(async () => {
    if (!structureId) {
      setError("Structure ID is required")
      return
    }

    setIsLoading(true)
    setError(null)
    setProgress({ stage: "connecting", message: "Connecting to server...", percent: 0 })
    clearSelection()

    try {
      const params = new URLSearchParams({
        structure_id: structureId,
        transportCost,
        minProfit: "100000",
        minVolume: "10",
        volume_region_id: String(volumeRegionId),
        hub_factor: String(hubFactor),
        stream: "true",
      })

      const response = await fetch(`/api/market-seeder/analyze?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Analysis failed")
      }

      const contentType = response.headers.get("content-type")

      if (contentType?.includes("text/event-stream")) {
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
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                currentEventData = line.slice(6)
              } else if (line === "") {
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
                currentEventType = ""
                currentEventData = ""
              }
            }
          }

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
        const data = await response.json()
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis")
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }, [structureId, transportCost, volumeRegionId, hubFactor, clearSelection])

  // ============================================================================
  // Watchlist Functions
  // ============================================================================
  const fetchWatchlist = useCallback(async (checkStock: boolean = true) => {
    setWatchlistLoading(true)
    setWatchlistError(null)

    try {
      const params = new URLSearchParams({
        volume_region_id: String(volumeRegionId),
        hub_factor: String(hubFactor),
      })
      if (checkStock && structureId) {
        params.set('structure_id', structureId)
      }
      const url = `/api/watchlist?${params}`

      if (checkStock && structureId) {
        const response = await fetch(url)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to fetch watchlist")
        }

        const data: WatchlistResponse = await response.json()
        setWatchlistItems(data.items)
        setWatchlistCheckedAt(data.checked_at)
      } else {
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
  }, [structureId, volumeRegionId, hubFactor])

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

      setWatchlistItems(prev => prev.filter(item => item.type_id !== typeId))
      // Also remove from selection if it was selected
      setWatchlistSelectedItems(prev => {
        const next = new Set(prev)
        next.delete(typeId)
        return next
      })
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Failed to remove item")
    }
  }, [])

  // Watchlist selection handlers
  const handleWatchlistToggleSelect = useCallback((typeId: number) => {
    setWatchlistSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }, [])

  const handleWatchlistSelectAll = useCallback((items: StockItemData[]) => {
    setWatchlistSelectedItems(prev => {
      const allSelected = items.every(item => prev.has(item.typeId))
      if (allSelected) {
        // Deselect all
        const next = new Set(prev)
        items.forEach(item => next.delete(item.typeId))
        return next
      } else {
        // Select all
        const next = new Set(prev)
        items.forEach(item => next.add(item.typeId))
        return next
      }
    })
  }, [])

  const handleWatchlistClearSelection = useCallback(() => {
    setWatchlistSelectedItems(new Set())
  }, [])

  const copyWatchlistBuyText = useCallback(async () => {
    // Copy selected items
    if (watchlistSelectedItems.size === 0) return

    const selectedItemsList = watchlistItems.filter(item => 
      watchlistSelectedItems.has(item.type_id)
    )

    if (selectedItemsList.length === 0) return

    const buyText = selectedItemsList.map(item => {
      const qty = Math.max(1, Math.ceil((item.estimatedDailySales ?? 0) * watchlistSupplyDays))
      return `${item.item_name} ${qty}`
    }).join('\n')

    try {
      await navigator.clipboard.writeText(buyText)
      setWatchlistCopySuccess(true)
      setTimeout(() => setWatchlistCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [watchlistItems, watchlistSelectedItems, watchlistSupplyDays])

  // ============================================================================
  // Essentials Functions (Nullsec Essentials)
  // ============================================================================
  const fetchEssentials = useCallback(async (checkStock: boolean = true) => {
    setEssentialsLoading(true)
    setEssentialsError(null)

    try {
      const params = new URLSearchParams({
        volume_region_id: String(volumeRegionId),
        hub_factor: String(hubFactor),
      })
      if (checkStock && structureId) {
        params.set('structure_id', structureId)
      }
      const url = `/api/essentials?${params}`

      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch essentials")
      }

      const data: WatchlistResponse = await response.json()
      setEssentialsItems(data.items)
      setEssentialsCheckedAt(checkStock && structureId ? data.checked_at : null)
    } catch (err) {
      setEssentialsError(err instanceof Error ? err.message : "Failed to fetch essentials")
    } finally {
      setEssentialsLoading(false)
      setEssentialsInitialized(true)
    }
  }, [structureId, volumeRegionId, hubFactor])

  const removeFromEssentials = useCallback(async (typeId: number) => {
    try {
      const response = await fetch(`/api/essentials/${typeId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to remove item")
      }

      setEssentialsItems(prev => prev.filter(item => item.type_id !== typeId))
      // Also remove from selection if it was selected
      setEssentialsSelectedItems(prev => {
        const next = new Set(prev)
        next.delete(typeId)
        return next
      })
    } catch (err) {
      setEssentialsError(err instanceof Error ? err.message : "Failed to remove item")
    }
  }, [])

  // Essentials selection handlers
  const handleEssentialsToggleSelect = useCallback((typeId: number) => {
    setEssentialsSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }, [])

  const handleEssentialsSelectAll = useCallback((items: StockItemData[]) => {
    setEssentialsSelectedItems(prev => {
      const allSelected = items.every(item => prev.has(item.typeId))
      if (allSelected) {
        const next = new Set(prev)
        items.forEach(item => next.delete(item.typeId))
        return next
      } else {
        const next = new Set(prev)
        items.forEach(item => next.add(item.typeId))
        return next
      }
    })
  }, [])

  const handleEssentialsClearSelection = useCallback(() => {
    setEssentialsSelectedItems(new Set())
  }, [])

  const copyEssentialsBuyText = useCallback(async () => {
    // Copy selected items
    if (essentialsSelectedItems.size === 0) return

    const selectedItemsList = essentialsItems.filter(item => 
      essentialsSelectedItems.has(item.type_id)
    )

    if (selectedItemsList.length === 0) return

    const buyText = selectedItemsList.map(item => {
      const qty = Math.max(1, Math.ceil((item.estimatedDailySales ?? 0) * essentialsSupplyDays))
      return `${item.item_name} ${qty}`
    }).join('\n')

    try {
      await navigator.clipboard.writeText(buyText)
      setEssentialsCopySuccess(true)
      setTimeout(() => setEssentialsCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [essentialsItems, essentialsSelectedItems, essentialsSupplyDays])

  // Fetch user role on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user?.role === 'admin') {
          setIsAdmin(true)
        }
      })
      .catch(() => {})
  }, [])

  // ============================================================================
  // Depletion Functions
  // ============================================================================
  const analyzeDepletion = useCallback(async () => {
    if (!structureId) {
      setDepletionError("Structure ID is required")
      return
    }

    setDepletionLoading(true)
    setDepletionError(null)
    setDepletionProgress({ stage: "starting", message: "Connecting...", percent: 0 })

    try {
      const response = await fetch(`/api/market-seeder/depletion?structure_id=${structureId}&volume_region_id=${volumeRegionId}&hub_factor=${hubFactor}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to start analysis")
      }

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
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim()
            } else if (line.startsWith("data: ")) {
              currentEventData = line.slice(6)
            } else if (line === "") {
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
  }, [structureId, volumeRegionId, hubFactor])

  // Depletion selection handlers
  const handleDepletionToggleSelect = useCallback((typeId: number) => {
    setDepletionSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }, [])

  const handleDepletionSelectAll = useCallback((items: StockItemData[]) => {
    setDepletionSelectedItems(prev => {
      const allSelected = items.every(item => prev.has(item.typeId))
      if (allSelected) {
        const next = new Set(prev)
        items.forEach(item => next.delete(item.typeId))
        return next
      } else {
        const next = new Set(prev)
        items.forEach(item => next.add(item.typeId))
        return next
      }
    })
  }, [])

  const handleDepletionClearSelection = useCallback(() => {
    setDepletionSelectedItems(new Set())
  }, [])

  const copyDepletionBuyText = useCallback(async () => {
    // Copy selected items
    if (depletionSelectedItems.size === 0) return

    const selectedItemsList = depletionPredictions.filter(item => 
      depletionSelectedItems.has(item.typeId)
    )

    if (selectedItemsList.length === 0) return

    const buyText = selectedItemsList.map(item => {
      const qty = Math.max(1, Math.ceil(item.estimatedDailySales * depletionSupplyDays))
      return `${item.name} ${qty}`
    }).join('\n')

    try {
      await navigator.clipboard.writeText(buyText)
      setDepletionCopySuccess(true)
      setTimeout(() => setDepletionCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [depletionPredictions, depletionSelectedItems, depletionSupplyDays])

  // ============================================================================
  // Capital Efficiency Functions
  // ============================================================================
  const fetchCapitalEfficiency = useCallback(async () => {
    setCapitalLoading(true)
    setCapitalError(null)
    setCapitalProgress({ stage: "starting", message: "Starting...", percent: 0 })

    try {
      const params = new URLSearchParams({ 
        transport_cost: transportCost,
        volume_region_id: String(volumeRegionId),
        hub_factor: String(hubFactor),
      })
      const response = await fetch(`/api/esi/capital-efficiency?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch capital efficiency data")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""
      let currentEventType = ""
      let currentEventData = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            currentEventData = line.slice(6)
          } else if (line === "") {
            if (currentEventType && currentEventData) {
              try {
                const data = JSON.parse(currentEventData)

                if (currentEventType === "progress") {
                  setCapitalProgress({
                    stage: data.stage,
                    message: data.message,
                    percent: data.percent,
                  })
                } else if (currentEventType === "complete") {
                  setCapitalData(data)
                  setCapitalProgress(null)
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
    } catch (err) {
      setCapitalError(err instanceof Error ? err.message : "Failed to analyze capital efficiency")
    } finally {
      setCapitalLoading(false)
      setCapitalProgress(null)
    }
  }, [transportCost, volumeRegionId, hubFactor])

  // ============================================================================
  // Undercut Functions
  // ============================================================================
  const fetchUndercuts = useCallback(async () => {
    setUndercutLoading(true)
    setUndercutError(null)

    try {
      const params = new URLSearchParams({ 
        structure_id: structureId,
        volume_region_id: String(volumeRegionId),
        hub_factor: String(hubFactor),
      })
      const response = await fetch(`/api/esi/undercut-check?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to check undercuts")
      }

      const data: UndercutData = await response.json()
      setUndercutData(data)
    } catch (err) {
      setUndercutError(err instanceof Error ? err.message : "Failed to check undercuts")
    } finally {
      setUndercutLoading(false)
    }
  }, [structureId, volumeRegionId, hubFactor])

  const copyUndercutPrice = useCallback(async (item: UndercutItem) => {
    navigator.clipboard.writeText(item.undercut_price_eve)
    setUndercutCopiedId(item.your_order_id)
    setTimeout(() => setUndercutCopiedId(null), 2000)

    // Open market window for the specific character who owns this order
    fetch(`/api/esi/ui/open-market-window?type_id=${item.type_id}&character_id=${item.character_id}`, {
      method: 'POST',
    }).catch((err) => {
      console.warn('Failed to open market window:', err)
    })
  }, [])

  // ============================================================================
  // Sell Order Functions
  // ============================================================================
  const fetchSellOrders = useCallback(async () => {
    setSellOrderLoading(true)
    setSellOrderError(null)
    setSellOrderData(null)
    setSellProgress({ stage: "starting", message: "Starting...", percent: 0 })

    try {
      const params = new URLSearchParams({
        structure_id: structureId,
        hub_factor: String(hubFactor),
        volume_region_id: String(volumeRegionId),
        stream: "true",
      })

      const response = await fetch(`/api/esi/sell-order-generator?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate sell orders")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6)
            try {
              const data = JSON.parse(jsonStr)

              if (data.stage) {
                setSellProgress({
                  stage: data.stage,
                  message: data.message,
                  percent: data.percent,
                })
              }

              if (data.items !== undefined) {
                setSellOrderData(data as SellOrderData)
              }

              if (data.error) {
                throw new Error(data.error)
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } catch (err) {
      setSellOrderError(err instanceof Error ? err.message : "Failed to generate sell orders")
    } finally {
      setSellOrderLoading(false)
      setSellProgress(null)
    }
  }, [structureId, hubFactor, volumeRegionId])

  const copySellItemName = useCallback((item: SellOrderItem) => {
    navigator.clipboard.writeText(item.type_name)
    setSellCopiedNameId(item.type_id)
    setTimeout(() => setSellCopiedNameId(null), 2000)
  }, [])

  const copySellPrice = useCallback((item: SellOrderItem) => {
    navigator.clipboard.writeText(item.sell_price_eve)
    setSellCopiedPriceId(item.type_id)
    setTimeout(() => setSellCopiedPriceId(null), 2000)
  }, [])

  const copySellAll = useCallback(async () => {
    if (!sellOrderData) return

    const filtered = sellOrderData.items
      .filter(item => {
        if (item.quantity < sellMinQuantity) return false
        if (item.isk_per_day < sellMinIskPerDay) return false
        if (sellCompetitionFilter === "no_competition" && item.has_competition) return false
        if (sellCompetitionFilter === "with_competition" && !item.has_competition) return false
        return true
      })
      .sort((a, b) => {
        switch (sellSortBy) {
          case "volume": return b.estimated_daily_sales - a.estimated_daily_sales
          case "price": return b.sell_price - a.sell_price
          default: return b.isk_per_day - a.isk_per_day
        }
      })

    const text = filtered.map(item => `${item.type_name} ${item.sell_price_eve}`).join('\n')
    await navigator.clipboard.writeText(text)
    setSellCopySuccess(true)
    setTimeout(() => setSellCopySuccess(false), 2000)
  }, [sellOrderData, sellMinQuantity, sellMinIskPerDay, sellCompetitionFilter, sellSortBy])

  // ============================================================================
  // Order History Functions
  // ============================================================================
  const fetchOrderHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const params = new URLSearchParams({
        period: historyPeriod,
        transport_cost: transportCost,
      })
      const response = await fetch(`/api/esi/order-history?${params}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch order history")
      }

      const data: OrderHistoryData = await response.json()
      setHistoryData(data)
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to fetch order history")
    } finally {
      setHistoryLoading(false)
    }
  }, [historyPeriod, transportCost])

  // Refetch when period changes
  const handleHistoryPeriodChange = useCallback((period: OrderHistoryPeriod) => {
    setHistoryPeriod(period)
    // Clear data and fetch with new period
    setHistoryData(null)
  }, [])

  // ============================================================================
  // Auto-load Effects
  // ============================================================================
  useEffect(() => {
    if (activeMainTab === "capital" && !capitalData && !capitalLoading && !capitalError) {
      fetchCapitalEfficiency()
    }
  }, [activeMainTab, capitalData, capitalLoading, capitalError, fetchCapitalEfficiency])

  useEffect(() => {
    if (activeMainTab === "watchlist" && !watchlistInitialized && !watchlistLoading) {
      fetchWatchlist(false)
    }
  }, [activeMainTab, watchlistInitialized, watchlistLoading, fetchWatchlist])

  useEffect(() => {
    if (activeMainTab === "essentials" && !essentialsInitialized && !essentialsLoading) {
      fetchEssentials(false)
    }
  }, [activeMainTab, essentialsInitialized, essentialsLoading, fetchEssentials])

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 md:gap-3">
              <ShoppingCart className="size-6 md:size-8" />
              Market Seeder
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Find profitable items to import from Jita
            </p>
          </div>
          <div className="flex items-end gap-2">
            <RegionSelector
              value={volumeRegionId}
              onChange={setVolumeRegionId}
              label="Volume Region"
              size="default"
            />
            <HubFactorSelector
              value={hubFactor}
              onChange={setHubFactor}
              label="Hub Factor"
              size="default"
            />
          </div>
        </header>

        {/* Main Tabs */}
        <Tabs value={activeMainTab} onValueChange={(v: string) => setActiveMainTab(v as typeof activeMainTab)} className="space-y-4 md:space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:max-w-5xl md:grid-cols-6 h-auto">
              <TabsTrigger value="capital" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap">
                <DollarSign className="size-3.5 md:size-4" />
                <span className="hidden sm:inline">Capital</span>
                <span className="sm:hidden">Cap</span>
                {capitalData && capitalData.summary.deadCapitalOrders > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                    {capitalData.summary.deadCapitalOrders}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap">
                <BarChart3 className="size-3.5 md:size-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap">
                <Eye className="size-3.5 md:size-4" />
                <span className="hidden sm:inline">Watchlist</span>
                <span className="sm:hidden">Watch</span>
                {watchlistItems.filter(i => i.needs_restock).length > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                    {watchlistItems.filter(i => i.needs_restock).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="essentials" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap">
                <Package className="size-3.5 md:size-4" />
                <span className="hidden sm:inline">Essentials</span>
                <span className="sm:hidden">Essen</span>
                {essentialsItems.filter(i => i.needs_restock && !i.hasSellOrder).length > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                    {essentialsItems.filter(i => i.needs_restock && !i.hasSellOrder).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="depletion" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap">
                <Timer className="size-3.5 md:size-4" />
                <span className="hidden sm:inline">Depletion</span>
                <span className="sm:hidden">Depl</span>
                {depletionSummary && (depletionSummary.criticalCount > 0 || depletionSummary.warningCount > 0) && (
                  <Badge
                    variant={depletionSummary.criticalCount > 0 ? "destructive" : "secondary"}
                    className={depletionSummary.criticalCount > 0 ? "ml-1 px-1.5 py-0 text-xs" : "ml-1 px-1.5 py-0 bg-amber-500/20 text-amber-600 text-xs"}
                  >
                    {depletionSummary.criticalCount + depletionSummary.warningCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="market" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5 px-3 md:px-4 whitespace-nowrap">
                <ShoppingCart className="size-3.5 md:size-4" />
                Market
                {undercutData && undercutData.summary.undercut_count > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                    {undercutData.summary.undercut_count}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Capital Tab */}
          <TabsContent value="capital">
            <CapitalTab
              data={capitalData}
              loading={capitalLoading}
              error={capitalError}
              progress={capitalProgress}
              onRefresh={fetchCapitalEfficiency}
            />
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis">
            <AnalysisTab
              structureId={structureId}
              setStructureId={setStructureId}
              isCustomStructure={isCustomStructure}
              setIsCustomStructure={setIsCustomStructure}
              transportCost={transportCost}
              setTransportCost={setTransportCost}
              isLoading={isLoading}
              error={error}
              result={result}
              progress={progress}
              onRunAnalysis={runAnalysis}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              filteredItems={filteredItems}
              selectedItems={selectedItems}
              onToggleSelect={toggleItemSelection}
              onSelectAll={selectAllItems}
              onClearSelection={clearSelection}
              onCopyBuyText={copyBuyText}
              copySuccess={copySuccess}
              supplyDays={supplyDays}
              setSupplyDays={setSupplyDays}
              isCustomSupplyDays={isCustomSupplyDays}
              setIsCustomSupplyDays={setIsCustomSupplyDays}
              hubFactorPercent={hubFactorPercent}
              hubFactor={hubFactor}
            />
          </TabsContent>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist">
            <WatchlistTab
              items={watchlistItems}
              loading={watchlistLoading}
              error={watchlistError}
              checkedAt={watchlistCheckedAt}
              structureId={structureId}
              onRefresh={fetchWatchlist}
              onAddItem={addToWatchlist}
              onRemoveItem={removeFromWatchlist}
              addingItem={addingItem}
              filters={watchlistFilters}
              onFiltersChange={setWatchlistFilters}
              selectedItems={watchlistSelectedItems}
              onToggleSelect={handleWatchlistToggleSelect}
              onSelectAll={handleWatchlistSelectAll}
              onClearSelection={handleWatchlistClearSelection}
              onCopySelected={copyWatchlistBuyText}
              copySuccess={watchlistCopySuccess}
              supplyDays={watchlistSupplyDays}
              setSupplyDays={setWatchlistSupplyDays}
              isCustomSupplyDays={watchlistIsCustomSupplyDays}
              setIsCustomSupplyDays={setWatchlistIsCustomSupplyDays}
              hubFactorPercent={hubFactorPercent}
            />
          </TabsContent>

          {/* Essentials Tab */}
          <TabsContent value="essentials">
            <EssentialsTab
              items={essentialsItems}
              loading={essentialsLoading}
              error={essentialsError}
              checkedAt={essentialsCheckedAt}
              structureId={structureId}
              isAdmin={isAdmin}
              onRefresh={fetchEssentials}
              onRemoveItem={isAdmin ? removeFromEssentials : undefined}
              filters={essentialsFilters}
              onFiltersChange={setEssentialsFilters}
              selectedItems={essentialsSelectedItems}
              onToggleSelect={handleEssentialsToggleSelect}
              onSelectAll={handleEssentialsSelectAll}
              onClearSelection={handleEssentialsClearSelection}
              onCopySelected={copyEssentialsBuyText}
              copySuccess={essentialsCopySuccess}
              supplyDays={essentialsSupplyDays}
              setSupplyDays={setEssentialsSupplyDays}
              isCustomSupplyDays={essentialsIsCustomSupplyDays}
              setIsCustomSupplyDays={setEssentialsIsCustomSupplyDays}
              hubFactorPercent={hubFactorPercent}
            />
          </TabsContent>

          {/* Depletion Tab */}
          <TabsContent value="depletion">
            <DepletionTab
              predictions={depletionPredictions}
              summary={depletionSummary}
              loading={depletionLoading}
              error={depletionError}
              analyzedAt={depletionAnalyzedAt}
              progress={depletionProgress}
              structureId={structureId}
              onAnalyze={analyzeDepletion}
              filters={depletionFilters}
              onFiltersChange={setDepletionFilters}
              selectedItems={depletionSelectedItems}
              onToggleSelect={handleDepletionToggleSelect}
              onSelectAll={handleDepletionSelectAll}
              onClearSelection={handleDepletionClearSelection}
              onCopySelected={copyDepletionBuyText}
              copySuccess={depletionCopySuccess}
              supplyDays={depletionSupplyDays}
              setSupplyDays={setDepletionSupplyDays}
              isCustomSupplyDays={depletionIsCustomSupplyDays}
              setIsCustomSupplyDays={setDepletionIsCustomSupplyDays}
              hubFactorPercent={hubFactorPercent}
            />
          </TabsContent>

          {/* Market Tab */}
          <TabsContent value="market">
            <MarketTab
              activeSubTab={activeMarketSubTab}
              setActiveSubTab={setActiveMarketSubTab}
              undercutData={undercutData}
              undercutLoading={undercutLoading}
              undercutError={undercutError}
              undercutCopiedId={undercutCopiedId}
              onUndercutRefresh={fetchUndercuts}
              onUndercutCopyPrice={copyUndercutPrice}
              sellOrderData={sellOrderData}
              sellOrderLoading={sellOrderLoading}
              sellOrderError={sellOrderError}
              sellProgress={sellProgress}
              onSellRefresh={fetchSellOrders}
              sellMinQuantity={sellMinQuantity}
              setSellMinQuantity={setSellMinQuantity}
              sellCompetitionFilter={sellCompetitionFilter}
              setSellCompetitionFilter={setSellCompetitionFilter}
              sellSortBy={sellSortBy}
              setSellSortBy={setSellSortBy}
              sellMinIskPerDay={sellMinIskPerDay}
              setSellMinIskPerDay={setSellMinIskPerDay}
              sellCopiedNameId={sellCopiedNameId}
              sellCopiedPriceId={sellCopiedPriceId}
              sellCopyAllSuccess={sellCopySuccess}
              onSellCopyName={copySellItemName}
              onSellCopyPrice={copySellPrice}
              onSellCopyAll={copySellAll}
              historyData={historyData}
              historyLoading={historyLoading}
              historyError={historyError}
              historyPeriod={historyPeriod}
              onHistoryPeriodChange={handleHistoryPeriodChange}
              onHistoryRefresh={fetchOrderHistory}
              historyFilters={historyFilters}
              onHistoryFiltersChange={setHistoryFilters}
              hubFactorPercent={hubFactorPercent}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
