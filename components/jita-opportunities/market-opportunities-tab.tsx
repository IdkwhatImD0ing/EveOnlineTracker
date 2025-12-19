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
  Sparkles,
  Loader2,
  Brain,
  Globe,
  HelpCircle,
  ChevronDown,
  ChevronRight,
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

  // AI Analysis state - session cache to prevent regeneration
  const [analysisCache, setAnalysisCache] = useState<Map<string, { analysis: string; reasoning: string }>>(new Map())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentAnalysis, setCurrentAnalysis] = useState<string>("")
  const [currentReasoning, setCurrentReasoning] = useState<string>("")
  const [isSearchingWeb, setIsSearchingWeb] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const [showSignalHelp, setShowSignalHelp] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analyzedItemNames, setAnalyzedItemNames] = useState<string[]>([])
  const analyzeAbortRef = useRef<AbortController | null>(null)

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

  // Generate cache key for selected items
  const getAnalysisCacheKey = useCallback((items: MarketOpportunity[]): string => {
    return items.map(i => i.typeId).sort().join('-')
  }, [])

  // Analyze selected items with AI
  const analyzeWithAI = useCallback(async () => {
    const items = getSelectedItemsData()
    if (items.length === 0) return

    // Check cache first
    const cacheKey = getAnalysisCacheKey(items)
    const cached = analysisCache.get(cacheKey)
    if (cached) {
      setCurrentAnalysis(cached.analysis)
      setCurrentReasoning(cached.reasoning)
      setAnalyzedItemNames(items.map(i => i.itemName))
      return
    }

    // Abort any existing analysis
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort()
    }
    analyzeAbortRef.current = new AbortController()

    setIsAnalyzing(true)
    setCurrentAnalysis("")
    setCurrentReasoning("")
    setIsSearchingWeb(false)
    setAnalysisError(null)
    setAnalyzedItemNames(items.map(i => i.itemName))

    try {
      // For multiple items, we'll analyze them one by one and combine
      let fullAnalysis = ""
      let fullReasoning = ""
      
      for (const item of items) {
        if (items.length > 1) {
          fullAnalysis += `\n\n## ${item.itemName}\n\n`
        }

        const response = await fetch('/api/market/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemName: item.itemName,
            typeId: item.typeId,
            signals: item.signals,
            currentPrice: item.currentPrice,
            avgPrice: item.avgPrice,
            weeklyIskPotential: item.weeklyIskPotential,
          }),
          signal: analyzeAbortRef.current?.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to analyze opportunity')
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              
              try {
                const parsed = JSON.parse(data)
                
                // Handle reasoning chunks
                if (parsed.type === 'reasoning' && parsed.delta) {
                  fullReasoning += parsed.delta
                  setCurrentReasoning(fullReasoning)
                }
                
                // Handle tool call status
                if (parsed.type === 'tool_call') {
                  setIsSearchingWeb(parsed.status === 'started')
                }
                
                // Handle output text
                if (parsed.type === 'output' && parsed.delta) {
                  fullAnalysis += parsed.delta
                  setCurrentAnalysis(fullAnalysis)
                }
                
                // Legacy format support
                if (parsed.delta && !parsed.type) {
                  fullAnalysis += parsed.delta
                  setCurrentAnalysis(fullAnalysis)
                }
                
                if (parsed.error) {
                  throw new Error(parsed.error)
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Cache the result
      setAnalysisCache(prev => new Map(prev).set(cacheKey, { analysis: fullAnalysis, reasoning: fullReasoning }))
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Aborted, ignore
        return
      }
      console.error('AI Analysis error:', err)
      setAnalysisError(err instanceof Error ? err.message : 'Failed to analyze')
    } finally {
      setIsAnalyzing(false)
      setIsSearchingWeb(false)
    }
  }, [getSelectedItemsData, getAnalysisCacheKey, analysisCache])

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
                <Button 
                  size="sm" 
                  onClick={analyzeWithAI} 
                  className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Analyze with AI
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSignalHelp(!showSignalHelp)}
                  className="h-8 w-8 p-0"
                  title="What do the signals mean?"
                >
                  <HelpCircle className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal Help Dialog */}
      {showSignalHelp && (
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="size-5 text-blue-400" />
                Understanding the Signals
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSignalHelp(false)}
                className="h-8 w-8 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm flex items-center gap-2 mb-1">
                  🔄 Cycle Signal
                </h4>
                <p className="text-xs text-muted-foreground">
                  Does the price follow a predictable up/down pattern? A positive score means the price is currently low in its usual cycle and likely to bounce back.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm flex items-center gap-2 mb-1">
                  📈 Trend Signal
                </h4>
                <p className="text-xs text-muted-foreground">
                  Is the price going up or down recently? A positive score means the price has been recovering or climbing, not falling.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm flex items-center gap-2 mb-1">
                  🛡️ Support Signal
                </h4>
                <p className="text-xs text-muted-foreground">
                  Has this price level held before? Like a floor - if the price has bounced back from this level multiple times, it&apos;s safer to buy.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm flex items-center gap-2 mb-1">
                  📊 Volume Signal
                </h4>
                <p className="text-xs text-muted-foreground">
                  Are other traders buying while it&apos;s cheap? High volume at low prices often means experienced traders are accumulating.
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-3">
              <strong>Score Guide:</strong> 70+ = Great opportunity, 40-69 = Good, 20-39 = Risky, below 20 = Skip
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Display */}
      {(currentAnalysis || currentReasoning || isAnalyzing || analysisError) && (
        <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-5 text-violet-400" />
                AI Market Analysis
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentAnalysis("")
                  setCurrentReasoning("")
                  setAnalysisError(null)
                  setAnalyzedItemNames([])
                }}
                className="h-8 w-8 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
            {analyzedItemNames.length > 0 && (
              <CardDescription>
                {analyzedItemNames.length === 1 
                  ? `Analyzing: ${analyzedItemNames[0]}`
                  : `Analyzing ${analyzedItemNames.length} items: ${analyzedItemNames.slice(0, 3).join(', ')}${analyzedItemNames.length > 3 ? '...' : ''}`
                }
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status indicators */}
            {isAnalyzing && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {currentReasoning && !currentAnalysis && (
                  <span className="flex items-center gap-1.5 text-violet-400">
                    <Brain className="size-4 animate-pulse" />
                    Thinking...
                  </span>
                )}
                {isSearchingWeb && (
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <Globe className="size-4 animate-spin" />
                    Searching for EVE news...
                  </span>
                )}
                {currentAnalysis && (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Loader2 className="size-4 animate-spin" />
                    Writing analysis...
                  </span>
                )}
              </div>
            )}

            {/* Reasoning section (collapsible) */}
            {currentReasoning && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="w-full flex items-center gap-2 p-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  {showReasoning ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  <Brain className="size-4" />
                  AI Reasoning
                  {isAnalyzing && !currentAnalysis && (
                    <span className="ml-auto text-xs animate-pulse">thinking...</span>
                  )}
                </button>
                {showReasoning && (
                  <div className="p-3 bg-muted/30 text-xs text-muted-foreground whitespace-pre-wrap border-t">
                    {currentReasoning}
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {analysisError ? (
              <div className="text-destructive">
                <p className="font-medium">Error: {analysisError}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Make sure you have set the OPENAI_API_KEY environment variable.
                </p>
              </div>
            ) : currentAnalysis ? (
              /* Markdown rendered output */
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: currentAnalysis
                      // Headers
                      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
                      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>')
                      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
                      // Bold
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      // Italic
                      .replace(/\*(.+?)\*/g, '<em>$1</em>')
                      // Bullet points
                      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                      // Line breaks
                      .replace(/\n\n/g, '</p><p class="mb-2">')
                      .replace(/\n/g, '<br />')
                  }}
                />
                {isAnalyzing && (
                  <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5" />
                )}
              </div>
            ) : null}
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


