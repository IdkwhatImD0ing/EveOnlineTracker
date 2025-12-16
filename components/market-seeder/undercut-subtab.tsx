"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Minus,
  Package,
  HelpCircle,
} from "lucide-react"
import { type UndercutItem, type SafeItem, type UndercutData } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"

interface UndercutSubtabProps {
  data: UndercutData | null
  loading: boolean
  error: string | null
  copiedId: number | null
  onRefresh: () => void
  onCopyPrice: (item: UndercutItem) => void
}

export function UndercutSubtab({
  data,
  loading,
  error,
  copiedId,
  onRefresh,
  onCopyPrice,
}: UndercutSubtabProps) {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Minus className="size-5" />
                Undercut Tracker
              </CardTitle>
              <CardDescription>
                Check if competitors have undercut your sell orders and get copy-pasteable prices to beat them
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
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Check Undercuts
                </>
              )}
            </Button>
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
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={data.summary.undercut_count > 0 ? "border-red-500/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${data.summary.undercut_count > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                  <AlertTriangle className={`size-6 ${data.summary.undercut_count > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.undercut_count}</p>
                  <p className="text-sm text-muted-foreground">Being Undercut</p>
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
                  <p className="text-2xl font-bold">{data.summary.safe_count}</p>
                  <p className="text-sm text-muted-foreground">Lowest Price</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_orders_in_structure}</p>
                  <p className="text-sm text-muted-foreground">Your Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Undercut Items List */}
      {data && data.undercut_items.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-500">
              <AlertTriangle className="size-5" />
              Items Being Undercut ({data.undercut_items.length})
            </CardTitle>
            <CardDescription>
              Sorted by days until your order becomes lowest. Click undercut price to copy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.undercut_items.map((item) => {
                // Color coding for days to lowest
                const daysColor = item.days_to_lowest === null
                  ? "text-muted-foreground"
                  : item.days_to_lowest > 30
                    ? "text-red-500"
                    : item.days_to_lowest > 7
                      ? "text-amber-500"
                      : "text-emerald-500"

                return (
                  <div
                    key={item.your_order_id}
                    className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                  >
                    {/* Top row: Item info and Days to Lowest badge */}
                    <div className="flex items-center gap-4 mb-3">
                      <EveItemIcon typeId={item.type_id} size={32} className="size-8 rounded" />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.type_name)
                          }}
                          className="font-medium truncate hover:underline cursor-pointer text-left"
                          title="Click to copy item name"
                        >
                          {item.type_name}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {item.your_volume_remain} units remaining
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${item.days_to_lowest !== null && item.days_to_lowest > 30 ? "bg-red-500/20" : item.days_to_lowest !== null && item.days_to_lowest > 7 ? "bg-amber-500/20" : "bg-emerald-500/20"} ${daysColor} gap-1`}
                      >
                        <Clock className="size-3" />
                        {item.days_to_lowest !== null
                          ? `${Math.ceil(item.days_to_lowest)} days`
                          : "No data"}
                      </Badge>
                    </div>

                    {/* Bottom row: Stats and copy button */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex-1 grid grid-cols-5 gap-4">
                        <div>
                          <p className="text-muted-foreground text-xs">Your Price</p>
                          <p className="font-medium">{item.your_price_formatted}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Lowest Competitor</p>
                          <p className="font-medium text-red-500">{item.competitor_price_formatted}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Competitors Below</p>
                          <p className="font-medium">{item.competitors_below_count} orders ({item.competitors_below_volume} units)</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Est. Daily Sales</p>
                          <p className="font-medium">{item.estimated_daily_sales.toFixed(1)} units</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Days to Lowest</p>
                          <p className={`font-medium ${daysColor}`}>
                            {item.days_to_lowest !== null
                              ? `${Math.ceil(item.days_to_lowest)} days`
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-w-[140px] font-mono"
                        onClick={() => onCopyPrice(item)}
                      >
                        {copiedId === item.your_order_id ? (
                          <>
                            <Check className="size-4 mr-2 text-emerald-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="size-4 mr-2" />
                            {item.undercut_price_eve}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safe Items List */}
      {data && data.safe_items.length > 0 && (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-600">
              <Check className="size-5" />
              Lowest Price ({data.safe_items.length})
            </CardTitle>
            <CardDescription>
              You have the lowest price on these items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.safe_items.map((item) => (
                <div
                  key={item.your_order_id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5"
                >
                  <EveItemIcon typeId={item.type_id} size={32} className="size-8 rounded" />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.type_name)
                      }}
                      className="font-medium truncate hover:underline cursor-pointer text-left"
                      title="Click to copy item name"
                    >
                      {item.type_name}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {item.your_volume_remain} units remaining
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Your Price</p>
                    <p className="font-medium text-emerald-600">{item.your_price_formatted}</p>
                  </div>
                  {item.next_competitor_price_formatted && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Next Competitor</p>
                      <p className="font-medium">{item.next_competitor_price_formatted}</p>
                    </div>
                  )}
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-600">
                    <Check className="size-3 mr-1" />
                    Lowest
                  </Badge>
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
                <Minus className="size-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Check Your Orders</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &quot;Check Undercuts&quot; to see if competitors have undercut your sell orders in the structure
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No undercuts state */}
      {data && data.undercut_items.length === 0 && data.safe_items.length > 0 && (
        <Alert>
          <Check className="size-4 text-emerald-500" />
          <AlertDescription>
            All your orders have the lowest price! No action needed.
          </AlertDescription>
        </Alert>
      )}

      {/* No orders in structure */}
      {data && data.summary.total_orders_in_structure === 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            You have no sell orders in this structure. Place some orders first to track undercuts.
          </AlertDescription>
        </Alert>
      )}

      {/* Tick size info */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <HelpCircle className="size-4" />
        <span>
          Undercut prices respect EVE&apos;s 4 significant figure tick size (e.g., 1M ISK items have 100 ISK ticks)
        </span>
      </div>
    </div>
  )
}

