"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Copy,
  Check,
  AlertTriangle,
  Package,
  ShoppingCart,
  DollarSign,
  HelpCircle,
  Ban,
  Filter,
} from "lucide-react"
import { type SellOrderItem, type SellOrderData, type ExistingOrderItem, type ProgressState } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { ProgressBar } from "./progress-bar"

interface FilteredOutItem extends SellOrderItem {
  reason: 'quantity' | 'isk_per_day' | 'competition' | 'no_competition'
}

interface SellSubtabProps {
  data: SellOrderData | null
  loading: boolean
  error: string | null
  progress: ProgressState | null
  onRefresh: () => void

  // Filter state
  minQuantity: number
  setMinQuantity: (value: number) => void
  competitionFilter: "all" | "no_competition" | "with_competition"
  setCompetitionFilter: (value: "all" | "no_competition" | "with_competition") => void
  sortBy: "isk_per_day" | "volume" | "price"
  setSortBy: (value: "isk_per_day" | "volume" | "price") => void
  minIskPerDay: number
  setMinIskPerDay: (value: number) => void

  // Copy state
  copiedNameId: number | null
  copiedPriceId: number | null
  copyAllSuccess: boolean
  onCopyName: (item: SellOrderItem) => void
  onCopyPrice: (item: SellOrderItem) => void
  onCopyAll: () => void

  // Hub factor display
  hubFactorPercent?: string  // e.g. "5%" - for display in labels
}

export function SellSubtab({
  data,
  loading,
  error,
  progress,
  onRefresh,
  minQuantity,
  setMinQuantity,
  competitionFilter,
  setCompetitionFilter,
  sortBy,
  setSortBy,
  minIskPerDay,
  setMinIskPerDay,
  copiedNameId,
  copiedPriceId,
  copyAllSuccess,
  onCopyName,
  onCopyPrice,
  onCopyAll,
  hubFactorPercent = "5%",
}: SellSubtabProps) {
  // Filter and sort items
  const filteredItems = useMemo(() => {
    if (!data) return []

    return data.items
      .filter(item => {
        if (item.quantity < minQuantity) return false
        if (item.isk_per_day < minIskPerDay) return false
        if (competitionFilter === "no_competition" && item.has_competition) return false
        if (competitionFilter === "with_competition" && !item.has_competition) return false
        return true
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "isk_per_day":
            return b.isk_per_day - a.isk_per_day
          case "volume":
            return b.estimated_daily_sales - a.estimated_daily_sales
          case "price":
            return b.sell_price - a.sell_price
          default:
            return 0
        }
      })
  }, [data, minQuantity, minIskPerDay, competitionFilter, sortBy])

  // Calculate "do not sell" items
  const doNotSellItems = useMemo(() => {
    if (!data) return { existingOrders: [], filteredOut: [] }

    const filteredOut: FilteredOutItem[] = data.items
      .filter(item => !filteredItems.includes(item))
      .map(item => {
        let reason: FilteredOutItem['reason'] = 'quantity'
        if (item.quantity < minQuantity) reason = 'quantity'
        else if (item.isk_per_day < minIskPerDay) reason = 'isk_per_day'
        else if (competitionFilter === "no_competition" && item.has_competition) reason = 'competition'
        else if (competitionFilter === "with_competition" && !item.has_competition) reason = 'no_competition'
        return { ...item, reason }
      })

    return {
      existingOrders: data.items_with_existing_orders,
      filteredOut,
    }
  }, [data, filteredItems, minQuantity, minIskPerDay, competitionFilter])

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="size-5" />
                Sell Order Generator
              </CardTitle>
              <CardDescription>
                Generate optimal sell prices for your inventory in 3T7. Uses tiered markup for items with no competition.
              </CardDescription>
            </div>
            <Button
              onClick={onRefresh}
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Generate Sell Orders
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Bar */}
      {progress && (
        <Card>
          <CardContent className="pt-6 pb-4">
            <ProgressBar progress={progress} />
          </CardContent>
        </Card>
      )}

      {/* Filter Controls */}
      {data && data.items.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="min-quantity" className="whitespace-nowrap">Min Quantity:</Label>
                <Input
                  id="min-quantity"
                  type="number"
                  min={1}
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Competition:</Label>
                <div className="flex gap-1">
                  <Button
                    variant={competitionFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompetitionFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={competitionFilter === "no_competition" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompetitionFilter("no_competition")}
                    className={competitionFilter === "no_competition" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  >
                    No Competition
                  </Button>
                  <Button
                    variant={competitionFilter === "with_competition" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompetitionFilter("with_competition")}
                    className={competitionFilter === "with_competition" ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    With Competition
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Sort by:</Label>
                <div className="flex gap-1">
                  <Button
                    variant={sortBy === "isk_per_day" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("isk_per_day")}
                  >
                    ISK/Day
                  </Button>
                  <Button
                    variant={sortBy === "volume" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("volume")}
                  >
                    Volume
                  </Button>
                  <Button
                    variant={sortBy === "price" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("price")}
                  >
                    Price
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="min-isk-day" className="whitespace-nowrap">Min ISK/Day:</Label>
                <Input
                  id="min-isk-day"
                  type="number"
                  min={0}
                  step={1000}
                  value={minIskPerDay}
                  onChange={(e) => setMinIskPerDay(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-28"
                  placeholder="0"
                />
              </div>
              <span className="text-sm text-muted-foreground ml-auto">
                Showing {filteredItems.length} of {data.items.length} items
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopyAll}
                disabled={filteredItems.length === 0}
                className="gap-2"
              >
                {copyAllSuccess ? (
                  <>
                    <Check className="size-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Copy All ({filteredItems.length})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_items}</p>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <Check className="size-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_no_competition}</p>
                  <p className="text-sm text-muted-foreground">No Competition</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="size-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_with_competition}</p>
                  <p className="text-sm text-muted-foreground">With Competition</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <DollarSign className="size-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_isk_per_day_formatted}</p>
                  <p className="text-sm text-muted-foreground">Est. ISK/Day</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sell Order Items Table */}
      {data && filteredItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="size-5" />
              Sell Orders ({filteredItems.length} items)
            </CardTitle>
            <CardDescription>
              Sorted by ISK/day (highest first). Items with no competition use tiered markup pricing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.type_id}
                  className={`p-4 rounded-lg border transition-colors ${item.has_competition
                    ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                    : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                    }`}
                >
                  {/* Top row: Item info */}
                  <div className="flex items-center gap-4 mb-3">
                    <EveItemIcon typeId={item.type_id} size={32} className="size-8 rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.type_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity.toLocaleString()} units in inventory
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={item.has_competition ? "bg-amber-500/20 text-amber-600" : "bg-emerald-500/20 text-emerald-600"}
                    >
                      {item.has_competition ? "Competition" : "No Competition"}
                    </Badge>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-muted-foreground text-xs">Sell Price</p>
                        <p className="font-medium">{item.sell_price_formatted}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Jita Price</p>
                        <p className="font-medium text-muted-foreground">{item.jita_price_formatted}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Vol/Day ({hubFactorPercent})</p>
                        <p className="font-medium">{item.estimated_daily_sales.toFixed(2)} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">ISK/Day</p>
                        <p className="font-medium text-blue-500">{item.isk_per_day_formatted}</p>
                      </div>
                    </div>

                    {/* Copy buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-[100px]"
                        onClick={() => onCopyName(item)}
                      >
                        {copiedNameId === item.type_id ? (
                          <>
                            <Check className="size-4 mr-2 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="size-4 mr-2" />
                            Name
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-[140px] font-mono"
                        onClick={() => onCopyPrice(item)}
                      >
                        {copiedPriceId === item.type_id ? (
                          <>
                            <Check className="size-4 mr-2 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="size-4 mr-2" />
                            {item.sell_price_eve}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="size-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Generate Sell Orders</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &quot;Generate Sell Orders&quot; to analyze your 3T7 inventory and get optimal sell prices
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No items state */}
      {data && data.items.length === 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            No sellable items found in your 3T7 inventory. Items need Jita price data to generate sell orders.
          </AlertDescription>
        </Alert>
      )}

      {/* All items filtered out */}
      {data && data.items.length > 0 && filteredItems.length === 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            All {data.items.length} items filtered out. Try lowering the minimum quantity filter.
          </AlertDescription>
        </Alert>
      )}

      {/* Do Not Sell Section */}
      {data && (doNotSellItems.existingOrders.length > 0 || doNotSellItems.filteredOut.length > 0) && (
        <Collapsible>
          <Card className="border-muted">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="size-4 text-muted-foreground" />
                    Do Not Sell ({doNotSellItems.existingOrders.length + doNotSellItems.filteredOut.length} items)
                  </CardTitle>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Existing Orders */}
                {doNotSellItems.existingOrders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ShoppingCart className="size-4 text-blue-500" />
                      Has Existing Orders ({doNotSellItems.existingOrders.length})
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {doNotSellItems.existingOrders.map((item) => (
                        <div key={item.type_id} className="flex items-center gap-2 text-sm py-1 px-2 bg-blue-500/5 rounded">
                          <EveItemIcon typeId={item.type_id} size={32} className="size-8 shrink-0" />
                          <span className="flex-1 truncate">{item.type_name}</span>
                          <span className="text-muted-foreground font-mono text-xs">{item.quantity.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtered Out */}
                {doNotSellItems.filteredOut.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Filter className="size-4 text-amber-500" />
                      Filtered Out ({doNotSellItems.filteredOut.length})
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {doNotSellItems.filteredOut.map((item) => (
                        <div key={item.type_id} className="flex items-center gap-2 text-sm py-1 px-2 bg-amber-500/5 rounded">
                          <EveItemIcon typeId={item.type_id} size={32} className="size-8 shrink-0" />
                          <span className="flex-1 truncate">{item.type_name}</span>
                          <span className="text-muted-foreground font-mono text-xs">{item.quantity.toLocaleString()}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.reason === 'quantity' ? 'Low Qty'
                              : item.reason === 'isk_per_day' ? 'Low ISK/Day'
                                : item.reason === 'competition' ? 'Has Competition'
                                  : item.reason === 'no_competition' ? 'No Competition'
                                    : 'Filter'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Pricing info */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <HelpCircle className="size-4" />
        <span>
          No competition: tiered markup (4x for &lt;500K, 3x for &lt;2M, 2x for &lt;10M, 1.7x for &lt;50M, 1.4x for ≥50M). With competition: 1-tick undercut.
        </span>
      </div>
    </div>
  )
}

