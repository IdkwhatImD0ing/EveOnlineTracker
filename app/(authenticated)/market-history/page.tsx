"use client"

import { useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  LineChart,
  AlertCircle,
  Search,
} from "lucide-react"
import { ItemSearch, type TradeableItem } from "@/components/market/item-search"
import { MarketHistoryChart } from "@/components/market-history"
import { EveItemIcon } from "@/components/eve-item-icon"
import { REGION_IDS } from "@/types/market-seeder"

// Time periods available for chart
const TIME_PERIODS = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "all", label: "All" },
] as const

type TimePeriod = typeof TIME_PERIODS[number]["value"]

interface RegionData {
  regionId: number
  regionName: string
  shortName: string
  color: string
  dates: string[]
  prices: number[]
  volumes: number[]
  highs: number[]
  lows: number[]
  dataPoints: number
  meanPrice: number
  avgVolume: number
}

interface ChartData {
  typeId: number
  typeName: string
  days: number | 'all'
  regions: RegionData[]
  summary: {
    jitaLatestPrice: number | null
    jitaAvgVolume: number | null
    valeAvgVolume: number | null
    dekleinAvgVolume: number | null
  }
}

export default function MarketHistoryPage() {
  // Selected item state
  const [selectedItem, setSelectedItem] = useState<TradeableItem | null>(null)
  
  // Time period
  const [period, setPeriod] = useState<TimePeriod>("30")
  
  // Chart data
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Enabled regions (all enabled by default)
  const [enabledRegions, setEnabledRegions] = useState<Set<number>>(
    new Set([REGION_IDS.THE_FORGE, REGION_IDS.VALE_OF_SILENT, REGION_IDS.DEKLEIN])
  )

  // Fetch chart data
  const fetchChartData = useCallback(async (typeId: number, days: TimePeriod) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/market-history/chart?type_id=${typeId}&days=${days}`)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch market history')
      }
      
      const data: ChartData = await response.json()
      setChartData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setChartData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle item selection
  const handleItemSelect = useCallback((item: TradeableItem) => {
    setSelectedItem(item)
    fetchChartData(item.typeId, period)
  }, [period, fetchChartData])

  // Handle period change
  const handlePeriodChange = useCallback((newPeriod: TimePeriod) => {
    setPeriod(newPeriod)
    if (selectedItem) {
      fetchChartData(selectedItem.typeId, newPeriod)
    }
  }, [selectedItem, fetchChartData])

  // Toggle region visibility
  const handleToggleRegion = useCallback((regionId: number) => {
    setEnabledRegions(prev => {
      const next = new Set(prev)
      if (next.has(regionId)) {
        // Don't allow disabling all regions
        if (next.size > 1) {
          next.delete(regionId)
        }
      } else {
        next.add(regionId)
      }
      return next
    })
  }, [])

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0f1218]">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 md:gap-3 text-gray-100">
              <LineChart className="size-6 md:size-8 text-cyan-400" />
              Market History
            </h1>
            <p className="text-sm md:text-base text-gray-400">
              Compare price history across Jita, Vale, and Deklein
            </p>
          </div>
          
          {/* Time Period Selector */}
          <Tabs value={period} onValueChange={(v) => handlePeriodChange(v as TimePeriod)}>
            <TabsList className="bg-[#1a1f2e] border-[#2a3142]">
              {TIME_PERIODS.map(p => (
                <TabsTrigger
                  key={p.value}
                  value={p.value}
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                >
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </header>

        {/* Search Card */}
        <Card className="bg-[#1a1f2e] border-[#2a3142]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-200">
              <Search className="size-5 text-cyan-400" />
              Search Item
            </CardTitle>
            <CardDescription className="text-gray-400">
              Type at least 2 characters to search for items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xl">
              <ItemSearch
                onSelect={handleItemSelect}
                placeholder="Search for an item (e.g., Damage Control II)"
              />
            </div>
            
            {/* Selected item display */}
            {selectedItem && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-[#252b3d] rounded-lg border border-[#3a4258]">
                <EveItemIcon typeId={selectedItem.typeId} size={32} className="size-10 rounded" />
                <div>
                  <p className="font-medium text-gray-200">{selectedItem.name}</p>
                  <p className="text-sm text-gray-400">
                    {selectedItem.categoryName} • {selectedItem.groupName}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error display */}
        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-900/50">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {loading && (
          <Card className="bg-[#1a1f2e] border-[#2a3142]">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-4">
                <Loader2 className="size-8 animate-spin text-cyan-400" />
                <p className="text-gray-400">Loading market history...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        {!loading && chartData && (
          <MarketHistoryChart
            regions={chartData.regions}
            typeName={chartData.typeName}
            days={chartData.days}
            enabledRegions={enabledRegions}
            onToggleRegion={handleToggleRegion}
          />
        )}

        {/* Empty state */}
        {!loading && !chartData && !error && (
          <Card className="bg-[#1a1f2e] border-[#2a3142] border-dashed">
            <CardContent className="py-16">
              <div className="text-center space-y-4">
                <div className="mx-auto size-16 rounded-full bg-[#252b3d] flex items-center justify-center">
                  <LineChart className="size-8 text-cyan-400/50" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-200">View Market History</h3>
                  <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                    Search for an item above to see its price and volume history across 
                    Jita, Vale of the Silent, and Deklein
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Region legend */}
        {!loading && chartData && (
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-cyan-400" />
              <span className="text-gray-400">Jita (The Forge)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-amber-500" />
              <span className="text-gray-400">Vale of the Silent</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-emerald-500" />
              <span className="text-gray-400">Deklein</span>
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="text-xs text-gray-500 text-center">
          <p>
            Market data is cached and updated daily. Prices shown are the daily average.
          </p>
        </div>
      </div>
    </div>
  )
}

