"use client"

import { useState, useEffect, useCallback } from "react"
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
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Rocket,
  Zap,
  Pill,
  RefreshCw,
  Settings2,
  ChevronDown,
  ChevronUp,
  Database,
  Globe,
  BarChart3,
  Copy,
  Check,
  X,
  CheckSquare,
  Square,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

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

interface ProfitAnalysis {
  typeId: number
  name: string
  categoryName: string
  groupName: string
  volumePerUnit: number
  jitaSellPrice: number
  jitaSellPriceFormatted: string
  transportCostPerUnit: number
  transportCostFormatted: string
  totalCostPerUnit: number
  totalCostFormatted: string
  hasCompetition: boolean
  competitorLowestPrice: number | null
  competitorLowestPriceFormatted: string | null
  targetSellPrice: number
  targetSellPriceFormatted: string
  profitPerUnit: number
  profitPerUnitFormatted: string
  profitMarginPct: number
  profitMarginPctFormatted: string
  profitPerM3: number
  profitPerM3Formatted: string
  avgDailyVolume: number
  totalVolume30d: number
  trendDirection: "up" | "down" | "stable"
  compositeScore: number
  compositeScoreFormatted: string
}

interface AnalysisResponse {
  success: boolean
  generatedAt: string
  config: {
    structureId: string
    transportCostPerM3: number
    minMarginPct: number
    minProfitIsk: number
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
  topByCompositeScore: ProfitAnalysis[]
  noCompetitionOpportunities: ProfitAnalysis[]
  bestIskPerM3: ProfitAnalysis[]
  trendingUp: ProfitAnalysis[]
  byCategory: {
    Module: ProfitAnalysis[]
    Ship: ProfitAnalysis[]
    Charge: ProfitAnalysis[]
    Booster: ProfitAnalysis[]
  }
  timing: {
    totalMs: number
  }
}

interface ProgressState {
  stage: string
  message: string
  percent: number
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Module: Package,
  Ship: Rocket,
  Charge: Zap,
  Booster: Pill,
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
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "up") return <TrendingUp className="size-4 text-emerald-500" />
  if (direction === "down") return <TrendingDown className="size-4 text-red-500" />
  return <Minus className="size-4 text-muted-foreground" />
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

interface ItemCardProps {
  item: ProfitAnalysis
  rank?: number
  isSelected: boolean
  onToggleSelect: (typeId: number) => void
}

function ItemCard({ item, rank, isSelected, onToggleSelect }: ItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const CategoryIcon = CATEGORY_ICONS[item.categoryName] || Package

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleSelect(item.typeId)
  }

  return (
    <Card
      className={`transition-all hover:shadow-md cursor-pointer ${
        !item.hasCompetition ? "border-emerald-500/30 bg-emerald-500/5" : ""
      } ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div 
            className="shrink-0 flex items-center justify-center pt-1"
            onClick={handleCheckboxClick}
          >
            <Checkbox 
              checked={isSelected}
              className="size-5"
            />
          </div>
          {rank && (
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {rank}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CategoryIcon className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{item.name}</span>
              <TrendIcon direction={item.trendDirection} />
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={item.hasCompetition ? "secondary" : "default"}>
                {item.hasCompetition ? "Competition" : "No Competition"}
              </Badge>
              <span className="text-emerald-500 font-medium">
                +{item.profitMarginPctFormatted}
              </span>
              <span className="text-muted-foreground">
                {item.profitPerUnitFormatted}/unit
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-primary">
              {item.compositeScoreFormatted}
            </div>
            <div className="text-xs text-muted-foreground">score</div>
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          )}
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Jita Price</p>
              <p className="font-medium">{item.jitaSellPriceFormatted}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Transport</p>
              <p className="font-medium">{item.transportCostFormatted}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Target Price</p>
              <p className="font-medium">{item.targetSellPriceFormatted}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Profit/m³</p>
              <p className="font-medium">{item.profitPerM3Formatted}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Volume</p>
              <p className="font-medium">{item.volumePerUnit} m³</p>
            </div>
            <div>
              <p className="text-muted-foreground">Jita Daily Vol</p>
              <p className="font-medium">{Math.round(item.avgDailyVolume).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <p className="font-medium">{item.categoryName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Group</p>
              <p className="font-medium truncate">{item.groupName}</p>
            </div>
            {item.competitorLowestPriceFormatted && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Competitor Price</p>
                <p className="font-medium">{item.competitorLowestPriceFormatted}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ItemListProps {
  items: ProfitAnalysis[]
  showRank?: boolean
  selectedItems: Set<number>
  onToggleSelect: (typeId: number) => void
  onSelectAll: (items: ProfitAnalysis[]) => void
}

function ItemList({ items, showRank = true, selectedItems, onToggleSelect, onSelectAll }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No items match the current filters
      </div>
    )
  }

  const allSelected = items.every(item => selectedItems.has(item.typeId))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectAll(items)}
          className="gap-2"
        >
          {allSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {items.filter(i => selectedItems.has(i.typeId)).length} of {items.length} selected
        </span>
      </div>
      {items.map((item, index) => (
        <ItemCard 
          key={item.typeId} 
          item={item} 
          rank={showRank ? index + 1 : undefined}
          isSelected={selectedItems.has(item.typeId)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  )
}

/**
 * Generate buy text for Eve Online multibuy
 * Each item gets up to budget ISK worth, minimum 1 unit
 */
function generateBuyText(items: ProfitAnalysis[], budget: number): string {
  return items.map(item => {
    const qty = Math.max(1, Math.floor(budget / item.jitaSellPrice))
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
  // Form state
  const [structureId, setStructureId] = useState("")
  const [transportCost, setTransportCost] = useState("450")
  const [minMargin, setMinMargin] = useState("10")
  const [minProfit, setMinProfit] = useState("100000")
  const [minVolume, setMinVolume] = useState("10") // Minimum daily volume
  const [noCompetitionOnly, setNoCompetitionOnly] = useState(false) // Filter for 0 competition items
  const [buyBudget, setBuyBudget] = useState("100") // 100M ISK default (in millions)
  const [showSettings, setShowSettings] = useState(false)

  // Analysis state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [copySuccess, setCopySuccess] = useState(false)

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem("market-seeder-settings")
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        if (settings.structureId) setStructureId(settings.structureId)
        if (settings.transportCost) setTransportCost(settings.transportCost)
        if (settings.minMargin) setMinMargin(settings.minMargin)
        if (settings.minProfit) setMinProfit(settings.minProfit)
        if (settings.minVolume) setMinVolume(settings.minVolume)
        if (settings.noCompetitionOnly !== undefined) setNoCompetitionOnly(settings.noCompetitionOnly)
        if (settings.buyBudget) setBuyBudget(settings.buyBudget)
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [])

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem(
      "market-seeder-settings",
      JSON.stringify({ structureId, transportCost, minMargin, minProfit, minVolume, noCompetitionOnly, buyBudget })
    )
  }, [structureId, transportCost, minMargin, minProfit, minVolume, noCompetitionOnly, buyBudget])

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

  // Get all selected items from the result
  const getSelectedItemsData = useCallback((): ProfitAnalysis[] => {
    if (!result) return []
    
    // Collect all unique items from all lists
    const allItems = new Map<number, ProfitAnalysis>()
    ;[
      ...result.topByCompositeScore,
      ...result.noCompetitionOpportunities,
      ...result.bestIskPerM3,
      ...result.trendingUp,
      ...result.byCategory.Module,
      ...result.byCategory.Ship,
      ...result.byCategory.Charge,
      ...result.byCategory.Booster,
    ].forEach(item => {
      if (selectedItems.has(item.typeId)) {
        allItems.set(item.typeId, item)
      }
    })
    
    return Array.from(allItems.values())
  }, [result, selectedItems])

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
      console.error('Failed to copy:', err)
    }
  }, [getSelectedItemsData, buyBudget])

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

    try {
      const params = new URLSearchParams({
        structure_id: structureId,
        transportCost,
        minMargin,
        minProfit,
        minVolume,
        noCompetitionOnly: noCompetitionOnly ? "true" : "false",
        stream: "true",  // Enable SSE streaming
      })

      // Use EventSource for SSE
      const eventSource = new EventSource(
        `/api/market-seeder/analyze?${params}`,
        // Note: EventSource doesn't support custom headers, so we need a workaround
        // We'll fall back to regular fetch with polling for auth
      )

      // Unfortunately EventSource doesn't support Authorization headers
      // So we'll use fetch with streaming instead
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
  }, [structureId, transportCost, minMargin, minProfit, minVolume, noCompetitionOnly, getValidToken])

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="size-8" />
            Market Seeder
          </h1>
          <p className="text-muted-foreground">
            Find the most profitable items to import from Jita to your alliance hub
          </p>
        </header>

        {/* Configuration */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Analysis Settings</CardTitle>
                <CardDescription>Configure your target structure and filters</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="size-4 mr-2" />
                {showSettings ? "Hide" : "Show"} Advanced
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="structureId">Structure ID</Label>
                <Input
                  id="structureId"
                  placeholder="e.g., 1051567430261"
                  value={structureId}
                  onChange={(e) => setStructureId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your alliance market hub structure ID
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportCost">Transport Cost (ISK/m³)</Label>
                <Input
                  id="transportCost"
                  type="number"
                  value={transportCost}
                  onChange={(e) => setTransportCost(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Jump freighter rate per cubic meter
                </p>
              </div>
            </div>

            {showSettings && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="minMargin">Min Profit Margin (%)</Label>
                    <Input
                      id="minMargin"
                      type="number"
                      value={minMargin}
                      onChange={(e) => setMinMargin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minProfit">Min Profit per Unit (ISK)</Label>
                    <Input
                      id="minProfit"
                      type="number"
                      value={minProfit}
                      onChange={(e) => setMinProfit(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minVolume">Min Volume/Day</Label>
                    <Input
                      id="minVolume"
                      type="number"
                      value={minVolume}
                      onChange={(e) => setMinVolume(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="noCompetitionOnly"
                    checked={noCompetitionOnly}
                    onCheckedChange={(checked) => setNoCompetitionOnly(checked === true)}
                  />
                  <Label htmlFor="noCompetitionOnly" className="text-sm cursor-pointer">
                    Show only items with no competition (40% markup opportunities)
                  </Label>
                </div>
              </div>
            )}

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

        {/* Results */}
        {result && (
          <>
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold">{result.summary.itemsPassingFilters}</p>
                  <p className="text-sm text-muted-foreground">Profitable Items</p>
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
              <Card>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold">
                    {(result.timing.totalMs / 1000).toFixed(1)}s
                  </p>
                  <p className="text-sm text-muted-foreground">Analysis Time</p>
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
                    <div className="flex-1" />
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="buyBudget" className="text-sm whitespace-nowrap">Budget:</Label>
                        <Input
                          id="buyBudget"
                          type="number"
                          value={buyBudget}
                          onChange={(e) => setBuyBudget(e.target.value)}
                          className="w-20 h-8"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">M</span>
                      </div>
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

            {/* Tabbed Results */}
            <Tabs defaultValue="top" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-2">
                <TabsTrigger value="top">
                  Top Items ({result.topByCompositeScore.length})
                </TabsTrigger>
                <TabsTrigger value="nocompetition">
                  No Competition ({result.noCompetitionOpportunities.length})
                </TabsTrigger>
                <TabsTrigger value="efficiency">
                  Best ISK/m³ ({result.bestIskPerM3.length})
                </TabsTrigger>
                <TabsTrigger value="trending">
                  Trending Up ({result.trendingUp.length})
                </TabsTrigger>
                <TabsTrigger value="modules">
                  Modules ({result.byCategory.Module.length})
                </TabsTrigger>
                <TabsTrigger value="ships">
                  Ships ({result.byCategory.Ship.length})
                </TabsTrigger>
                <TabsTrigger value="ammo">
                  Ammo ({result.byCategory.Charge.length})
                </TabsTrigger>
                <TabsTrigger value="boosters">
                  Boosters ({result.byCategory.Booster.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="top">
                <ItemList 
                  items={result.topByCompositeScore} 
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
              <TabsContent value="nocompetition">
                <ItemList 
                  items={result.noCompetitionOpportunities}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
              <TabsContent value="efficiency">
                <ItemList 
                  items={result.bestIskPerM3}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
              <TabsContent value="trending">
                <ItemList 
                  items={result.trendingUp}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
              <TabsContent value="modules">
                <ItemList 
                  items={result.byCategory.Module}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
              <TabsContent value="ships">
                <ItemList 
                  items={result.byCategory.Ship}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
              <TabsContent value="ammo">
                <ItemList 
                  items={result.byCategory.Charge}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
              <TabsContent value="boosters">
                <ItemList 
                  items={result.byCategory.Booster}
                  selectedItems={selectedItems}
                  onToggleSelect={toggleItemSelection}
                  onSelectAll={selectAllItems}
                />
              </TabsContent>
            </Tabs>

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground text-center">
              Analysis generated at {new Date(result.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
