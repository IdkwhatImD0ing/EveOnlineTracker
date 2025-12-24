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
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Copy,
  Check,
  Eye,
  Trash2,
  AlertTriangle,
  Clock,
  Minus,
  BarChart3,
  Settings2,
} from "lucide-react"
import { type WatchlistItem } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { ItemSearch, TradeableItem } from "@/components/market/item-search"
import { formatIskShort } from "./utils"
import { WatchlistFilterSidebar, WatchlistFilterState } from "./watchlist-filter-sidebar"

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
  filters: WatchlistFilterState
  onFiltersChange: (filters: WatchlistFilterState) => void

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
}

// Helper to determine urgency level for a watchlist item
function getUrgencyLevel(item: WatchlistItem): 'critical' | 'warning' | 'ok' | 'none' {
  if (item.hasSellOrder) return 'ok'
  if ((item.stock ?? 0) === 0) return 'critical'
  if (item.daysUntilStockout === null) return 'none'
  if (item.daysUntilStockout < 3) return 'warning'
  return 'ok'
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
}: WatchlistTabProps) {
  const existingTypeIds = new Set(items.map(item => item.type_id))

  // Filter items based on selected filters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const urgency = getUrgencyLevel(item)
      
      // Check urgency filter
      if (!filters.selectedUrgency.has(urgency)) return false
      
      // Check category filter
      if (item.category_name && !filters.selectedCategories.has(item.category_name)) return false
      
      // Check hide sell order items filter
      if (filters.hideSellOrderItems && item.hasSellOrder) return false
      
      return true
    })
  }, [items, filters])

  // Group items by urgency (from filtered items for restock)
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
    safe: filteredItems.filter(i =>
      i.hasSellOrder || (i.daysUntilStockout !== null && i.daysUntilStockout >= 3)
    ),
  }), [filteredItems])

  // Items to restock based on filters
  const itemsToRestock = [
    ...(includeCritical ? itemsByUrgency.critical : []),
    ...(includeWarning ? itemsByUrgency.warning : []),
  ]

  const itemsToCopy = restockTopN ? itemsToRestock.slice(0, restockTopN) : itemsToRestock

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
              {checkedAt && (itemsByUrgency.critical.length > 0 || itemsByUrgency.warning.length > 0) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm">
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
                          id="includeCritical"
                          checked={includeCritical}
                          onCheckedChange={(checked) => setIncludeCritical(checked === true)}
                        />
                        <label
                          htmlFor="includeCritical"
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
                          id="includeWarning"
                          checked={includeWarning}
                          onCheckedChange={(checked) => setIncludeWarning(checked === true)}
                        />
                        <label
                          htmlFor="includeWarning"
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-sm text-muted-foreground">Items Tracked</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-destructive">
                {itemsByUrgency.critical.length}
              </p>
              <p className="text-sm text-muted-foreground">Critical (out of stock)</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-500">
                {itemsByUrgency.warning.length}
              </p>
              <p className="text-sm text-muted-foreground">Warning (&lt;3 days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">
                {formatIskShort(filteredItems.reduce((sum, i) => sum + (i.dailyProfit ?? 0), 0))}
              </p>
              <p className="text-sm text-muted-foreground">Daily Profit Potential</p>
            </CardContent>
          </Card>
        </div>
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
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <EveItemIcon typeId={item.type_id} size={64} className="size-10 shrink-0 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.item_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.category_name} • {item.group_name}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveItem(item.type_id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Sidebar + List Layout */}
          <div className="flex gap-6">
            {/* Main Content - Items List */}
            <div className="flex-1 min-w-0 space-y-3">
              {filteredItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Eye className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      No items match your current filters
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredItems.map((item) => {
                  const urgencyLevel = getUrgencyLevel(item)

                  return (
                    <Card
                      key={item.id}
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
                          <EveItemIcon typeId={item.type_id} size={64} className="size-10 shrink-0 rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.item_name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.category_name} • {item.group_name}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs">Current Stock</p>
                                <p className="font-medium">{(item.stock ?? 0).toLocaleString()} units</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Est. Daily Sales</p>
                                <p className="font-medium">{(item.estimatedDailySales ?? 0).toFixed(1)} units/day</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Days Until Stockout</p>
                                <p className={`font-bold ${urgencyLevel === 'critical' ? 'text-destructive' :
                                  urgencyLevel === 'warning' ? 'text-amber-500' :
                                    urgencyLevel === 'ok' ? 'text-emerald-500' :
                                      'text-muted-foreground'
                                  }`}>
                                  {item.daysUntilStockout !== null
                                    ? `${item.daysUntilStockout.toFixed(1)} days`
                                    : 'No sales data'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Daily Profit</p>
                                <p className="font-medium text-primary">{formatIskShort(item.dailyProfit ?? 0)} ISK</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {urgencyLevel === 'critical' && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="size-3" />
                                Out of Stock
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
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveItem(item.type_id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>

            {/* Sidebar - Filters (Desktop) */}
            <div className="w-64 shrink-0 hidden lg:block">
              <WatchlistFilterSidebar
                filters={filters}
                onFiltersChange={onFiltersChange}
                totalItems={items.length}
                filteredCount={filteredItems.length}
              />
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
                <WatchlistFilterSidebar
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  totalItems={items.length}
                  filteredCount={filteredItems.length}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </>
      )}
    </div>
  )
}
