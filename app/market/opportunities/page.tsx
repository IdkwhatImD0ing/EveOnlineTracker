"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OpportunityTable } from "@/components/market/opportunity-table"
import { 
  ArrowLeft, 
  TrendingUp, 
  RefreshCw, 
  Settings2,
  Clock,
  BarChart3,
  Target,
  Zap
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

export default function MarketOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([])
  const [summary, setSummary] = useState<ApiResponse['summary'] | null>(null)
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
    setProgress({ stage: 'connecting', message: 'Connecting...', percent: 0 })

    const params = new URLSearchParams({
      min_price: minPrice,
      min_volume: minVolume,
      max_volatility: maxVolatility,
      min_score: minScore,
      min_weekly_isk: minWeeklyIsk,
      limit: limit,
      stream: 'true',  // Enable SSE mode
    })

    const eventSource = new EventSource(`/api/market/opportunities?${params}`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data)
      setProgress(data)
    })

    eventSource.addEventListener('complete', (event) => {
      const data: ApiResponse = JSON.parse(event.data)
      setOpportunities(data.opportunities)
      setSummary(data.summary)
      setLastUpdated(data.generated_at)
      setTimingMs(data.timing.total_ms)
      setProgress(null)
      setIsLoading(false)
      eventSource.close()
    })

    eventSource.addEventListener('error', (event) => {
      // Check if it's an SSE error event with data
      if (event instanceof MessageEvent) {
        const data = JSON.parse(event.data)
        setError(data.message || 'An error occurred')
      } else {
        setError('Connection lost. Please try again.')
      }
      setProgress(null)
      setIsLoading(false)
      eventSource.close()
    })

    eventSource.onerror = () => {
      // Only handle if we haven't already received a complete event
      if (isLoading) {
        setError('Connection lost. Please try again.')
        setProgress(null)
        setIsLoading(false)
        eventSource.close()
      }
    }
  }, [minPrice, minVolume, maxVolatility, minScore, minWeeklyIsk, limit, isLoading])

  // Don't auto-load on mount - wait for user to click Recalculate

  // Format time ago
  const formatTimeAgo = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background pattern - gradient mesh */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(74,222,128,0.08),transparent_50%)]" />
      </div>
      
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <TrendingUp className="size-8 text-emerald-500" />
              Market Opportunities
            </h1>
            <p className="text-muted-foreground">
              Find undervalued items in Jita using multi-signal analysis
            </p>
          </div>
          
          {/* Action Buttons */}
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
            <Button
              onClick={fetchOpportunities}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Analyzing...' : 'Recalculate'}
            </Button>
          </div>
        </header>

        {/* Status Bar */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
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

        {/* Settings Panel */}
        {showSettings && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Algorithm Settings</CardTitle>
              <CardDescription>
                Adjust filters to find different types of opportunities
              </CardDescription>
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
                  {progress.stage === 'stats' && 'Fetching market statistics from database...'}
                  {progress.stage === 'prices' && 'Getting current prices from EVE ESI...'}
                  {progress.stage === 'processing' && 'Processing data...'}
                  {progress.stage === 'analyzing' && 'Analyzing opportunities...'}
                  {progress.stage === 'loading' && 'Loading item data...'}
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

        {/* Opportunities Table */}
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

        {(summary || isLoading) && (
          <OpportunityTable 
            opportunities={opportunities} 
            isLoading={isLoading} 
          />
        )}

        {/* Algorithm Info */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How Multi-Signal Analysis Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              This algorithm uses <strong className="text-foreground">Multi-Signal Analysis</strong> combining 
              four independent indicators. Items must show agreement across multiple signals to rank highly.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  🔄 Cyclical Analysis
                </h4>
                <p className="text-xs">
                  Detects repeating price patterns using autocorrelation. Identifies if the item is in a 
                  &quot;low phase&quot; of its natural cycle - the ideal time to buy.
                </p>
              </div>
              
              <div className="space-y-1">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  📈 Trend Analysis
                </h4>
                <p className="text-xs">
                  Uses moving average crossovers to detect trend reversals. Avoids &quot;falling knives&quot; 
                  by identifying items showing recovery momentum.
                </p>
              </div>
              
              <div className="space-y-1">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  🛡️ Support Detection
                </h4>
                <p className="text-xs">
                  Finds historical price floors where the price has bounced multiple times. 
                  Items near strong support have lower downside risk.
                </p>
              </div>
              
              <div className="space-y-1">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  📊 Volume Analysis
                </h4>
                <p className="text-xs">
                  Detects accumulation patterns (high volume at low prices) suggesting smart money buying. 
                  Rising OBV with flat price = hidden bullish pressure.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t mt-4">
              <h4 className="font-medium text-foreground mb-2">Opportunity Tiers</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Excellent (70+)
                </span>
                <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Good (40-69)
                </span>
                <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Marginal (20-39)
                </span>
                <span className="px-2 py-1 text-xs rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30">
                  Skip (&lt;20)
                </span>
              </div>
            </div>
            
            <p className="pt-2">
              <strong className="text-amber-400">⚠️ Risk Warning:</strong> Past patterns don&apos;t guarantee future results. 
              Game patches can permanently change item values. Always verify with patch notes and do your own research.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

