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
} from "@/types/market-seeder"
import { type ProfitAnalysis } from "@/components/market-seeder/results-table"
import { type FilterState, DEFAULT_FILTERS } from "@/components/market-seeder/filter-sidebar"
import { type TradeableItem } from "@/components/market/item-search"
import {
  DEFAULT_STRUCTURE_ID,
  DEFAULT_SUPPLY_DAYS,
  generateBuyText,
  transformApiItemsToUiItems,
} from "@/components/market-seeder/utils"
import { RegionSelector, useVolumeRegion } from "@/components/ui/region-selector"

// Tab components
import { CapitalTab } from "@/components/market-seeder/capital-tab"
import { AnalysisTab } from "@/components/market-seeder/analysis-tab"
import { WatchlistTab } from "@/components/market-seeder/watchlist-tab"
import { DepletionTab } from "@/components/market-seeder/depletion-tab"
import { MarketTab } from "@/components/market-seeder/market-tab"

export default function MarketSeederPage() {
  // ============================================================================
  // Volume Region State
  // ============================================================================
  const { regionId: volumeRegionId, setRegionId: setVolumeRegionId, regionInfo } = useVolumeRegion()

  // ============================================================================
  // Search Form State
  // ============================================================================
  const [structureId, setStructureId] = useState(DEFAULT_STRUCTURE_ID)
  const [isCustomStructure, setIsCustomStructure] = useState(false)
  const [transportCost, setTransportCost] = useState("450")
  const [minProfit, setMinProfit] = useState("100000")
  const [minVolume, setMinVolume] = useState("10")
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
  const [activeMainTab, setActiveMainTab] = useState<"capital" | "analysis" | "watchlist" | "depletion" | "market">("capital")

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

  // ============================================================================
  // Capital Efficiency State
  // ============================================================================
  const [capitalData, setCapitalData] = useState<CapitalEfficiencyResponse | null>(null)
  const [capitalLoading, setCapitalLoading] = useState(false)
  const [capitalError, setCapitalError] = useState<string | null>(null)

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
  const [activeMarketSubTab, setActiveMarketSubTab] = useState<"undercut" | "sell">("undercut")
  const [sellMinQuantity, setSellMinQuantity] = useState<number>(1)
  const [sellProgress, setSellProgress] = useState<ProgressState | null>(null)
  const [sellCompetitionFilter, setSellCompetitionFilter] = useState<"all" | "no_competition" | "with_competition">("all")
  const [sellSortBy, setSellSortBy] = useState<"isk_per_day" | "volume" | "price">("isk_per_day")
  const [sellMinIskPerDay, setSellMinIskPerDay] = useState<number>(0)
  const [sellCopySuccess, setSellCopySuccess] = useState(false)

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
        if (settings.minProfit) setMinProfit(settings.minProfit)
        if (settings.minVolume) setMinVolume(settings.minVolume)
        if (settings.filters) {
          setFilters({
            minMargin: settings.filters.minMargin ?? DEFAULT_FILTERS.minMargin,
            maxJitaCost: settings.filters.maxJitaCost ?? DEFAULT_FILTERS.maxJitaCost,
            minOrdersPerDay: settings.filters.minOrdersPerDay ?? DEFAULT_FILTERS.minOrdersPerDay,
            minProfitPerDay: settings.filters.minProfitPerDay ?? DEFAULT_FILTERS.minProfitPerDay,
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
          minOrdersPerDay: filters.minOrdersPerDay,
          minProfitPerDay: filters.minProfitPerDay,
          noCompetitionOnly: filters.noCompetitionOnly,
          selectedCategories: Array.from(filters.selectedCategories),
        }
      })
    )
  }, [structureId, transportCost, minProfit, minVolume, filters])

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
    const HUB_FACTOR = 0.05
    return transformedItems.filter(item => {
      const ordersPerDay = item.avgDailyVolume * HUB_FACTOR
      const profitPerDay = item.profitPerUnit * item.avgDailyVolume * HUB_FACTOR
      return (
        item.profitMarginPct >= filters.minMargin &&
        (filters.maxJitaCost === null || item.jitaSellPrice <= filters.maxJitaCost) &&
        (filters.minOrdersPerDay === null || ordersPerDay >= filters.minOrdersPerDay) &&
        (filters.minProfitPerDay === null || profitPerDay >= filters.minProfitPerDay) &&
        filters.selectedCategories.has(item.categoryName) &&
        (!filters.noCompetitionOnly || !item.hasCompetition)
      )
    })
  }, [transformedItems, filters])

  const copyBuyText = useCallback(async () => {
    const items = getSelectedItemsData()
    if (items.length === 0) return

    const buyText = generateBuyText(items, supplyDays)

    try {
      await navigator.clipboard.writeText(buyText)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [getSelectedItemsData, supplyDays])

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
        minProfit,
        minVolume,
        volume_region_id: String(volumeRegionId),
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
  }, [structureId, transportCost, minProfit, minVolume, volumeRegionId, clearSelection])

  // ============================================================================
  // Watchlist Functions
  // ============================================================================
  const fetchWatchlist = useCallback(async (checkStock: boolean = true) => {
    setWatchlistLoading(true)
    setWatchlistError(null)

    try {
      const url = '/api/watchlist'

      if (checkStock && structureId) {
        const response = await fetch(`${url}?structure_id=${structureId}`)

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
  }, [structureId])

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
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Failed to remove item")
    }
  }, [])

  const copyWatchlistBuyText = useCallback(async () => {
    const itemsToRestock = [
      ...(includeCritical ? watchlistItems.filter(i => (i.stock ?? 0) === 0 || (i.daysUntilStockout !== null && i.daysUntilStockout < 3)) : []),
      ...(includeWarning ? watchlistItems.filter(i => (i.stock ?? 0) > 0 && i.daysUntilStockout !== null && i.daysUntilStockout >= 3 && i.daysUntilStockout < 7) : []),
    ]
    const itemsToCopy = restockTopN ? itemsToRestock.slice(0, restockTopN) : itemsToRestock

    if (itemsToCopy.length === 0) return

    const buyText = itemsToCopy.map(item => {
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
  }, [watchlistItems, includeCritical, includeWarning, restockTopN, restockDays])

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
      const response = await fetch(`/api/market-seeder/depletion?structure_id=${structureId}&volume_region_id=${volumeRegionId}`)

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
  }, [structureId, volumeRegionId])

  const copyDepletionBuyText = useCallback(async () => {
    const itemsByUrgency = {
      critical: depletionPredictions.filter(p => p.daysUntilStockout !== null && p.daysUntilStockout < 3),
      warning: depletionPredictions.filter(p => p.daysUntilStockout !== null && p.daysUntilStockout >= 3 && p.daysUntilStockout < 7),
    }
    const itemsToRestock = [
      ...(depletionIncludeCritical ? itemsByUrgency.critical : []),
      ...(depletionIncludeWarning ? itemsByUrgency.warning : []),
    ]
    const itemsToCopy = depletionRestockTopN ? itemsToRestock.slice(0, depletionRestockTopN) : itemsToRestock

    if (itemsToCopy.length === 0) return

    const buyText = itemsToCopy.map(item => {
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
  }, [depletionPredictions, depletionIncludeCritical, depletionIncludeWarning, depletionRestockTopN, depletionRestockDays])

  // ============================================================================
  // Capital Efficiency Functions
  // ============================================================================
  const fetchCapitalEfficiency = useCallback(async () => {
    setCapitalLoading(true)
    setCapitalError(null)

    try {
      const params = new URLSearchParams({ 
        transport_cost: transportCost,
        volume_region_id: String(volumeRegionId),
      })
      const response = await fetch(`/api/esi/capital-efficiency?${params}`)

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
  }, [transportCost, volumeRegionId])

  // ============================================================================
  // Undercut Functions
  // ============================================================================
  const fetchUndercuts = useCallback(async () => {
    setUndercutLoading(true)
    setUndercutError(null)

    try {
      const params = new URLSearchParams({ structure_id: structureId })
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
  }, [structureId])

  const copyUndercutPrice = useCallback(async (item: UndercutItem) => {
    navigator.clipboard.writeText(item.undercut_price_eve)
    setUndercutCopiedId(item.your_order_id)
    setTimeout(() => setUndercutCopiedId(null), 2000)

    fetch(`/api/esi/ui/open-market-window?type_id=${item.type_id}`, {
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
  }, [structureId])

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
          <RegionSelector
            value={volumeRegionId}
            onChange={setVolumeRegionId}
            label="Volume Region"
            size="default"
          />
        </header>

        {/* Main Tabs */}
        <Tabs value={activeMainTab} onValueChange={(v: string) => setActiveMainTab(v as typeof activeMainTab)} className="space-y-4 md:space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:max-w-4xl md:grid-cols-5 h-auto">
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
              minProfit={minProfit}
              setMinProfit={setMinProfit}
              minVolume={minVolume}
              setMinVolume={setMinVolume}
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
              restockDays={restockDays}
              setRestockDays={setRestockDays}
              restockTopN={restockTopN}
              setRestockTopN={setRestockTopN}
              includeCritical={includeCritical}
              setIncludeCritical={setIncludeCritical}
              includeWarning={includeWarning}
              setIncludeWarning={setIncludeWarning}
              copySuccess={watchlistCopySuccess}
              onCopyRestock={copyWatchlistBuyText}
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
              restockDays={depletionRestockDays}
              setRestockDays={setDepletionRestockDays}
              restockTopN={depletionRestockTopN}
              setRestockTopN={setDepletionRestockTopN}
              includeCritical={depletionIncludeCritical}
              setIncludeCritical={setDepletionIncludeCritical}
              includeWarning={depletionIncludeWarning}
              setIncludeWarning={setDepletionIncludeWarning}
              copySuccess={depletionCopySuccess}
              onCopyRestock={copyDepletionBuyText}
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
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
