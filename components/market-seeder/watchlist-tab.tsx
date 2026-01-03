"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Eye,
  Trash2,
  BarChart3,
  Settings2,
  ChevronDown,
  CheckSquare,
  X,
  Copy,
  Check,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { type WatchlistItem } from "@/types/market-seeder"
import { ItemSearch, TradeableItem } from "@/components/market/item-search"
import {
  StockItemCardSimple,
  StockSummaryCards,
  StockTable,
  StockFilterSidebar,
  DEFAULT_STOCK_FILTERS,
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

interface WatchlistTabProps {
  // Data
  items: WatchlistItem[]
  loading: boolean
  error: string | null
  checkedAt: string | null
  structureId: string

  // Actions
  onRefresh: (checkStock: boolean) => void
  onAddItem: (item: TradeableItem) => void
  onRemoveItem: (typeId: number) => void
  addingItem: boolean

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
  hubFactorPercent?: string
}

// Helper to determine urgency level for a watchlist item
function getUrgencyLevel(item: WatchlistItem): UrgencyLevel {
  if (item.hasSellOrder) return 'ok'
  if ((item.stock ?? 0) === 0) return 'critical'
  if (item.daysUntilStockout === null) return 'none'
  if (item.daysUntilStockout < 3) return 'warning'
  return 'ok'
}

// Transform WatchlistItem to StockItemData
function toStockItemData(item: WatchlistItem): StockItemData {
  return {
    typeId: item.type_id,
    name: item.item_name,
    categoryName: item.category_name,
    groupName: item.group_name,
    stock: item.stock ?? 0,
    estimatedDailySales: item.estimatedDailySales ?? 0,
    daysUntilStockout: item.daysUntilStockout,
    dailyProfit: item.dailyProfit ?? 0,
    urgencyLevel: getUrgencyLevel(item),
  }
}

export function WatchlistTab({
  items,
  loading,
  error,
  checkedAt,
  structureId,
  onRefresh,
  onAddItem,
  onRemoveItem,
  addingItem,
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
}: WatchlistTabProps) {
  const existingTypeIds = new Set(items.map(item => item.type_id))

  // Filter items based on selected filters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const urgency = getUrgencyLevel(item)
      const dailySales = item.estimatedDailySales ?? 0
      const dailyProfit = item.dailyProfit ?? 0
      const jitaPrice = item.jitaPrice ?? 0
      
      // Check urgency filter
      if (!filters.selectedUrgency.has(urgency)) return false
      
      // Check category filter
      if (item.category_name && !filters.selectedCategories.has(item.category_name)) return false
      
      // Check has active order filter (show only items where user has sell orders)
      if (filters.hasActiveOrderOnly && !item.hasSellOrder) return false
      
      // Note: noCompetitionOnly filter not applicable for watchlist (no competition data)
      
      // Check min orders/day filter
      if (filters.minOrdersPerDay !== null && dailySales < filters.minOrdersPerDay) return false
      
      // Check min profit/day filter
      if (filters.minProfitPerDay !== null && dailyProfit < filters.minProfitPerDay) return false
      
      // Check max Jita cost filter
      if (filters.maxJitaCost !== null && jitaPrice > filters.maxJitaCost) return false
      
      return true
    })
  }, [items, filters])

  // Transform to StockItemData for table
  const tableItems = useMemo(() => filteredItems.map(toStockItemData), [filteredItems])

  // Group items by urgency for summary cards
  const itemsByUrgency = useMemo(() => ({
    critical: filteredItems.filter(i =>
      (i.stock ?? 0) === 0 && !i.hasSellOrder
    ),
    warning: filteredItems.filter(i =>
      (i.stock ?? 0) > 0 &&
      !i.hasSellOrder &&
      i.daysUntilStockout !== null &&
      i.daysUntilStockout < 3
    ),
  }), [filteredItems])

  // Calculate daily profit sum
  const totalDailyProfit = filteredItems.reduce((sum, i) => sum + (i.dailyProfit ?? 0), 0)

  const filterSidebar = (
    <StockFilterSidebar
      filters={filters}
      onFiltersChange={onFiltersChange}
      totalItems={items.length}
      filteredCount={filteredItems.length}
      idPrefix="watchlist"
    />
  )

  return (
    <div className="space-y-6">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRefresh(true)}
                disabled={loading || !structureId}
                title={!structureId ? "Set Structure ID first" : "Check stock levels"}
              >
                {loading ? (
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
              onSelect={onAddItem}
              placeholder="Search for items to add..."
              disabled={addingItem}
              existingTypeIds={existingTypeIds}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {checkedAt && (
            <p className="text-xs text-muted-foreground">
              Stock checked at {new Date(checkedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Watchlist Summary */}
      {items.length > 0 && checkedAt && (
        <StockSummaryCards
          totalItems={items.length}
          criticalCount={itemsByUrgency.critical.length}
          warningCount={itemsByUrgency.warning.length}
          dailyProfit={totalDailyProfit}
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

      {/* Watchlist Items */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="size-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              No items in watchlist yet. Use the search above to add items.
            </p>
          </CardContent>
        </Card>
      ) : !checkedAt ? (
        /* Stock not checked yet - show call-to-action then simplified list */
        <div className="space-y-3">
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <BarChart3 className="size-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                Load stock levels and depletion metrics for your {items.length} watchlist item{items.length !== 1 ? 's' : ''}
              </p>
              <Button
                onClick={() => onRefresh(true)}
                disabled={loading || !structureId}
              >
                {loading ? (
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
          {items.map((item) => (
            <StockItemCardSimple
              key={item.id}
              typeId={item.type_id}
              name={item.item_name}
              categoryName={item.category_name}
              groupName={item.group_name}
              actions={
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveItem(item.type_id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          ))}
        </div>
      ) : (
        <>
          {/* Sidebar + Table Layout */}
          <div className="flex gap-6">
            {/* Main Content - Table */}
            <div className="flex-1 min-w-0">
              <StockTable
                items={tableItems}
                onRemoveItem={onRemoveItem}
                showRemoveButton={true}
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
                  Filters ({filteredItems.length} of {items.length})
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
export { DEFAULT_STOCK_FILTERS as DEFAULT_WATCHLIST_FILTERS }
export type { StockFilterState as WatchlistFilterState }
