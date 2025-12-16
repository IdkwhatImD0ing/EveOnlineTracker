"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  DollarSign,
  Percent,
  Skull,
  HelpCircle,
} from "lucide-react"
import { type CapitalEfficiencyResponse, DEAD_CAPITAL_THRESHOLD_DAYS } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { formatIskShort } from "./utils"

interface CapitalTabProps {
  data: CapitalEfficiencyResponse | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export function CapitalTab({
  data,
  loading,
  error,
  onRefresh,
}: CapitalTabProps) {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="size-5" />
                Capital Efficiency Dashboard
              </CardTitle>
              <CardDescription>
                Track your ISK-at-work across all market sell orders
              </CardDescription>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!error && !data && !loading && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                Login with EVE SSO and click Refresh to analyze your sell orders
              </AlertDescription>
            </Alert>
          )}
          {data && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <HelpCircle className="size-4" />
                <span>How metrics are calculated</span>
                <ChevronDown className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 mt-2">
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>Est. Daily Sales</strong> = Vale Volume × 5% (hub factor)</li>
                    <li>• <strong>Days to Sell</strong> = Volume Remaining ÷ Est. Daily Sales</li>
                    <li>• <strong>APY</strong> = (Profit ÷ Cost) × (365 ÷ Days to Sell) × 100</li>
                    <li>• <strong>Dead Capital</strong> = Orders taking {`>`}{DEAD_CAPITAL_THRESHOLD_DAYS} days to sell</li>
                  </ul>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          {data?.analyzedAt && (
            <p className="text-xs text-muted-foreground mt-4">
              Last analyzed: {new Date(data.analyzedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatIskShort(data.summary.totalCapitalDeployed)}</p>
                <p className="text-sm text-muted-foreground">Total ISK Deployed</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.totalOrders} active orders
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-emerald-500">
                  {formatIskShort(data.summary.totalDailyRevenue)}
                </p>
                <p className="text-sm text-muted-foreground">Est. Daily Revenue</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on 5% of Vale volume
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {data.summary.avgDaysToSell.toFixed(1)} days
                </p>
                <p className="text-sm text-muted-foreground">Avg Time to Sell</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Capital-weighted average
                </p>
              </CardContent>
            </Card>
            <Card className={data.summary.effectiveAPY > 100 ? "border-emerald-500/50" : ""}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${data.summary.effectiveAPY > 100 ? "text-emerald-500" : data.summary.effectiveAPY > 50 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {data.summary.effectiveAPY.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">Effective APY</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Portfolio-wide return
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dead Capital Alert */}
          {data.summary.deadCapitalOrders > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skull className="size-8 text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Dead Capital Alert</p>
                    <p className="text-sm text-muted-foreground">
                      {data.summary.deadCapitalOrders} orders ({formatIskShort(data.summary.deadCapitalValue)} ISK)
                      are estimated to take {`>`}{DEAD_CAPITAL_THRESHOLD_DAYS} days to sell
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-destructive">
                      {((data.summary.deadCapitalValue / data.summary.totalCapitalDeployed) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">of capital</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Capital Breakdown by Efficiency */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Capital Allocation by Efficiency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Fast (<14 days) */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-emerald-600">Fast</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${data.summary.totalCapitalDeployed > 0 ? (data.summary.fastCapital / data.summary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(data.summary.fastCapital)}</div>
                  <div className="w-16 text-xs text-muted-foreground text-right">&lt;14d</div>
                </div>
                {/* Moderate (14-30 days) */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-amber-600">Moderate</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${data.summary.totalCapitalDeployed > 0 ? (data.summary.moderateCapital / data.summary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(data.summary.moderateCapital)}</div>
                  <div className="w-16 text-xs text-muted-foreground text-right">14-30d</div>
                </div>
                {/* Slow (30-90 days) */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-orange-600">Slow</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${data.summary.totalCapitalDeployed > 0 ? (data.summary.slowCapital / data.summary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(data.summary.slowCapital)}</div>
                  <div className="w-16 text-xs text-muted-foreground text-right">30-90d</div>
                </div>
                {/* Dead (>90 days) */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-destructive">Dead</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive transition-all"
                      style={{ width: `${data.summary.totalCapitalDeployed > 0 ? (data.summary.deadCapitalValue / data.summary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(data.summary.deadCapitalValue)}</div>
                  <div className="w-16 text-xs text-muted-foreground text-right">&gt;90d</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Active Sell Orders</CardTitle>
              <CardDescription>
                Sorted by days to sell (slowest first to highlight dead capital)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.orders.map((order) => (
                  <Card
                    key={order.orderId}
                    className={
                      order.efficiency === 'dead'
                        ? "border-destructive/50 bg-destructive/5"
                        : order.efficiency === 'slow'
                          ? "border-orange-500/50 bg-orange-500/5"
                          : order.efficiency === 'moderate'
                            ? "border-amber-500/30 bg-amber-500/5"
                            : order.efficiency === 'fast'
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : ""
                    }
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <EveItemIcon typeId={order.typeId} size={64} className="size-10 shrink-0 rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{order.itemName}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.volumeRemain.toLocaleString()} units @ {formatIskShort(order.price)} each
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-sm font-medium">{formatIskShort(order.capitalDeployed)}</div>
                          <div className="flex items-center justify-end gap-2">
                            {order.daysToSell !== null ? (
                              <Badge
                                variant={order.efficiency === 'dead' ? 'destructive' : 'secondary'}
                                className={
                                  order.efficiency === 'fast' ? 'bg-emerald-500/20 text-emerald-600' :
                                    order.efficiency === 'moderate' ? 'bg-amber-500/20 text-amber-600' :
                                      order.efficiency === 'slow' ? 'bg-orange-500/20 text-orange-600' :
                                        ''
                                }
                              >
                                {order.daysToSell.toFixed(0)}d to sell
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                No volume data
                              </Badge>
                            )}
                            {order.effectiveAPY !== null && (
                              <Badge variant="outline" className="gap-1">
                                <Percent className="size-3" />
                                {order.effectiveAPY.toFixed(0)}% APY
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Expanded details for slow/dead capital */}
                      {(order.efficiency === 'dead' || order.efficiency === 'slow') && (
                        <div className="mt-2 pt-2 border-t grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Est. Daily Sales:</span>
                            <span className="ml-1 font-medium">{order.estimatedDailySales.toFixed(1)}/day</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Days Listed:</span>
                            <span className="ml-1 font-medium">{order.daysListed}d</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Jita Price:</span>
                            <span className="ml-1 font-medium">{order.jitaBuyPrice ? formatIskShort(order.jitaBuyPrice) : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Profit/Unit:</span>
                            <span className={`ml-1 font-medium ${order.profitPerUnit && order.profitPerUnit > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                              {order.profitPerUnit ? formatIskShort(order.profitPerUnit) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {data.orders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p>No active sell orders found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

