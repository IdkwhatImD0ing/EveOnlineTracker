"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OpportunityTable } from "@/components/market/opportunity-table"
import {
  TrendingUp,
  RefreshCw,
  Settings2,
  Clock,
  BarChart3,
  Target,
  Zap,
  Copy,
  Check,
  X,
  CheckSquare,
} from "lucide-react"
import type { MarketOpportunity } from "@/lib/market-analysis"

interface ApiResponse {
  success: boolean
  opportunities: MarketOpportunity[]
  summary: {
    total_items_analyzed: number
    items_after_filters: number
    items_with_current_price: number
    opportunities_found: number
    results_returned: number
  }
  filters: {
    min_price: number
    min_volume: number
    max_volatility: number
    z_threshold: number
    lookback_days: number
  }
  timing: {
    total_ms: number
  }
  generated_at: string
  error?: string
}

interface ProgressState {
  stage: string
  message: string
  percent: number
}

/**
 * Generate buy text for Eve Online multibuy
 * Each item gets up to budget ISK worth, minimum 1 unit
 */
function generateBuyText(items: MarketOpportunity[], budget: number): string {
  return items
    .map((item) => {
      const qty = Math.max(1, Math.floor(budget / item.currentPrice))
      return `${item.itemName} ${qty}`
    })
    .join("\n")
}

export function MarketOpportunitiesTab() {
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([])
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [timingMs, setTimingMs] = useState<number | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Filter settings
  const [showSettings, setShowSettings] = useState(false)
  const [minPrice, setMinPrice] = useState("1000")
  const [minVolume, setMinVolume] = useState("10")
  const [maxVolatility, setMaxVolatility] = useState("0.5")
  const [minScore, setMinScore] = useState("20")
  const [minWeeklyIsk, setMinWeeklyIsk] = useState("1000000000") // 1B default
  const [limit, setLimit] = useState("50")

  // Selection state for Copy Buy Text
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [buyBudget, setBuyBudget] = useState("100") // 100M ISK default (in millions)
  const [copySuccess, setCopySuccess] = useState(false)

  // Selection helper functions
  const toggleItemSelection = useCallback((typeId: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }, [])

  const selectAllItems = useCallback((items: MarketOpportunity[]) => {
    setSelectedItems((prev) => {
      const allSelected = items.every((item) => prev.has(item.typeId))
      if (allSelected) {
        const next = new Set(prev)
        items.forEach((item) => next.delete(item.typeId))
        return next
      } else {
        const next = new Set(prev)
        items.forEach((item) => next.add(item.typeId))
        return next
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  // Get selected items data
  const getSelectedItemsData = useCallback((): MarketOpportunity[] => {
    return opportunities.filter((item) => selectedItems.has(item.typeId))
  }, [opportunities, selectedItems])

  // Copy buy text to clipboard
  const copyBuyText = useCallback(async () => {
    const items = getSelectedItemsData()
    if (items.length === 0) return

    const budgetInMillions = parseFloat(buyBudget) || 100
    const budget = budgetInMillions * 1_000_000 // Convert to ISK
    const buyText = generateBuyText(items, budget)

    try {
      await navigator.clipboard.writeText(buyText)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }, [getSelectedItemsData, buyBudget])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const fetchOpportunities = useCallback(async () => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setIsLoading(true)
    setError(null)
    setProgress({ stage: "connecting", message: "Connecting...", percent: 0 })

    const params = new URLSearchParams({
      min_price: minPrice,
      min_volume: minVolume,
      max_volatility: maxVolatility,
      min_score: minScore,
      min_weekly_isk: minWeeklyIsk,
      limit: limit,
      stream: "true",
    })

    const eventSource = new EventSource(`/api/market/opportunities?${params}`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data)
      setProgress(data)
    })

    eventSource.addEventListener("complete", (event) => {
      const data: ApiResponse = JSON.parse((event as MessageEvent).data)
      setOpportunities(data.opportunities)
      setSummary(data.summary)
      setLastUpdated(data.generated_at)
      setTimingMs(data.timing.total_ms)
      setProgress(null)
      setIsLoading(false)
      eventSource.close()
    })

    eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent) {
        const data = JSON.parse(event.data)
        setError(data.message || "An error occurred")
      } else {
        setError("Connection lost. Please try again.")
      }
      setProgress(null)
      setIsLoading(false)
      eventSource.close()
    })

    eventSource.onerror = () => {
      if (isLoading) {
        setError("Connection lost. Please try again.")
        setProgress(null)
        setIsLoading(false)
        eventSource.close()
      }
    }
  }, [minPrice, minVolume, maxVolatility, minScore, minWeeklyIsk, limit, isLoading])

  const formatTimeAgo = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-emerald-500" />
                Market Opportunities
              </CardTitle>
              <CardDescription>Find undervalued items in Jita using multi-signal analysis</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="gap-2"
              >
                <Settings2 className="size-4" />
                Settings
              </Button>
              <Button onClick={fetchOpportunities} disabled={isLoading} className="gap-2">
                <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? "Analyzing..." : "Recalculate"}
              </Button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-3">
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4" />
                  Updated {formatTimeAgo(lastUpdated)}
                </span>
              )}
              {timingMs && (
                <span className="flex items-center gap-1.5">
                  <Zap className="size-4" />
                  {(timingMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            {summary && (
              <span>
                {summary.opportunities_found} opportunities from {summary.total_items_analyzed.toLocaleString()} items
              </span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Settings Panel */}
      {showSettings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Algorithm Settings</CardTitle>
            <CardDescription>Adjust filters to find different types of opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="minPrice">Min Price (ISK)</Label>
                <Input
                  id="minPrice"
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minVolume">Min Daily Volume</Label>
                <Input
                  id="minVolume"
                  type="number"
                  value={minVolume}
                  onChange={(e) => setMinVolume(e.target.value)}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxVolatility">Max Volatility</Label>
                <Input
                  id="maxVolatility"
                  type="number"
                  step="0.1"
                  value={maxVolatility}
                  onChange={(e) => setMaxVolatility(e.target.value)}
                  placeholder="0.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minScore">Min Signal Score</Label>
                <Input
                  id="minScore"
                  type="number"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  placeholder="20"
                />
                <p className="text-[10px] text-muted-foreground">70+ Excellent, 40+ Good, 20+ Marginal</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minWeeklyIsk">Min Weekly ISK</Label>
                <select
                  id="minWeeklyIsk"
                  value={minWeeklyIsk}
                  onChange={(e) => setMinWeeklyIsk(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="0">No minimum</option>
                  <option value="10000000">10M+/week</option>
                  <option value="100000000">100M+/week</option>
                  <option value="500000000">500M+/week</option>
                  <option value="1000000000">1B+/week</option>
                  <option value="5000000000">5B+/week</option>
                  <option value="10000000000">10B+/week</option>
                </select>
                <p className="text-[10px] text-muted-foreground">Filter by profit potential</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limit">Max Results</Label>
                <Input
                  id="limit"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={fetchOpportunities} disabled={isLoading}>
                Apply & Recalculate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      {isLoading && progress && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{progress.message}</span>
                <span className="text-muted-foreground">{progress.percent}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progress.stage === "stats" && "Fetching market statistics from database..."}
                {progress.stage === "prices" && "Getting current prices from EVE ESI..."}
                {progress.stage === "processing" && "Processing data..."}
                {progress.stage === "analyzing" && "Analyzing opportunities..."}
                {progress.stage === "loading" && "Loading item data..."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <BarChart3 className="size-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.total_items_analyzed.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Items Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Target className="size-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.items_after_filters.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Passed Filters</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Zap className="size-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.items_with_current_price.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Price Checked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="size-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.opportunities_found}</p>
                  <p className="text-xs text-muted-foreground">Opportunities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Error: {error}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Make sure market history data is available. Run the market history fetch first if needed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !summary && !error && (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <TrendingUp className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Click <strong>Recalculate</strong> to analyze market data and find undervalued items in Jita.
            </p>
            <Button onClick={fetchOpportunities} className="gap-2">
              <RefreshCw className="size-4" />
              Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Selection Action Bar */}
      {selectedItems.size > 0 && (
        <Card className="sticky top-4 z-10 border-primary/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-5 text-primary" />
                <span className="font-medium">{selectedItems.size} items selected</span>
              </div>
              <div className="flex-1" />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="marketBuyBudget" className="text-sm whitespace-nowrap">
                    Budget:
                  </Label>
                  <Input
                    id="marketBuyBudget"
                    type="number"
                    value={buyBudget}
                    onChange={(e) => setBuyBudget(e.target.value)}
                    className="w-20 h-8"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">M</span>
                </div>
                <Button variant="outline" size="sm" onClick={clearSelection} className="gap-2">
                  <X className="size-4" />
                  Clear
                </Button>
                <Button size="sm" onClick={copyBuyText} className="gap-2" disabled={copySuccess}>
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

      {(summary || isLoading) && (
        <OpportunityTable
          opportunities={opportunities}
          isLoading={isLoading}
          selectedItems={selectedItems}
          onToggleSelect={toggleItemSelection}
          onSelectAll={selectAllItems}
        />
      )}
    </div>
  )
}


