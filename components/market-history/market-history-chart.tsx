"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3 } from "lucide-react"

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

interface MarketHistoryChartProps {
  regions: RegionData[]
  typeName: string
  days: number | 'all'
  enabledRegions: Set<number>
  onToggleRegion: (regionId: number) => void
}

const CHART_HEIGHT = 280
const VOLUME_HEIGHT = 80
const PADDING = { top: 20, right: 60, bottom: 30, left: 80 }

function formatPrice(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function MarketHistoryChart({
  regions,
  typeName,
  days,
  enabledRegions,
  onToggleRegion,
}: MarketHistoryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Get enabled regions with data
  const activeRegions = useMemo(() => {
    return regions.filter(r => enabledRegions.has(r.regionId) && r.dataPoints > 0)
  }, [regions, enabledRegions])

  // Merge all dates and create unified x-axis
  const { allDates, priceRange, volumeRange } = useMemo(() => {
    const dateSet = new Set<string>()
    let minPrice = Infinity
    let maxPrice = 0
    let maxVolume = 0

    for (const region of activeRegions) {
      for (const date of region.dates) {
        dateSet.add(date)
      }
      for (const price of region.prices) {
        if (price > 0) {
          minPrice = Math.min(minPrice, price)
          maxPrice = Math.max(maxPrice, price)
        }
      }
      for (const vol of region.volumes) {
        maxVolume = Math.max(maxVolume, vol)
      }
    }

    const sortedDates = Array.from(dateSet).sort()
    
    // Add 10% padding to price range
    const pricePadding = (maxPrice - minPrice) * 0.1
    minPrice = Math.max(0, minPrice - pricePadding)
    maxPrice = maxPrice + pricePadding

    return {
      allDates: sortedDates,
      priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice || 100 },
      volumeRange: { min: 0, max: maxVolume || 100 },
    }
  }, [activeRegions])

  // Create price lookup maps for each region
  const regionDataMaps = useMemo(() => {
    const maps = new Map<number, { priceMap: Map<string, number>; volumeMap: Map<string, number> }>()
    
    for (const region of activeRegions) {
      const priceMap = new Map<string, number>()
      const volumeMap = new Map<string, number>()
      
      region.dates.forEach((date, i) => {
        priceMap.set(date, region.prices[i])
        volumeMap.set(date, region.volumes[i])
      })
      
      maps.set(region.regionId, { priceMap, volumeMap })
    }
    
    return maps
  }, [activeRegions])

  // Chart dimensions
  const width = 800
  const chartWidth = width - PADDING.left - PADDING.right
  const priceChartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom

  // Scale functions
  const xScale = (index: number) => {
    if (allDates.length <= 1) return PADDING.left
    return PADDING.left + (index / (allDates.length - 1)) * chartWidth
  }

  const priceScale = (price: number) => {
    const range = priceRange.max - priceRange.min
    if (range === 0) return PADDING.top + priceChartHeight / 2
    return PADDING.top + priceChartHeight - ((price - priceRange.min) / range) * priceChartHeight
  }

  const volumeScale = (volume: number) => {
    if (volumeRange.max === 0) return 0
    return (volume / volumeRange.max) * (VOLUME_HEIGHT - 10)
  }

  // Generate SVG paths for each region
  const regionPaths = useMemo(() => {
    return activeRegions.map(region => {
      const dataMap = regionDataMaps.get(region.regionId)
      if (!dataMap) return null

      const points: string[] = []
      let lastValidPoint: { x: number; y: number } | null = null

      allDates.forEach((date, i) => {
        const price = dataMap.priceMap.get(date)
        if (price !== undefined && price > 0) {
          const x = xScale(i)
          const y = priceScale(price)
          points.push(`${lastValidPoint ? 'L' : 'M'}${x},${y}`)
          lastValidPoint = { x, y }
        }
      })

      return {
        regionId: region.regionId,
        color: region.color,
        shortName: region.shortName,
        path: points.join(' '),
      }
    }).filter(Boolean)
  }, [activeRegions, allDates, regionDataMaps, xScale, priceScale])

  // Get Y-axis labels
  const yAxisLabels = useMemo(() => {
    const labels: { value: number; y: number }[] = []
    const range = priceRange.max - priceRange.min
    const step = range / 4
    
    for (let i = 0; i <= 4; i++) {
      const value = priceRange.min + step * i
      labels.push({ value, y: priceScale(value) })
    }
    
    return labels
  }, [priceRange, priceScale])

  // Get X-axis labels (show 5-7 dates)
  const xAxisLabels = useMemo(() => {
    if (allDates.length === 0) return []
    
    const labels: { date: string; x: number }[] = []
    const step = Math.max(1, Math.floor(allDates.length / 5))
    
    for (let i = 0; i < allDates.length; i += step) {
      labels.push({ date: allDates[i], x: xScale(i) })
    }
    
    // Always include last date
    if (labels[labels.length - 1]?.date !== allDates[allDates.length - 1]) {
      labels.push({ date: allDates[allDates.length - 1], x: xScale(allDates.length - 1) })
    }
    
    return labels
  }, [allDates, xScale])

  // Hover data
  const hoverData = useMemo(() => {
    if (hoveredIndex === null || !allDates[hoveredIndex]) return null
    
    const date = allDates[hoveredIndex]
    const regionValues = activeRegions.map(region => {
      const dataMap = regionDataMaps.get(region.regionId)
      return {
        shortName: region.shortName,
        color: region.color,
        price: dataMap?.priceMap.get(date) ?? null,
        volume: dataMap?.volumeMap.get(date) ?? null,
      }
    })
    
    return { date, regionValues, x: xScale(hoveredIndex) }
  }, [hoveredIndex, allDates, activeRegions, regionDataMaps, xScale])

  if (allDates.length === 0) {
    return (
      <Card className="bg-[#1a1f2e] border-[#2a3142]">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <BarChart3 className="size-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No market history available</p>
            <p className="text-xs mt-1">Select an item to view price history</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-[#1a1f2e] border-[#2a3142]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base text-gray-200">{typeName} - Price History</CardTitle>
          <div className="flex gap-2">
            {regions.map(region => (
              <button
                key={region.regionId}
                onClick={() => onToggleRegion(region.regionId)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  enabledRegions.has(region.regionId)
                    ? 'ring-1 ring-offset-1 ring-offset-[#1a1f2e]'
                    : 'opacity-40 hover:opacity-60'
                }`}
                style={{
                  backgroundColor: enabledRegions.has(region.regionId) 
                    ? `${region.color}20` 
                    : 'transparent',
                  color: region.color,
                  borderColor: region.color,
                }}
              >
                {region.shortName}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Price Chart */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            className="w-full"
            style={{ maxHeight: `${CHART_HEIGHT}px` }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Grid lines */}
            <g className="text-[#2a3142]">
              {yAxisLabels.map((label, i) => (
                <line
                  key={i}
                  x1={PADDING.left}
                  y1={label.y}
                  x2={width - PADDING.right}
                  y2={label.y}
                  stroke="currentColor"
                  strokeDasharray="2,2"
                />
              ))}
            </g>

            {/* Y-axis labels */}
            <g className="text-gray-500 text-xs">
              {yAxisLabels.map((label, i) => (
                <text
                  key={i}
                  x={PADDING.left - 8}
                  y={label.y + 4}
                  textAnchor="end"
                  fill="currentColor"
                  fontSize="10"
                >
                  {formatPrice(label.value)}
                </text>
              ))}
            </g>

            {/* X-axis labels */}
            <g className="text-gray-500 text-xs">
              {xAxisLabels.map((label, i) => (
                <text
                  key={i}
                  x={label.x}
                  y={CHART_HEIGHT - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="10"
                >
                  {formatDate(label.date)}
                </text>
              ))}
            </g>

            {/* Price lines */}
            {regionPaths.map(path => path && (
              <path
                key={path.regionId}
                d={path.path}
                fill="none"
                stroke={path.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Hover line */}
            {hoverData && (
              <line
                x1={hoverData.x}
                y1={PADDING.top}
                x2={hoverData.x}
                y2={CHART_HEIGHT - PADDING.bottom}
                stroke="#ffffff40"
                strokeWidth="1"
              />
            )}

            {/* Hover points */}
            {hoverData && hoverData.regionValues.map((rv, i) => {
              if (!rv.price) return null
              return (
                <circle
                  key={i}
                  cx={hoverData.x}
                  cy={priceScale(rv.price)}
                  r="4"
                  fill={rv.color}
                  stroke="#1a1f2e"
                  strokeWidth="2"
                />
              )
            })}

            {/* Interactive overlay */}
            {allDates.map((_, i) => (
              <rect
                key={i}
                x={xScale(i) - chartWidth / allDates.length / 2}
                y={PADDING.top}
                width={chartWidth / allDates.length}
                height={priceChartHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
              />
            ))}
          </svg>

          {/* Hover tooltip */}
          {hoverData && (
            <div
              className="absolute top-4 bg-[#252b3d] border border-[#3a4258] rounded-lg p-3 shadow-lg text-sm pointer-events-none z-10"
              style={{
                left: hoverData.x > width / 2 ? hoverData.x - 160 : hoverData.x + 10,
              }}
            >
              <p className="text-gray-400 text-xs mb-2">{formatDate(hoverData.date)}</p>
              {hoverData.regionValues.map((rv, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: rv.color }}
                  />
                  <span className="text-gray-300">{rv.shortName}:</span>
                  <span className="font-medium" style={{ color: rv.color }}>
                    {rv.price ? formatPrice(rv.price) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Volume Chart */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Volume</p>
          <div className="flex items-end gap-[1px]" style={{ height: `${VOLUME_HEIGHT}px` }}>
            {allDates.map((date, i) => {
              const totalVolume = activeRegions.reduce((sum, region) => {
                const dataMap = regionDataMaps.get(region.regionId)
                return sum + (dataMap?.volumeMap.get(date) ?? 0)
              }, 0)
              
              // Stack volumes for each region
              let currentBottom = 0
              
              return (
                <div
                  key={date}
                  className="flex-1 flex flex-col-reverse"
                  style={{ minWidth: '2px' }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {activeRegions.map(region => {
                    const dataMap = regionDataMaps.get(region.regionId)
                    const vol = dataMap?.volumeMap.get(date) ?? 0
                    const height = volumeScale(vol)
                    
                    return (
                      <div
                        key={region.regionId}
                        className="w-full transition-opacity"
                        style={{
                          height: `${height}px`,
                          backgroundColor: region.color,
                          opacity: hoveredIndex === i ? 1 : 0.7,
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
          
          {/* Volume Y-axis label */}
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>0</span>
            <span>{formatVolume(volumeRange.max)}</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#2a3142]">
          {regions.filter(r => enabledRegions.has(r.regionId)).map(region => (
            <div key={region.regionId} className="text-center">
              <p className="text-xs text-gray-500 mb-1">{region.shortName}</p>
              <p className="font-medium" style={{ color: region.color }}>
                {formatPrice(region.meanPrice)}
              </p>
              <p className="text-xs text-gray-500">
                avg • {formatVolume(region.avgVolume)}/day
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

