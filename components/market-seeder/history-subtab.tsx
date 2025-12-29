"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Package,
  Percent,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  type OrderHistoryData,
  type HistoricalOrderItem,
  type OrderHistoryPeriod,
  ORDER_HISTORY_PERIODS,
} from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"

interface HistorySubtabProps {
  data: OrderHistoryData | null
  loading: boolean
  error: string | null
  period: OrderHistoryPeriod
  onPeriodChange: (period: OrderHistoryPeriod) => void
  onRefresh: () => void
}

type SortKey = "totalProfit" | "totalRevenue" | "quantitySold" | "profitMargin"
type SortDirection = "asc" | "desc"

function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(0)
}

export function HistorySubtab({
  data,
  loading,
  error,
  period,
  onPeriodChange,
  onRefresh,
}: HistorySubtabProps) {
  const [sortBy, setSortBy] = useState<SortKey>("totalProfit")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  // Sort items
  const sortedItems = useMemo(() => {
    if (!data) return []
    const items = [...data.items]
    items.sort((a, b) => {
      const multiplier = sortDirection === "desc" ? -1 : 1
      return (a[sortBy] - b[sortBy]) * multiplier
    })
    return items
  }, [data, sortBy, sortDirection])

  // Toggle sort
  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc")
    } else {
      setSortBy(key)
      setSortDirection("desc")
    }
  }

  // Toggle item expansion
  const toggleExpand = (typeId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }

  // Profit color
  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-emerald-500"
    if (profit < 0) return "text-red-500"
    return "text-muted-foreground"
  }

  // Margin badge color
  const getMarginBadgeClass = (margin: number) => {
    if (margin >= 50) return "bg-emerald-500/20 text-emerald-500"
    if (margin >= 20) return "bg-amber-500/20 text-amber-500"
    if (margin >= 0) return "bg-muted text-muted-foreground"
    return "bg-red-500/20 text-red-500"
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5" />
                Order History
              </CardTitle>
              <CardDescription>
                Analyze completed sell orders to find your most profitable items
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Period Tabs */}
              <Tabs value={period} onValueChange={(v) => onPeriodChange(v as OrderHistoryPeriod)}>
                <TabsList>
                  {ORDER_HISTORY_PERIODS.map(p => (
                    <TabsTrigger key={p.value} value={p.value} className="text-xs md:text-sm">
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                onClick={onRefresh}
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

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
                  <p className="text-2xl font-bold">{data.summary.totalOrders}</p>
                  <p className="text-sm text-muted-foreground">Orders Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <DollarSign className="size-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatISK(data.summary.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={data.summary.totalProfit > 0 ? "border-emerald-500/50" : data.summary.totalProfit < 0 ? "border-red-500/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${data.summary.totalProfit > 0 ? "bg-emerald-500/10" : data.summary.totalProfit < 0 ? "bg-red-500/10" : "bg-muted"}`}>
                  <TrendingUp className={`size-6 ${getProfitColor(data.summary.totalProfit)}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getProfitColor(data.summary.totalProfit)}`}>
                    {formatISK(data.summary.totalProfit)}
                  </p>
                  <p className="text-sm text-muted-foreground">Est. Total Profit</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Percent className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.avgProfitMargin.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Avg Margin</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Items List */}
      {data && data.items.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Profit by Item ({data.items.length} items)
              </CardTitle>
              <Select value={sortBy} onValueChange={(v) => handleSort(v as SortKey)}>
                <SelectTrigger className="w-[180px]">
                  <ArrowUpDown className="size-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalProfit">Sort by Profit</SelectItem>
                  <SelectItem value="totalRevenue">Sort by Revenue</SelectItem>
                  <SelectItem value="quantitySold">Sort by Quantity</SelectItem>
                  <SelectItem value="profitMargin">Sort by Margin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedItems.map((item) => {
                const isExpanded = expandedItems.has(item.typeId)
                
                return (
                  <div
                    key={item.typeId}
                    className={`rounded-lg border transition-colors ${
                      item.totalProfit > 0 
                        ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10" 
                        : item.totalProfit < 0 
                          ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                          : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {/* Main row */}
                    <button
                      onClick={() => toggleExpand(item.typeId)}
                      className="w-full p-4 flex items-center gap-4 text-left"
                    >
                      <EveItemIcon typeId={item.typeId} size={32} className="size-8 rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.typeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.orderCount} order{item.orderCount !== 1 ? "s" : ""} • {item.quantitySold.toLocaleString()} sold
                        </p>
                      </div>
                      <div className="hidden sm:block text-right">
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="font-medium">{formatISK(item.totalRevenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Profit</p>
                        <p className={`font-bold ${getProfitColor(item.totalProfit)}`}>
                          {formatISK(item.totalProfit)}
                        </p>
                      </div>
                      <Badge variant="secondary" className={getMarginBadgeClass(item.profitMargin)}>
                        {item.profitMargin.toFixed(1)}%
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Avg Sell Price</p>
                            <p className="font-medium">{formatISK(item.avgSellPrice)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Est. Jita Price</p>
                            <p className="font-medium">
                              {item.jitaPrice ? formatISK(item.jitaPrice) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Est. Total Cost</p>
                            <p className="font-medium">{formatISK(item.estimatedCost)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Category</p>
                            <p className="font-medium">{item.categoryName ?? "Unknown"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state - no data yet */}
      {!data && !loading && !error && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="size-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Analyze Your Sales History</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &quot;Refresh&quot; to fetch your completed sell orders and see which items made the most profit
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state - no orders in period */}
      {data && data.items.length === 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            No completed sell orders found in the last {ORDER_HISTORY_PERIODS.find(p => p.value === period)?.label.toLowerCase()}.
            Orders must be fully sold (expired with 0 remaining) to appear here.
          </AlertDescription>
        </Alert>
      )}

      {/* Info footer */}
      {data && data.items.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p>
            Profit is estimated using current Jita prices + transport cost ({data.config.transportCostPerM3} ISK/m³).
            Actual profit may differ from acquisition cost at time of purchase.
          </p>
        </div>
      )}
    </div>
  )
}

