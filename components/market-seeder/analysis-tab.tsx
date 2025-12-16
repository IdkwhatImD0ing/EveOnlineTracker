"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Settings2,
  ChevronDown,
  Copy,
  Check,
  X,
  CheckSquare,
} from "lucide-react"
import { type AnalysisResponse, type ProgressState } from "@/types/market-seeder"
import { FilterSidebar, FilterState } from "./filter-sidebar"
import { ResultsTable, ProfitAnalysis } from "./results-table"
import { ProgressBar } from "./progress-bar"
import { KNOWN_STRUCTURES, SUPPLY_DAYS_PRESETS } from "./utils"

interface AnalysisTabProps {
  // Search form state
  structureId: string
  setStructureId: (value: string) => void
  isCustomStructure: boolean
  setIsCustomStructure: (value: boolean) => void
  transportCost: string
  setTransportCost: (value: string) => void
  minProfit: string
  setMinProfit: (value: string) => void
  minVolume: string
  setMinVolume: (value: string) => void

  // Analysis state
  isLoading: boolean
  error: string | null
  result: AnalysisResponse | null
  progress: ProgressState | null
  onRunAnalysis: () => void

  // Filter state
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  filteredItems: ProfitAnalysis[]

  // Selection state
  selectedItems: Set<number>
  onToggleSelect: (typeId: number) => void
  onSelectAll: (items: ProfitAnalysis[]) => void
  onClearSelection: () => void
  onCopyBuyText: () => void
  copySuccess: boolean

  // Supply days
  supplyDays: number
  setSupplyDays: (value: number) => void
  isCustomSupplyDays: boolean
  setIsCustomSupplyDays: (value: boolean) => void

  // Hub factor display
  hubFactorPercent?: string  // e.g. "5%" - for display in labels
  hubFactor?: number  // Actual hub factor value (default: 0.05)
}

export function AnalysisTab({
  structureId,
  setStructureId,
  isCustomStructure,
  setIsCustomStructure,
  transportCost,
  setTransportCost,
  minProfit,
  setMinProfit,
  minVolume,
  setMinVolume,
  isLoading,
  error,
  result,
  progress,
  onRunAnalysis,
  filters,
  onFiltersChange,
  filteredItems,
  selectedItems,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onCopyBuyText,
  copySuccess,
  supplyDays,
  setSupplyDays,
  isCustomSupplyDays,
  setIsCustomSupplyDays,
  hubFactorPercent = "5%",
  hubFactor = 0.05,
}: AnalysisTabProps) {
  return (
    <div className="space-y-6">
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

          <Button onClick={onRunAnalysis} disabled={isLoading} className="w-full md:w-auto">
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
                      onClick={onCopyBuyText}
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
                onToggleSelect={onToggleSelect}
                onSelectAll={onSelectAll}
                supplyDays={supplyDays}
                hubFactor={hubFactor}
              />
            </div>

            {/* Sidebar - Filters */}
            <div className="w-64 shrink-0 hidden lg:block">
              <FilterSidebar
                filters={filters}
                onFiltersChange={onFiltersChange}
                totalItems={result.items.length}
                filteredCount={filteredItems.length}
                hubFactorPercent={hubFactorPercent}
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
                  onFiltersChange={onFiltersChange}
                  totalItems={result.items.length}
                  filteredCount={filteredItems.length}
                  hubFactorPercent={hubFactorPercent}
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
    </div>
  )
}

