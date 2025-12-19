"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Minus,
  BarChart3,
  Timer,
  Settings2,
} from "lucide-react"
import { type DepletionPrediction, type ProgressState } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { ProgressBar } from "./progress-bar"
import { formatIskShort } from "./utils"
import { DepletionFilterSidebar, DepletionFilterState } from "./depletion-filter-sidebar"

interface DepletionSummary {
  totalItems: number
  criticalCount: number
  warningCount: number
  okCount: number
  noDataCount: number
  totalDailyProfit: number
}

interface DepletionTabProps {
  // Data
  predictions: DepletionPrediction[]
  summary: DepletionSummary | null
  loading: boolean
  error: string | null
  analyzedAt: string | null
  progress: ProgressState | null
  structureId: string

  // Actions
  onAnalyze: () => void

  // Filter state
  filters: DepletionFilterState
  onFiltersChange: (filters: DepletionFilterState) => void

  // Restock copy state
  restockDays: number
  setRestockDays: (days: number) => void
  restockTopN: number | null
  setRestockTopN: (n: number | null) => void
  includeCritical: boolean
  setIncludeCritical: (include: boolean) => void
  includeWarning: boolean
  setIncludeWarning: (include: boolean) => void
  copySuccess: boolean
  onCopyRestock: () => void

  // Hub factor display
  hubFactorPercent?: string  // e.g. "5%" - for display in labels
}

// Helper to determine urgency level for a prediction
function getUrgencyLevel(prediction: DepletionPrediction): 'critical' | 'warning' | 'ok' | 'none' {
  if (prediction.currentStock === 0) return 'critical'
  if (prediction.daysUntilStockout === null) return 'none'
  if (prediction.daysUntilStockout < 3) return 'warning'
  return 'ok'
}

export function DepletionTab({
  predictions,
  summary,
  loading,
  error,
  analyzedAt,
  progress,
  structureId,
  onAnalyze,
  filters,
  onFiltersChange,
  restockDays,
  setRestockDays,
  restockTopN,
  setRestockTopN,
  includeCritical,
  setIncludeCritical,
  includeWarning,
  setIncludeWarning,
  copySuccess,
  onCopyRestock,
  hubFactorPercent = "5%",
}: DepletionTabProps) {
  // Filter predictions based on selected urgency, categories, ownership, and competition
  const filteredPredictions = useMemo(() => {
    return predictions.filter(p => {
      const urgency = getUrgencyLevel(p)
      // Map 'ok' urgency to 'ok' in filter, 'safe' is used in display
      const urgencyKey = urgency === 'ok' ? 'ok' : urgency
      
      // Check urgency filter
      if (!filters.selectedUrgency.has(urgencyKey)) return false
      
      // Check category filter
      if (p.categoryName && !filters.selectedCategories.has(p.categoryName)) return false
      
      // Check hide owned items filter
      if (filters.hideOwnedItems && (p.userHasInInventory || p.userHasSellOrder)) return false
      
      // Check competition filter
      if (filters.competitionFilter === 'no_competition' && p.hasCompetition) return false
      if (filters.competitionFilter === 'with_competition' && !p.hasCompetition) return false
      
      return true
    })
  }, [predictions, filters])

  // Group items by urgency (from filtered predictions for restock)
  const itemsByUrgency = useMemo(() => ({
    critical: filteredPredictions.filter(p => p.currentStock === 0),
    warning: filteredPredictions.filter(p =>
      p.currentStock > 0 &&
      p.daysUntilStockout !== null &&
      p.daysUntilStockout < 3
    ),
  }), [filteredPredictions])

  // Items to restock based on filters
  const itemsToRestock = [
    ...(includeCritical ? itemsByUrgency.critical : []),
    ...(includeWarning ? itemsByUrgency.warning : []),
  ]

  const itemsToCopy = restockTopN ? itemsToRestock.slice(0, restockTopN) : itemsToRestock

  return (
    <div className="space-y-6">
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
              {predictions.length > 0 && (itemsByUrgency.critical.length > 0 || itemsByUrgency.warning.length > 0) && (
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
                          checked={includeCritical}
                          onCheckedChange={(checked) => setIncludeCritical(checked === true)}
                        />
                        <label
                          htmlFor="depletionIncludeCritical"
                          className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                        >
                          <span className="text-destructive">Critical</span>
                          <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                            {itemsByUrgency.critical.length}
                          </Badge>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="depletionIncludeWarning"
                          checked={includeWarning}
                          onCheckedChange={(checked) => setIncludeWarning(checked === true)}
                        />
                        <label
                          htmlFor="depletionIncludeWarning"
                          className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                        >
                          <span className="text-amber-500">Warning</span>
                          <Badge className="px-1.5 py-0 text-xs bg-amber-500/20 text-amber-600">
                            {itemsByUrgency.warning.length}
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
                          <SelectItem value="all">All matched ({itemsToRestock.length})</SelectItem>
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
                        onClick={onCopyRestock}
                        className="w-full"
                        disabled={copySuccess || itemsToCopy.length === 0}
                      >
                        {copySuccess ? (
                          <>
                            <Check className="size-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="size-4 mr-2" />
                            Copy {itemsToCopy.length} items
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
                onClick={onAnalyze}
                disabled={loading || !structureId}
                title={!structureId ? "Set Structure ID first" : "Analyze stock depletion for all sell orders"}
              >
                {loading ? (
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Formula explanation */}
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
            <p className="font-medium mb-2">How it works:</p>
            <p className="text-xs mb-2">Analyzes all items currently being sold in your structure.</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Est. Daily Sales</strong> = Regional Volume × {hubFactorPercent} (hub factor)</li>
              <li>• <strong>Days Until Stockout</strong> = Current Stock ÷ Est. Daily Sales</li>
              <li>• <strong>Priority</strong> = Est. Daily Sales × Profit per Unit</li>
            </ul>
          </div>

          {analyzedAt && (
            <p className="text-xs text-muted-foreground">
              Last analyzed at {new Date(analyzedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {progress && (
        <Card>
          <CardContent className="p-4">
            <ProgressBar progress={progress} />
          </CardContent>
        </Card>
      )}

      {/* Depletion Summary */}
      {summary && predictions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{summary.totalItems}</p>
              <p className="text-sm text-muted-foreground">Items Tracked</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-destructive">
                {summary.criticalCount}
              </p>
              <p className="text-sm text-muted-foreground">Critical (0 stock)</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-500">
                {summary.warningCount}
              </p>
              <p className="text-sm text-muted-foreground">Warning (&lt;3 days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">
                {formatIskShort(summary.totalDailyProfit)}
              </p>
              <p className="text-sm text-muted-foreground">Daily Profit Potential</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Depletion Predictions List */}
      {loading && !progress ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : !loading && predictions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Timer className="size-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Click &quot;Analyze Depletion&quot; to analyze all your sell orders
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sidebar + List Layout */}
          <div className="flex gap-6">
            {/* Main Content - Predictions List */}
            <div className="flex-1 min-w-0 space-y-3">
              {filteredPredictions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Timer className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      No items match your current filters
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredPredictions.map((prediction) => {
                  const urgencyLevel = getUrgencyLevel(prediction)

                  return (
                    <Card
                      key={prediction.typeId}
                      className={
                        urgencyLevel === 'critical'
                          ? "border-destructive/50 bg-destructive/5"
                          : urgencyLevel === 'warning'
                            ? "border-amber-500/50 bg-amber-500/5"
                            : urgencyLevel === 'ok'
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
                                <p className={`font-bold ${urgencyLevel === 'critical' ? 'text-destructive' :
                                  urgencyLevel === 'warning' ? 'text-amber-500' :
                                    urgencyLevel === 'ok' ? 'text-emerald-500' :
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
                            {urgencyLevel === 'ok' && (
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
                })
              )}
            </div>

            {/* Sidebar - Filters (Desktop) */}
            <div className="w-64 shrink-0 hidden lg:block">
              <DepletionFilterSidebar
                filters={filters}
                onFiltersChange={onFiltersChange}
                totalItems={predictions.length}
                filteredCount={filteredPredictions.length}
              />
            </div>
          </div>

          {/* Mobile Filters (collapsible) */}
          <div className="lg:hidden">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Settings2 className="size-4" />
                  Filters ({filteredPredictions.length} of {predictions.length})
                  <ChevronDown className="size-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <DepletionFilterSidebar
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  totalItems={predictions.length}
                  filteredCount={filteredPredictions.length}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </>
      )}
    </div>
  )
}
