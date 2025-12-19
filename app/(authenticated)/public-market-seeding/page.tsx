"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Loader2, 
  Ship, 
  RefreshCw, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  ArrowUpDown
} from "lucide-react"

interface LimitingItem {
  type_id: number
  name: string
  required: number
  available: number
  max_fits: number
}

interface FitAvailability {
  id: string
  ship_type_id: number
  ship_name: string
  fit_name: string
  available_count: number
  status: 'green' | 'orange' | 'red'
  limiting_items: LimitingItem[]
  total_items: number
  items_in_stock: number
}

interface FitsAvailabilityResponse {
  fits: FitAvailability[]
  structure_id: string
  structure_name: string
  total_fits: number
  updated_at: string
}

type StatusFilter = 'all' | 'green' | 'orange' | 'red'
type SortOption = 'availability-asc' | 'availability-desc' | 'ship-asc' | 'ship-desc' | 'fit-asc' | 'stock-pct'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'availability-asc', label: 'Availability (Low → High)' },
  { value: 'availability-desc', label: 'Availability (High → Low)' },
  { value: 'ship-asc', label: 'Ship Name (A → Z)' },
  { value: 'ship-desc', label: 'Ship Name (Z → A)' },
  { value: 'fit-asc', label: 'Fit Name (A → Z)' },
  { value: 'stock-pct', label: 'Stock Percentage' },
]

export default function PublicMarketSeedingPage() {
  const [data, setData] = useState<FitsAvailabilityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFits, setExpandedFits] = useState<Set<string>>(new Set())

  // Filter & Sort state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [shipTypeFilter, setShipTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('availability-asc')

  const fetchAvailability = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/fits-availability')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch fit availability')
      }
      const responseData = await response.json()
      setData(responseData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fit availability')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  const toggleExpanded = (fitId: string) => {
    setExpandedFits(prev => {
      const next = new Set(prev)
      if (next.has(fitId)) {
        next.delete(fitId)
      } else {
        next.add(fitId)
      }
      return next
    })
  }

  // Get unique ship types for filter dropdown
  const shipTypes = useMemo(() => {
    if (!data) return []
    const types = [...new Set(data.fits.map(f => f.ship_name))].sort()
    return types
  }, [data])

  // Filter and sort fits
  const filteredAndSortedFits = useMemo(() => {
    if (!data) return []

    let fits = [...data.fits]

    // Apply status filter
    if (statusFilter !== 'all') {
      fits = fits.filter(f => f.status === statusFilter)
    }

    // Apply ship type filter
    if (shipTypeFilter !== 'all') {
      fits = fits.filter(f => f.ship_name === shipTypeFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      fits = fits.filter(f => 
        f.ship_name.toLowerCase().includes(query) ||
        f.fit_name.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    fits.sort((a, b) => {
      switch (sortBy) {
        case 'availability-asc':
          return a.available_count - b.available_count
        case 'availability-desc':
          return b.available_count - a.available_count
        case 'ship-asc':
          return a.ship_name.localeCompare(b.ship_name)
        case 'ship-desc':
          return b.ship_name.localeCompare(a.ship_name)
        case 'fit-asc':
          return a.fit_name.localeCompare(b.fit_name)
        case 'stock-pct':
          const pctA = a.total_items > 0 ? a.items_in_stock / a.total_items : 0
          const pctB = b.total_items > 0 ? b.items_in_stock / b.total_items : 0
          return pctA - pctB
        default:
          return 0
      }
    })

    return fits
  }, [data, statusFilter, shipTypeFilter, searchQuery, sortBy])

  const getStatusBadge = (status: 'green' | 'orange' | 'red', count: number) => {
    switch (status) {
      case 'green':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1">
            <CheckCircle2 className="size-3.5" />
            <span className="font-semibold">{count}</span> available
          </Badge>
        )
      case 'orange':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1">
            <AlertTriangle className="size-3.5" />
            <span className="font-semibold">{count}</span> available
          </Badge>
        )
      case 'red':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1.5 px-3 py-1 animate-pulse">
            <XCircle className="size-3.5" />
            <span className="font-semibold">{count}</span> available
          </Badge>
        )
    }
  }

  const getStatusBorderClass = (status: 'green' | 'orange' | 'red') => {
    switch (status) {
      case 'green':
        return 'border-l-emerald-500'
      case 'orange':
        return 'border-l-amber-500'
      case 'red':
        return 'border-l-red-500'
    }
  }

  // Calculate summary stats from full data (not filtered)
  const stats = data ? {
    total: data.fits.length,
    green: data.fits.filter(f => f.status === 'green').length,
    orange: data.fits.filter(f => f.status === 'orange').length,
    red: data.fits.filter(f => f.status === 'red').length,
  } : null

  const getStockPercentage = (fit: FitAvailability) => {
    if (fit.total_items === 0) return 0
    return Math.round((fit.items_in_stock / fit.total_items) * 100)
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setShipTypeFilter('all')
    setSearchQuery('')
    setSortBy('availability-asc')
  }

  const hasActiveFilters = statusFilter !== 'all' || shipTypeFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Package className="size-6 text-cyan-400" />
            </div>
            Fit Availability
          </h1>
          <p className="text-muted-foreground mt-1">
            Alliance fit stock levels at 3T7-M8 Keepstar • Minimum 5 fits required
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchAvailability}
          disabled={isLoading}
          className="shrink-0"
        >
          <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4 flex items-center gap-2 text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {stats && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors">
            <CardContent className="p-4 md:p-5">
              <div className="text-xs md:text-sm text-muted-foreground mb-1">Total Fits</div>
              <div className="text-3xl md:text-4xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <button 
            onClick={() => setStatusFilter(statusFilter === 'green' ? 'all' : 'green')}
            className="text-left"
          >
            <Card className={`bg-zinc-900/50 border-l-4 border-l-emerald-500 transition-all hover:bg-emerald-500/10 ${statusFilter === 'green' ? 'ring-2 ring-emerald-500/50' : ''}`}>
              <CardContent className="p-4 md:p-5">
                <div className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  Well Stocked (≥10)
                </div>
                <div className="text-3xl md:text-4xl font-bold text-emerald-400">{stats.green}</div>
              </CardContent>
            </Card>
          </button>
          <button 
            onClick={() => setStatusFilter(statusFilter === 'orange' ? 'all' : 'orange')}
            className="text-left"
          >
            <Card className={`bg-zinc-900/50 border-l-4 border-l-amber-500 transition-all hover:bg-amber-500/10 ${statusFilter === 'orange' ? 'ring-2 ring-amber-500/50' : ''}`}>
              <CardContent className="p-4 md:p-5">
                <div className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="size-3.5 text-amber-400" />
                  Low Stock (5-9)
                </div>
                <div className="text-3xl md:text-4xl font-bold text-amber-400">{stats.orange}</div>
              </CardContent>
            </Card>
          </button>
          <button 
            onClick={() => setStatusFilter(statusFilter === 'red' ? 'all' : 'red')}
            className="text-left"
          >
            <Card className={`bg-zinc-900/50 border-l-4 border-l-red-500 transition-all hover:bg-red-500/10 ${statusFilter === 'red' ? 'ring-2 ring-red-500/50 animate-pulse' : ''}`}>
              <CardContent className="p-4 md:p-5">
                <div className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                  <XCircle className="size-3.5 text-red-400" />
                  Critical (&lt;5)
                </div>
                <div className="text-3xl md:text-4xl font-bold text-red-400">{stats.red}</div>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {/* Fits List */}
      <Card className="bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ship className="size-5" />
                Alliance Fits
              </CardTitle>
              <CardDescription className="mt-1">
                {data ? (
                  <>
                    Last updated: {new Date(data.updated_at).toLocaleString()}
                    {' • '}
                    Market: {data.structure_name}
                  </>
                ) : (
                  'Loading fit availability...'
                )}
              </CardDescription>
            </div>
          </div>

          {/* Filters & Sort */}
          {data && data.fits.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-3 mt-4 pt-4 border-t border-zinc-800">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search fits..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-zinc-800/50 border-zinc-700"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[160px] bg-zinc-800/50 border-zinc-700">
                    <Filter className="size-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="red">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-red-500" />
                        Critical
                      </span>
                    </SelectItem>
                    <SelectItem value="orange">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-amber-500" />
                        Low Stock
                      </span>
                    </SelectItem>
                    <SelectItem value="green">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Well Stocked
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Ship Type Filter */}
                <Select value={shipTypeFilter} onValueChange={setShipTypeFilter}>
                  <SelectTrigger className="w-[180px] bg-zinc-800/50 border-zinc-700">
                    <Ship className="size-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Ship Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ships</SelectItem>
                    {shipTypes.map(ship => (
                      <SelectItem key={ship} value={ship}>{ship}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[200px] bg-zinc-800/50 border-zinc-700">
                    <ArrowUpDown className="size-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Fetching market orders...</p>
              </div>
            </div>
          ) : !data || data.fits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ship className="size-12 mx-auto mb-4 opacity-50" />
              <p>No alliance fits configured</p>
              <p className="text-sm mt-1">Ask an admin to add fits</p>
            </div>
          ) : filteredAndSortedFits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="size-12 mx-auto mb-4 opacity-50" />
              <p>No fits match your filters</p>
              <Button 
                variant="link" 
                onClick={clearFilters}
                className="text-cyan-400 mt-2"
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Results count */}
              <div className="text-sm text-muted-foreground">
                Showing {filteredAndSortedFits.length} of {data.fits.length} fits
              </div>

              {/* Grid of compact cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredAndSortedFits.map(fit => {
                  const isExpanded = expandedFits.has(fit.id)
                  return (
                    <button
                      key={fit.id}
                      onClick={() => toggleExpanded(fit.id)}
                      className={`relative flex flex-col items-center p-3 rounded-lg border-2 ${
                        fit.status === 'green' ? 'border-emerald-500/40 hover:border-emerald-500/60' :
                        fit.status === 'orange' ? 'border-amber-500/40 hover:border-amber-500/60' :
                        'border-red-500/40 hover:border-red-500/60'
                      } bg-zinc-800/50 hover:bg-zinc-800/80 transition-all text-center group`}
                    >
                      <img
                        src={`https://images.evetech.net/types/${fit.ship_type_id}/icon?size=64`}
                        alt={fit.ship_name}
                        className="size-12 rounded ring-1 ring-zinc-700 mb-2"
                      />
                      <div className="font-medium text-sm truncate w-full">{fit.ship_name}</div>
                      <div className="text-xs text-cyan-400 truncate w-full mb-2">{fit.fit_name}</div>
                      {getStatusBadge(fit.status, fit.available_count)}
                      
                      {/* Expand indicator */}
                      <div className={`absolute top-1.5 right-1.5 p-0.5 rounded transition-colors ${isExpanded ? 'bg-zinc-600' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isExpanded ? (
                          <ChevronUp className="size-3 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-3 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Expanded Details Panel (shown below grid when a fit is selected) */}
              {Array.from(expandedFits).map(fitId => {
                const fit = filteredAndSortedFits.find(f => f.id === fitId)
                if (!fit) return null
                const stockPct = getStockPercentage(fit)
                
                return (
                  <div 
                    key={`expanded-${fitId}`}
                    className={`border-2 rounded-lg ${getStatusBorderClass(fit.status).replace('border-l-', 'border-')} bg-zinc-800/30 overflow-hidden`}
                  >
                    <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://images.evetech.net/types/${fit.ship_type_id}/icon?size=64`}
                          alt={fit.ship_name}
                          className="size-10 rounded ring-1 ring-zinc-700"
                        />
                        <div>
                          <div className="font-semibold">{fit.ship_name}</div>
                          <div className="text-sm text-cyan-400">{fit.fit_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Progress bar */}
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                stockPct >= 80 ? 'bg-emerald-500' : 
                                stockPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${stockPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {fit.items_in_stock}/{fit.total_items} items
                          </span>
                        </div>
                        {getStatusBadge(fit.status, fit.available_count)}
                        <button 
                          onClick={() => toggleExpanded(fitId)}
                          className="p-1 rounded hover:bg-zinc-700 transition-colors"
                        >
                          <XCircle className="size-5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-zinc-900/50">
                      <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <AlertCircle className="size-4" />
                        Limiting factors (items with lowest availability):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {fit.limiting_items.map((item, idx) => {
                          const need = Math.max(0, (item.required * 5) - item.available)
                          return (
                            <div 
                              key={`${item.type_id}-${idx}`}
                              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                            >
                              <img
                                src={`https://images.evetech.net/types/${item.type_id}/icon?size=32`}
                                alt={item.name}
                                className="size-8 rounded shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{item.name}</div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className={need > 0 ? 'text-red-400' : 'text-emerald-400'}>
                                    Need: {need}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Stock: {item.available.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`shrink-0 text-xs ${
                                  item.max_fits >= 10 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : item.max_fits >= 5
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                                }`}
                              >
                                {item.max_fits} fits
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                      {fit.limiting_items.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No items to display
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
