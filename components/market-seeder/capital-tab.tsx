"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  ChevronDown,
  DollarSign,
  Percent,
  Skull,
  HelpCircle,
  MapPin,
  Users,
  User,
} from "lucide-react"
import { type CapitalEfficiencyResponse, type CharacterCapitalSummary, type ProgressState, DEAD_CAPITAL_THRESHOLD_DAYS } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { formatIskShort, KNOWN_STRUCTURES } from "./utils"
import { ProgressBar } from "./progress-bar"

interface CapitalTabProps {
  data: CapitalEfficiencyResponse | null
  loading: boolean
  error: string | null
  progress: ProgressState | null
  onRefresh: () => void
}

// Helper to get location name from ID
function getLocationName(locationId: number): string {
  const known = KNOWN_STRUCTURES.find(s => s.id === String(locationId))
  if (known) return known.name
  return `Structure ${locationId}`
}

// Color palette for character breakdown chart
const CHARACTER_COLORS = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
]

// Generate conic gradient for pie chart
function generatePieGradient(characters: CharacterCapitalSummary[]): string {
  if (characters.length === 0) return 'conic-gradient(from 0deg, hsl(var(--muted)) 0deg 360deg)'
  
  const segments: string[] = []
  let currentAngle = 0
  
  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]
    const angle = (char.percentage / 100) * 360
    const color = CHARACTER_COLORS[i % CHARACTER_COLORS.length]
    segments.push(`${color} ${currentAngle}deg ${currentAngle + angle}deg`)
    currentAngle += angle
  }
  
  return `conic-gradient(from 0deg, ${segments.join(', ')})`
}

export function CapitalTab({
  data,
  loading,
  error,
  progress,
  onRefresh,
}: CapitalTabProps) {
  // Location filter state
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  // Character filter state
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all")

  // Extract unique locations from orders
  const locations = useMemo(() => {
    if (!data?.orders) return []
    const locationMap = new Map<number, { id: number; name: string; count: number }>()
    
    for (const order of data.orders) {
      const existing = locationMap.get(order.locationId)
      if (existing) {
        existing.count++
      } else {
        locationMap.set(order.locationId, {
          id: order.locationId,
          name: getLocationName(order.locationId),
          count: 1,
        })
      }
    }
    
    return Array.from(locationMap.values()).sort((a, b) => b.count - a.count)
  }, [data?.orders])

  // Extract unique characters from orders
  const characters = useMemo(() => {
    if (!data?.summary?.byCharacter) return []
    return data.summary.byCharacter
  }, [data?.summary?.byCharacter])

  // Filter orders by selected location and character
  const filteredOrders = useMemo(() => {
    if (!data?.orders) return []
    let orders = data.orders
    
    if (selectedLocation !== "all") {
      orders = orders.filter(order => String(order.locationId) === selectedLocation)
    }
    
    if (selectedCharacter !== "all") {
      orders = orders.filter(order => String(order.characterId) === selectedCharacter)
    }
    
    return orders
  }, [data?.orders, selectedLocation, selectedCharacter])

  // Recalculate summary metrics for filtered orders
  const filteredSummary = useMemo(() => {
    if (!data?.summary) return null
    if (selectedLocation === "all" && selectedCharacter === "all") return data.summary

    const orders = filteredOrders
    const totalCapitalDeployed = orders.reduce((sum, o) => sum + o.capitalDeployed, 0)
    
    // Capital-weighted average days to sell
    let weightedDaysSum = 0
    let capitalWithDays = 0
    for (const order of orders) {
      if (order.daysToSell !== null) {
        weightedDaysSum += order.daysToSell * order.capitalDeployed
        capitalWithDays += order.capitalDeployed
      }
    }
    const avgDaysToSell = capitalWithDays > 0 ? weightedDaysSum / capitalWithDays : 0

    // Daily revenue
    const totalDailyRevenue = orders.reduce((sum, o) => {
      if (o.daysToSell !== null && o.daysToSell > 0) {
        return sum + (o.capitalDeployed / o.daysToSell)
      }
      return sum
    }, 0)

    // Portfolio APY
    let totalWeightedAPY = 0
    let capitalWithAPY = 0
    for (const order of orders) {
      if (order.effectiveAPY !== null && order.effectiveAPY > 0) {
        totalWeightedAPY += order.effectiveAPY * order.capitalDeployed
        capitalWithAPY += order.capitalDeployed
      }
    }
    const effectiveAPY = capitalWithAPY > 0 ? totalWeightedAPY / capitalWithAPY : 0

    // Dead capital
    const deadOrders = orders.filter(o => o.isDeadCapital)
    const deadCapitalValue = deadOrders.reduce((sum, o) => sum + o.capitalDeployed, 0)

    // Capital by efficiency
    const fastCapital = orders.filter(o => o.efficiency === 'fast').reduce((sum, o) => sum + o.capitalDeployed, 0)
    const moderateCapital = orders.filter(o => o.efficiency === 'moderate').reduce((sum, o) => sum + o.capitalDeployed, 0)
    const slowCapital = orders.filter(o => o.efficiency === 'slow').reduce((sum, o) => sum + o.capitalDeployed, 0)

    return {
      ...data.summary,
      totalCapitalDeployed,
      totalOrders: orders.length,
      totalDailyRevenue,
      avgDaysToSell: Math.round(avgDaysToSell * 10) / 10,
      effectiveAPY: Math.round(effectiveAPY * 10) / 10,
      deadCapitalValue,
      deadCapitalOrders: deadOrders.length,
      fastCapital,
      moderateCapital,
      slowCapital,
    }
  }, [data?.summary, filteredOrders, selectedLocation, selectedCharacter])

  // Show filter only when there are multiple locations or characters
  const showLocationFilter = locations.length > 1
  const showCharacterFilter = characters.length > 1

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
            <div className="flex items-center gap-2">
              {showCharacterFilter && (
                <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                  <SelectTrigger className="w-[180px]">
                    <User className="size-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All Characters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Characters ({data?.orders.length})
                    </SelectItem>
                    {characters.map((char, index) => (
                      <SelectItem key={char.characterId} value={String(char.characterId)}>
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full"
                            style={{ backgroundColor: CHARACTER_COLORS[index % CHARACTER_COLORS.length] }}
                          />
                          {char.characterName} ({char.orderCount})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {showLocationFilter && (
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-[180px]">
                    <MapPin className="size-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All Systems" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Systems ({data?.orders.length})
                    </SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name} ({loc.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                    <li>• <strong>Est. Daily Sales</strong> = Regional Volume × {data.config.hubFactor * 100}% (hub factor)</li>
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

      {/* Loading State with Progress Bar */}
      {loading && progress && (
        <Card>
          <CardContent className="py-8">
            <ProgressBar progress={progress} />
          </CardContent>
        </Card>
      )}

      {/* Fallback loading spinner (no progress data) */}
      {loading && !progress && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Summary Cards */}
      {data && filteredSummary && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{formatIskShort(filteredSummary.totalCapitalDeployed)}</p>
                <p className="text-sm text-muted-foreground">Total ISK Deployed</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredSummary.totalOrders} active orders
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-emerald-500">
                  {formatIskShort(filteredSummary.totalDailyRevenue)}
                </p>
                <p className="text-sm text-muted-foreground">Est. Daily Revenue</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {data.config.hubFactor * 100}% of regional volume
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">
                  {filteredSummary.avgDaysToSell.toFixed(1)} days
                </p>
                <p className="text-sm text-muted-foreground">Avg Time to Sell</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Capital-weighted average
                </p>
              </CardContent>
            </Card>
            <Card className={filteredSummary.effectiveAPY > 100 ? "border-emerald-500/50" : ""}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${filteredSummary.effectiveAPY > 100 ? "text-emerald-500" : filteredSummary.effectiveAPY > 50 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {filteredSummary.effectiveAPY.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">Effective APY</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Portfolio-wide return
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dead Capital Alert */}
          {filteredSummary.deadCapitalOrders > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skull className="size-8 text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Dead Capital Alert</p>
                    <p className="text-sm text-muted-foreground">
                      {filteredSummary.deadCapitalOrders} orders ({formatIskShort(filteredSummary.deadCapitalValue)} ISK)
                      are estimated to take {`>`}{DEAD_CAPITAL_THRESHOLD_DAYS} days to sell
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-destructive">
                      {((filteredSummary.deadCapitalValue / filteredSummary.totalCapitalDeployed) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">of capital</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Capital Breakdown by Character */}
          {data.summary.byCharacter && data.summary.byCharacter.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="size-4" />
                  Capital by Character
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Pie Chart */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <div
                      className="size-32 rounded-full shadow-inner"
                      style={{
                        background: generatePieGradient(data.summary.byCharacter),
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {data.summary.byCharacter.length} character{data.summary.byCharacter.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  {/* Character List */}
                  <div className="flex-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.summary.byCharacter.map((char, index) => (
                      <div
                        key={char.characterId}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: CHARACTER_COLORS[index % CHARACTER_COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <User className="size-3.5 text-muted-foreground shrink-0" />
                            <p className="font-medium truncate text-sm">{char.characterName}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatIskShort(char.capitalDeployed)}</span>
                            <span>·</span>
                            <span>{char.percentage.toFixed(1)}%</span>
                            <span>·</span>
                            <span>{char.orderCount} orders</span>
                          </div>
                        </div>
                        {char.effectiveAPY > 0 && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {char.effectiveAPY.toFixed(0)}% APY
                          </Badge>
                        )}
                      </div>
                    ))}
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
                      style={{ width: `${filteredSummary.totalCapitalDeployed > 0 ? (filteredSummary.fastCapital / filteredSummary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(filteredSummary.fastCapital)}</div>
                  <div className="w-16 text-xs text-muted-foreground text-right">&lt;14d</div>
                </div>
                {/* Moderate (14-30 days) */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-amber-600">Moderate</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${filteredSummary.totalCapitalDeployed > 0 ? (filteredSummary.moderateCapital / filteredSummary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(filteredSummary.moderateCapital)}</div>
                  <div className="w-16 text-xs text-muted-foreground text-right">14-30d</div>
                </div>
                {/* Slow (30-90 days) */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-orange-600">Slow</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${filteredSummary.totalCapitalDeployed > 0 ? (filteredSummary.slowCapital / filteredSummary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(filteredSummary.slowCapital)}</div>
                  <div className="w-16 text-xs text-muted-foreground text-right">30-90d</div>
                </div>
                {/* Dead (>90 days) */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-destructive">Dead</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive transition-all"
                      style={{ width: `${filteredSummary.totalCapitalDeployed > 0 ? (filteredSummary.deadCapitalValue / filteredSummary.totalCapitalDeployed) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-24 text-sm text-right">{formatIskShort(filteredSummary.deadCapitalValue)}</div>
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
                {filteredOrders.map((order) => (
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
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{order.volumeRemain.toLocaleString()} units @ {formatIskShort(order.price)} each</span>
                            {characters.length > 1 && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <div
                                    className="size-2 rounded-full"
                                    style={{
                                      backgroundColor: CHARACTER_COLORS[
                                        characters.findIndex(c => c.characterId === order.characterId) % CHARACTER_COLORS.length
                                      ]
                                    }}
                                  />
                                  {order.characterName}
                                </span>
                              </>
                            )}
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
                {filteredOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p>{selectedLocation === "all" ? "No active sell orders found" : "No orders in this location"}</p>
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

