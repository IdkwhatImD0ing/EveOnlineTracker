"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Activity,
  Repeat,
  Shield,
  BarChart3,
  Info
} from "lucide-react"
import type { MarketOpportunity, SignalBreakdown } from "@/lib/market-analysis"

interface OpportunityTableProps {
  opportunities: MarketOpportunity[]
  isLoading?: boolean
}

type SortKey = 'itemName' | 'currentPrice' | 'avgPrice' | 'potentialGain' | 'dailyVolume' | 'opportunityScore' | 'confidence' | 'weeklyIskPotential'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  key: SortKey
  direction: SortDirection
}

/**
 * Format ISK value with proper formatting
 */
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
  return value.toFixed(2)
}

/**
 * Get tier badge styling
 */
function getTierBadge(tier: 'excellent' | 'good' | 'marginal' | 'skip') {
  switch (tier) {
    case 'excellent':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'good':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'marginal':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'skip':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

/**
 * Get signal score color
 */
function getSignalColor(score: number) {
  if (score >= 15) return 'text-emerald-400'
  if (score >= 5) return 'text-emerald-400/70'
  if (score > -5) return 'text-slate-400'
  if (score > -15) return 'text-amber-400'
  return 'text-red-400'
}

/**
 * Get momentum indicator
 */
function getMomentumIndicator(momentum: number) {
  if (momentum > 0.02) {
    return <TrendingUp className="size-4 text-emerald-400" />
  } else if (momentum < -0.02) {
    return <TrendingDown className="size-4 text-red-400" />
  }
  return <Minus className="size-4 text-slate-400" />
}

/**
 * Signal breakdown mini-display
 */
function SignalMiniDisplay({ signals }: { signals: SignalBreakdown }) {
  return (
    <div className="flex items-center gap-1">
      <div 
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${getSignalColor(signals.cycle.score)}`}
        title={`Cycle: ${signals.cycle.reason}`}
      >
        <Repeat className="size-3" />
        <span>{signals.cycle.score > 0 ? '+' : ''}{signals.cycle.score.toFixed(0)}</span>
      </div>
      <div 
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${getSignalColor(signals.trend.score)}`}
        title={`Trend: ${signals.trend.reason}`}
      >
        <Activity className="size-3" />
        <span>{signals.trend.score > 0 ? '+' : ''}{signals.trend.score.toFixed(0)}</span>
      </div>
      <div 
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${getSignalColor(signals.support.score)}`}
        title={`Support: ${signals.support.reason}`}
      >
        <Shield className="size-3" />
        <span>{signals.support.score > 0 ? '+' : ''}{signals.support.score.toFixed(0)}</span>
      </div>
      <div 
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${getSignalColor(signals.volume.score)}`}
        title={`Volume: ${signals.volume.reason}`}
      >
        <BarChart3 className="size-3" />
        <span>{signals.volume.score > 0 ? '+' : ''}{signals.volume.score.toFixed(0)}</span>
      </div>
    </div>
  )
}

/**
 * Expanded signal details
 */
function SignalDetails({ signals }: { signals: SignalBreakdown }) {
  const signalList = [
    { name: 'Cycle', icon: Repeat, ...signals.cycle },
    { name: 'Trend', icon: Activity, ...signals.trend },
    { name: 'Support', icon: Shield, ...signals.support },
    { name: 'Volume', icon: BarChart3, ...signals.volume },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/30 border-t">
      {signalList.map(signal => (
        <div key={signal.name} className="space-y-1">
          <div className="flex items-center gap-2">
            <signal.icon className={`size-4 ${getSignalColor(signal.score)}`} />
            <span className="text-xs font-medium">{signal.name}</span>
            <span className={`text-sm font-bold ml-auto ${getSignalColor(signal.score)}`}>
              {signal.score > 0 ? '+' : ''}{signal.score.toFixed(0)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-tight">
            {signal.reason}
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Confidence:</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary/60 rounded-full"
                style={{ width: `${signal.confidence * 100}%` }}
              />
            </div>
            <span>{(signal.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function OpportunityTable({ opportunities, isLoading }: OpportunityTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    key: 'opportunityScore', 
    direction: 'desc' 
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [minScore, setMinScore] = useState('')
  const [minGain, setMinGain] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Toggle row expansion
  const toggleExpand = (typeId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }

  // Handle sorting
  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  // Get sort icon
  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="size-3.5 opacity-50" />
    }
    return sortConfig.direction === 'desc' 
      ? <ArrowDown className="size-3.5" />
      : <ArrowUp className="size-3.5" />
  }

  // Filter and sort opportunities
  const filteredAndSorted = useMemo(() => {
    let result = [...opportunities]

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(o => 
        o.itemName.toLowerCase().includes(term) ||
        o.typeId.toString().includes(term)
      )
    }

    // Apply numeric filters
    if (minScore) {
      const min = parseFloat(minScore)
      if (!isNaN(min)) {
        result = result.filter(o => o.opportunityScore >= min)
      }
    }
    if (minGain) {
      const min = parseFloat(minGain)
      if (!isNaN(min)) {
        result = result.filter(o => o.potentialGain >= min)
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortConfig.key) {
        case 'itemName':
          aVal = a.itemName
          bVal = b.itemName
          break
        case 'currentPrice':
          aVal = a.currentPrice
          bVal = b.currentPrice
          break
        case 'avgPrice':
          aVal = a.avgPrice
          bVal = b.avgPrice
          break
        case 'potentialGain':
          aVal = a.potentialGain
          bVal = b.potentialGain
          break
        case 'dailyVolume':
          aVal = a.dailyVolume
          bVal = b.dailyVolume
          break
        case 'weeklyIskPotential':
          aVal = a.weeklyIskPotential ?? 0
          bVal = b.weeklyIskPotential ?? 0
          break
        case 'opportunityScore':
          aVal = a.signals?.totalScore ?? a.opportunityScore
          bVal = b.signals?.totalScore ?? b.opportunityScore
          break
        case 'confidence':
          // Sort by tier: excellent > good > marginal > skip
          const tierOrder = { excellent: 4, good: 3, marginal: 2, skip: 1, high: 4, medium: 3, low: 2 }
          aVal = tierOrder[a.signals?.tier ?? a.confidence] ?? 0
          bVal = tierOrder[b.signals?.tier ?? b.confidence] ?? 0
          break
        default:
          aVal = 0
          bVal = 0
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'desc' 
          ? bVal.localeCompare(aVal) 
          : aVal.localeCompare(bVal)
      }
      
      return 0
    })

    return result
  }, [opportunities, sortConfig, searchTerm, minScore, minGain])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Analyzing market opportunities...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (opportunities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <TrendingUp className="size-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Opportunities Found</h3>
          <p className="text-muted-foreground text-center max-w-md">
            No items currently match the criteria for undervalued opportunities.
            Try adjusting the filters or check back later as market conditions change.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Check if we have signal data
  const hasSignalData = opportunities.some(o => o.signals)

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {filteredAndSorted.length} Opportunities Found
            </CardTitle>
            {hasSignalData && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="size-3" />
                Click rows to see signal breakdown
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="size-4" />
            Filters
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by item name or type ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="space-y-1.5">
                <Label className="text-xs">Min Score</Label>
                <Input
                  type="number"
                  placeholder="e.g., 50"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min Gain %</Label>
                <Input
                  type="number"
                  placeholder="e.g., 10"
                  value={minGain}
                  onChange={(e) => setMinGain(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y bg-muted/30">
                {hasSignalData && <th className="w-8"></th>}
                <th className="px-4 py-3 text-left font-medium">
                  <button 
                    onClick={() => handleSort('itemName')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    Item {getSortIcon('itemName')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <button 
                    onClick={() => handleSort('currentPrice')}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Current {getSortIcon('currentPrice')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <button 
                    onClick={() => handleSort('avgPrice')}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Avg {getSortIcon('avgPrice')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <button 
                    onClick={() => handleSort('potentialGain')}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Gain {getSortIcon('potentialGain')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <button 
                    onClick={() => handleSort('weeklyIskPotential')}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Weekly ISK {getSortIcon('weeklyIskPotential')}
                  </button>
                </th>
                {hasSignalData && (
                  <th className="px-4 py-3 text-center font-medium">
                    Signals
                  </th>
                )}
                <th className="px-4 py-3 text-right font-medium">
                  <button 
                    onClick={() => handleSort('dailyVolume')}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Volume {getSortIcon('dailyVolume')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-medium">Trend</th>
                <th className="px-4 py-3 text-center font-medium">
                  <button 
                    onClick={() => handleSort('confidence')}
                    className="flex items-center gap-1.5 mx-auto hover:text-foreground transition-colors"
                  >
                    Tier {getSortIcon('confidence')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <button 
                    onClick={() => handleSort('opportunityScore')}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Score {getSortIcon('opportunityScore')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((opportunity, index) => {
                const isExpanded = expandedRows.has(opportunity.typeId)
                const tier = opportunity.signals?.tier ?? opportunity.confidence
                const score = opportunity.signals?.totalScore ?? opportunity.opportunityScore

                return (
                  <>
                    <tr 
                      key={opportunity.typeId}
                      onClick={() => hasSignalData && opportunity.signals && toggleExpand(opportunity.typeId)}
                      className={`
                        border-b hover:bg-muted/50 transition-colors
                        ${index < 3 ? 'bg-primary/5' : ''}
                        ${hasSignalData && opportunity.signals ? 'cursor-pointer' : ''}
                        ${isExpanded ? 'bg-muted/30' : ''}
                      `}
                    >
                      {hasSignalData && (
                        <td className="pl-2 pr-0 py-3">
                          {opportunity.signals && (
                            isExpanded 
                              ? <ChevronDown className="size-4 text-muted-foreground" />
                              : <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{opportunity.itemName}</span>
                          <span className="text-xs text-muted-foreground">
                            ID: {opportunity.typeId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatISK(opportunity.currentPrice)} ISK
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatISK(opportunity.avgPrice)} ISK
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="text-emerald-400 font-medium">
                          +{opportunity.potentialGain.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={`font-medium ${
                          (opportunity.weeklyIskPotential ?? 0) >= 1_000_000_000 
                            ? 'text-emerald-400' 
                            : (opportunity.weeklyIskPotential ?? 0) >= 100_000_000 
                              ? 'text-blue-400' 
                              : 'text-muted-foreground'
                        }`}>
                          {formatISK(opportunity.weeklyIskPotential ?? 0)}/w
                        </span>
                      </td>
                      {hasSignalData && (
                        <td className="px-4 py-3">
                          {opportunity.signals ? (
                            <SignalMiniDisplay signals={opportunity.signals} />
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {opportunity.dailyVolume.toLocaleString()}/d
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getMomentumIndicator(opportunity.momentum)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`
                          inline-flex px-2 py-0.5 text-xs font-medium rounded-full border capitalize
                          ${getTierBadge(tier as 'excellent' | 'good' | 'marginal' | 'skip')}
                        `}>
                          {tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`
                          inline-flex items-center justify-center min-w-[3rem] px-2 py-1 text-sm font-bold rounded
                          ${score >= 70 ? 'bg-emerald-500/20 text-emerald-400' : 
                            score >= 40 ? 'bg-blue-500/20 text-blue-400' : 
                            'bg-amber-500/20 text-amber-400'}
                        `}>
                          {score.toFixed(0)}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && opportunity.signals && (
                      <tr key={`${opportunity.typeId}-details`}>
                        <td colSpan={hasSignalData ? 11 : 10} className="p-0">
                          <SignalDetails signals={opportunity.signals} />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
