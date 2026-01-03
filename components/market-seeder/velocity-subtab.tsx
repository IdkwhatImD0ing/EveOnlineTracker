"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Trophy,
  Calendar,
  ChevronDown,
  ChevronUp,
  Zap,
  Star,
  BarChart3,
} from "lucide-react"
import {
  type TradingVelocityResponse,
  type VelocityPeriod,
  type TradingGoal,
  VELOCITY_PERIODS,
} from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { formatIskShort } from "./utils"
import {
  VelocityFilterSidebar,
  type VelocityFilterState,
  DEFAULT_VELOCITY_FILTERS,
} from "./velocity-filter-sidebar"

interface VelocitySubtabProps {
  data: TradingVelocityResponse | null
  loading: boolean
  error: string | null
  period: VelocityPeriod
  onPeriodChange: (period: VelocityPeriod) => void
  onRefresh: () => void
}

const GOAL_STORAGE_KEY = "eve-tracker-trading-goal"
const CHART_HEIGHT_PX = 192 // Fixed chart height in pixels
const MIN_BAR_HEIGHT_PX = 4 // Minimum bar height so zero values are visible

function loadGoal(): TradingGoal | null {
  if (typeof window === "undefined") return null
  const saved = localStorage.getItem(GOAL_STORAGE_KEY)
  if (!saved) return null
  try {
    return JSON.parse(saved)
  } catch {
    return null
  }
}

function saveGoal(goal: TradingGoal | null) {
  if (typeof window === "undefined") return
  if (goal) {
    localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal))
  } else {
    localStorage.removeItem(GOAL_STORAGE_KEY)
  }
}

export function VelocitySubtab({
  data,
  loading,
  error,
  period,
  onPeriodChange,
  onRefresh,
}: VelocitySubtabProps) {
  const [goal, setGoal] = useState<TradingGoal | null>(null)
  const [goalInput, setGoalInput] = useState("")
  const [showGoalInput, setShowGoalInput] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [filters, setFilters] = useState<VelocityFilterState>({
    selectedCategories: new Set(DEFAULT_VELOCITY_FILTERS.selectedCategories),
    profitStatus: DEFAULT_VELOCITY_FILTERS.profitStatus,
    minProfit: DEFAULT_VELOCITY_FILTERS.minProfit,
  })

  // Load goal on mount
  useEffect(() => {
    const savedGoal = loadGoal()
    if (savedGoal) {
      setGoal(savedGoal)
      setGoalInput(String(savedGoal.dailyTarget / 1_000_000_000))
    }
  }, [])

  // Filter top items based on filter state
  const filteredTopItems = useMemo(() => {
    if (!data?.topItems) return []

    return data.topItems.filter((item) => {
      // Category filter
      const categoryName = item.categoryName || "Unknown"
      if (!filters.selectedCategories.has(categoryName)) {
        return false
      }

      // Profit status filter
      if (filters.profitStatus === "profitable" && item.totalProfit <= 0) {
        return false
      }
      if (filters.profitStatus === "loss" && item.totalProfit >= 0) {
        return false
      }

      // Min profit filter
      if (filters.minProfit !== null && item.totalProfit < filters.minProfit) {
        return false
      }

      return true
    })
  }, [data?.topItems, filters])

  // Calculate goal progress
  const goalProgress = useMemo(() => {
    if (!goal || !data) return null
    const avgProfitPerDay = data.summary.avgProfitPerDay
    const percentage = (avgProfitPerDay / goal.dailyTarget) * 100
    return {
      percentage: Math.min(percentage, 100),
      isAchieved: avgProfitPerDay >= goal.dailyTarget,
      current: avgProfitPerDay,
      target: goal.dailyTarget,
    }
  }, [goal, data])

  // Handle goal setting
  const handleSetGoal = () => {
    const value = parseFloat(goalInput)
    if (isNaN(value) || value <= 0) return

    const newGoal: TradingGoal = {
      dailyTarget: value * 1_000_000_000, // Convert B to ISK
      setAt: new Date().toISOString(),
      notificationsEnabled: false,
    }
    setGoal(newGoal)
    saveGoal(newGoal)
    setShowGoalInput(false)
  }

  const handleRemoveGoal = () => {
    setGoal(null)
    saveGoal(null)
    setGoalInput("")
  }

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

  // Trend icon and color
  const getTrendDisplay = (direction: 'up' | 'down' | 'stable', percentChange: number) => {
    if (direction === 'up') {
      return {
        icon: <TrendingUp className="size-4" />,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        label: `+${percentChange.toFixed(1)}%`
      }
    } else if (direction === 'down') {
      return {
        icon: <TrendingDown className="size-4" />,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        label: `${percentChange.toFixed(1)}%`
      }
    }
    return {
      icon: <Minus className="size-4" />,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      label: "Stable"
    }
  }

  // Format date for display
  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Calculate chart bar heights with absolute pixel values
  const chartData = useMemo(() => {
    if (!data?.dailyProfit.length) return []
    const maxProfit = Math.max(...data.dailyProfit.map(d => Math.abs(d.profit)), 1)
    return data.dailyProfit.map(d => {
      const heightRatio = Math.abs(d.profit) / maxProfit
      const heightPx = Math.max(heightRatio * CHART_HEIGHT_PX, MIN_BAR_HEIGHT_PX)
      return {
        ...d,
        heightPx,
        isPositive: d.profit >= 0,
      }
    })
  }, [data?.dailyProfit])

  // Calculate goal line position in pixels
  const goalLinePosition = useMemo(() => {
    if (!goal || !chartData.length) return null
    const maxProfit = Math.max(...chartData.map(d => Math.abs(d.profit)), 1)
    const goalRatio = Math.min(goal.dailyTarget / maxProfit, 1)
    return goalRatio * CHART_HEIGHT_PX
  }, [goal, chartData])

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-5" />
                ISK Velocity
              </CardTitle>
              <CardDescription>
                Track your daily trading profit and performance trends
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Period Tabs */}
              <Tabs value={period} onValueChange={(v) => onPeriodChange(v as VelocityPeriod)}>
                <TabsList>
                  {VELOCITY_PERIODS.map(p => (
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

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Data Display */}
      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Avg ISK/Day */}
            <Card className={data.trend.direction === 'up' ? "border-emerald-500/50" : data.trend.direction === 'down' ? "border-red-500/50" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${getTrendDisplay(data.trend.direction, data.trend.percentChange).bgColor}`}>
                    {getTrendDisplay(data.trend.direction, data.trend.percentChange).icon}
                  </div>
                  <div className="flex-1">
                    <p className={`text-2xl font-bold ${data.summary.avgProfitPerDay >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {formatIskShort(data.summary.avgProfitPerDay)}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg ISK/Day</p>
                  </div>
                  <Badge className={getTrendDisplay(data.trend.direction, data.trend.percentChange).color}>
                    {getTrendDisplay(data.trend.direction, data.trend.percentChange).label}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Best Day */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <Trophy className="size-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">
                      {formatIskShort(data.summary.bestDay.profit)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Best Day {data.summary.bestDay.date && `(${formatDateShort(data.summary.bestDay.date)})`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* This Week vs Last Week */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Calendar className="size-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {formatIskShort(data.trend.recentAvg)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Last 7 Days Avg
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goal Progress */}
            <Card className={goalProgress?.isAchieved ? "border-emerald-500 bg-emerald-500/5" : ""}>
              <CardContent className="pt-6">
                {goal && goalProgress ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className={`size-5 ${goalProgress.isAchieved ? "text-emerald-500" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium">
                          {goalProgress.isAchieved ? "Goal Achieved!" : "Daily Goal"}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleRemoveGoal}>
                        Clear
                      </Button>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${goalProgress.isAchieved ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${goalProgress.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatIskShort(goalProgress.current)}</span>
                      <span>{formatIskShort(goalProgress.target)}/day</span>
                    </div>
                    {goalProgress.isAchieved && (
                      <div className="flex items-center justify-center gap-1 text-emerald-500 text-sm font-medium">
                        <Star className="size-4 fill-current" />
                        Congratulations!
                      </div>
                    )}
                  </div>
                ) : showGoalInput ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Set Daily Goal (Billions ISK)</p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="1.0"
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        className="flex-1"
                        step="0.1"
                        min="0"
                      />
                      <Button size="sm" onClick={handleSetGoal}>Set</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowGoalInput(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="size-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">No goal set</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowGoalInput(true)}>
                      Set Goal
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily Profit Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4" />
                Daily Profit
              </CardTitle>
              <CardDescription>
                {data.summary.daysWithData} days with trading activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="relative" style={{ height: `${CHART_HEIGHT_PX}px` }}>
                  {/* Chart bars */}
                  <div className="absolute inset-0 flex items-end gap-1">
                    {chartData.map((day, i) => (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                        title={`${formatDateShort(day.date)}: ${formatIskShort(day.profit)}`}
                      >
                        <div
                          className={`w-full rounded-t transition-all ${
                            day.isPositive ? "bg-emerald-500 hover:bg-emerald-400" : "bg-red-500 hover:bg-red-400"
                          }`}
                          style={{ height: `${day.heightPx}px` }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Goal line overlay */}
                  {goalLinePosition !== null && (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-dashed border-blue-500 pointer-events-none"
                      style={{ bottom: `${goalLinePosition}px` }}
                    >
                      <span className="absolute right-0 -top-5 text-xs text-blue-500 bg-background px-1">
                        Goal: {formatIskShort(goal!.dailyTarget)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BarChart3 className="size-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No profit data available</p>
                  <p className="text-xs mt-1">Complete sell orders to see your daily profit</p>
                </div>
              )}

              {/* Date labels */}
              {chartData.length > 0 && (
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{formatDateShort(chartData[0].date)}</span>
                  {chartData.length > 2 && (
                    <span>{formatDateShort(chartData[Math.floor(chartData.length / 2)].date)}</span>
                  )}
                  <span>{formatDateShort(chartData[chartData.length - 1].date)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Performers with Filter Sidebar */}
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* Filter Sidebar */}
            <div className="hidden lg:block">
              <VelocityFilterSidebar
                filters={filters}
                onFiltersChange={setFilters}
                totalItems={data.topItems.length}
                filteredCount={filteredTopItems.length}
              />
            </div>

            {/* Top Performers List */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="size-4" />
                      Top Performers
                    </CardTitle>
                    <CardDescription>
                      Items that made you the most ISK in the last {VELOCITY_PERIODS.find(p => p.value === period)?.label.toLowerCase()}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {filteredTopItems.length} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile filter summary */}
                <div className="lg:hidden mb-4">
                  <VelocityFilterSidebar
                    filters={filters}
                    onFiltersChange={setFilters}
                    totalItems={data.topItems.length}
                    filteredCount={filteredTopItems.length}
                  />
                </div>

                {filteredTopItems.length > 0 ? (
                  <div className="space-y-2">
                    {filteredTopItems.map((item, index) => {
                      const isExpanded = expandedItems.has(item.typeId)
                      return (
                        <div
                          key={item.typeId}
                          className={`rounded-lg border transition-colors ${
                            item.totalProfit > 0
                              ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <button
                            onClick={() => toggleExpand(item.typeId)}
                            className="w-full p-3 flex items-center gap-3 text-left"
                          >
                            <span className="text-lg font-bold text-muted-foreground w-6">
                              #{index + 1}
                            </span>
                            <EveItemIcon typeId={item.typeId} size={32} className="size-8 rounded" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.typeName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.orderCount} orders • {item.quantitySold.toLocaleString()} sold
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${item.totalProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                {formatIskShort(item.totalProfit)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatIskShort(item.profitPerDay)}/day
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-border/50">
                              <div className="grid grid-cols-3 gap-4 pt-3 text-sm">
                                <div>
                                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                                  <p className="font-medium">{formatIskShort(item.totalRevenue)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Category</p>
                                  <p className="font-medium">{item.categoryName ?? "Unknown"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Profit/Day</p>
                                  <p className="font-medium">{formatIskShort(item.profitPerDay)}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Trophy className="size-12 mb-3 opacity-50" />
                    <p className="text-sm font-medium">No items match your filters</p>
                    <p className="text-xs mt-1">Try adjusting your filter settings</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trend Analysis Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Trend Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Recent 7-Day Avg</p>
                  <p className={`text-xl font-bold ${data.trend.recentAvg >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatIskShort(data.trend.recentAvg)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Older Period Avg</p>
                  <p className={`text-xl font-bold ${data.trend.olderAvg >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatIskShort(data.trend.olderAvg)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Trend Direction</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${getTrendDisplay(data.trend.direction, data.trend.percentChange).color}`}>
                      {data.trend.direction === 'up' ? 'Improving' : data.trend.direction === 'down' ? 'Declining' : 'Stable'}
                    </span>
                    {getTrendDisplay(data.trend.direction, data.trend.percentChange).icon}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {data.trend.direction === 'up' 
                  ? "Great work! Your trading performance is improving."
                  : data.trend.direction === 'down'
                    ? "Your trading has slowed down. Consider reviewing your strategies."
                    : "Your trading performance is consistent."}
              </p>
            </CardContent>
          </Card>

          {/* Total Stats */}
          <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
            <span>Total Profit: <strong>{formatIskShort(data.summary.totalProfit)}</strong></span>
            <span>Total Revenue: <strong>{formatIskShort(data.summary.totalRevenue)}</strong></span>
            <span>Total Orders: <strong>{data.summary.totalOrders.toLocaleString()}</strong></span>
            <span>Analyzed at: {new Date(data.analyzedAt).toLocaleString()}</span>
          </div>
        </>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
                <Zap className="size-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Track Your Trading Velocity</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &quot;Refresh&quot; to analyze your trading performance and see your ISK/day metrics
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
