"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Loader2,
  AlertCircle,
  BarChart3,
  Timer,
  Settings2,
  ChevronDown,
  CheckSquare,
  X,
  Copy,
  Check,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { type DepletionPrediction, type ProgressState } from "@/types/market-seeder"
import { ProgressBar } from "./progress-bar"
import {
  StockSummaryCards,
  StockTable,
  StockFilterSidebar,
  type StockItemData,
  type UrgencyLevel,
  type StockFilterState,
} from "./stock-tracker"

const SUPPLY_DAYS_PRESETS = [
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
]

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
  filters: StockFilterState
  onFiltersChange: (filters: StockFilterState) => void

  // Selection state
  selectedItems: Set<number>
  onToggleSelect: (typeId: number) => void
  onSelectAll: (items: StockItemData[]) => void
  onClearSelection: () => void
  onCopySelected: () => void
  copySuccess: boolean

  // Supply days for copy
  supplyDays: number
  setSupplyDays: (days: number) => void
  isCustomSupplyDays: boolean
  setIsCustomSupplyDays: (isCustom: boolean) => void

  // Hub factor display
  hubFactorPercent?: string  // e.g. "5%" - for display in labels
}

// Helper to determine urgency level for a prediction
function getUrgencyLevel(prediction: DepletionPrediction): UrgencyLevel {
  if (prediction.currentStock === 0) return 'critical'
  if (prediction.daysUntilStockout === null) return 'none'
  if (prediction.daysUntilStockout < 3) return 'warning'
  return 'ok'
}

// Transform DepletionPrediction to StockItemData
function toStockItemData(prediction: DepletionPrediction): StockItemData {
  return {
    typeId: prediction.typeId,
    name: prediction.name,
    categoryName: prediction.categoryName,
    groupName: prediction.groupName,
    stock: prediction.currentStock,
    estimatedDailySales: prediction.estimatedDailySales,
    daysUntilStockout: prediction.daysUntilStockout,
    dailyProfit: prediction.dailyProfitPotential,
    urgencyLevel: getUrgencyLevel(prediction),
    priorityScore: prediction.priorityScore,
  }
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
  selectedItems,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onCopySelected,
  copySuccess,
  supplyDays,
  setSupplyDays,
  isCustomSupplyDays,
  setIsCustomSupplyDays,
  hubFactorPercent = "5%",
}: DepletionTabProps) {
  // Filter predictions based on selected filters
  const filteredPredictions = useMemo(() => {
    return predictions.filter(p => {
      const urgency = getUrgencyLevel(p)
      
      // Check urgency filter
      if (!filters.selectedUrgency.has(urgency)) return false
      
      // Check category filter
      if (p.categoryName && !filters.selectedCategories.has(p.categoryName)) return false
      
      // Check no competition filter
      if (filters.noCompetitionOnly && p.hasCompetition) return false
      
      // Check has active order filter (show only items where user has sell orders)
      if (filters.hasActiveOrderOnly && !p.userHasSellOrder) return false
      
      // Check min orders/day filter
      if (filters.minOrdersPerDay !== null && p.estimatedDailySales < filters.minOrdersPerDay) return false
      
      // Check min profit/day filter
      if (filters.minProfitPerDay !== null && p.dailyProfitPotential < filters.minProfitPerDay) return false
      
      // Check max Jita cost filter
      if (filters.maxJitaCost !== null && p.jitaBuyPrice > filters.maxJitaCost) return false
      
      return true
    })
  }, [predictions, filters])

  // Transform to StockItemData for table
  const tableItems = useMemo(() => filteredPredictions.map(toStockItemData), [filteredPredictions])

  // Group items by urgency for summary
  const itemsByUrgency = useMemo(() => ({
    critical: filteredPredictions.filter(p => p.currentStock === 0),
    warning: filteredPredictions.filter(p =>
      p.currentStock > 0 &&
      p.daysUntilStockout !== null &&
      p.daysUntilStockout < 3
    ),
  }), [filteredPredictions])

  const filterSidebar = (
    <StockFilterSidebar
      filters={filters}
      onFiltersChange={onFiltersChange}
      totalItems={predictions.length}
      filteredCount={filteredPredictions.length}
      hubFactorPercent={hubFactorPercent}
      idPrefix="depletion"
    />
  )

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
        <StockSummaryCards
          totalItems={summary.totalItems}
          criticalCount={summary.criticalCount}
          warningCount={summary.warningCount}
          dailyProfit={summary.totalDailyProfit}
        />
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
                <span className="text-xs text-muted-foreground">@ {hubFactorPercent} regional</span>
              </div>
              <div className="flex-1" />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearSelection}
                  className="gap-2"
                >
                  <X className="size-4" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={onCopySelected}
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
                      Copy Buy List
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Depletion Predictions */}
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
          {/* Sidebar + Table Layout */}
          <div className="flex gap-6">
            {/* Main Content - Table */}
            <div className="flex-1 min-w-0">
              <StockTable
                items={tableItems}
                showPriorityScore={true}
                selectedItems={selectedItems}
                onToggleSelect={onToggleSelect}
                onSelectAll={onSelectAll}
              />
            </div>

            {/* Sidebar - Filters (Desktop) */}
            <div className="w-64 shrink-0 hidden lg:block">
              {filterSidebar}
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
                {filterSidebar}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </>
      )}
    </div>
  )
}

// Re-export types for backwards compatibility
export type { StockFilterState as DepletionFilterState }
