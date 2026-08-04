import { NextRequest, NextResponse } from 'next/server'
import { getCachedRegionTypeHistory, computeHistoryArrays } from '@/lib/esi-history'
import { REGION_IDS } from '@/types/market-seeder'

// Regions for market history comparison
const CHART_REGIONS = [
  { id: REGION_IDS.THE_FORGE, name: 'The Forge', shortName: 'Jita', color: '#22d3ee' },
  { id: REGION_IDS.VALE_OF_SILENT, name: 'Vale of the Silent', shortName: 'Vale', color: '#f59e0b' },
  { id: REGION_IDS.DEKLEIN, name: 'Deklein', shortName: 'Deklein', color: '#10b981' },
] as const

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

interface ChartResponse {
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

/**
 * GET /api/market-history/chart
 *
 * Fetch market history data for a single item across multiple regions,
 * directly from ESI (one call per region, cached per item+region).
 *
 * Query Parameters:
 *   - type_id (required): The item type ID
 *   - days (optional): Number of days of history (7, 30, 90, or 'all'). Default: 30
 *     'all' returns everything ESI serves (~13 months).
 *
 * Returns price and volume arrays for Jita, Vale, and Deklein regions.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  // Parse type_id
  const typeIdStr = searchParams.get('type_id')
  if (!typeIdStr) {
    return NextResponse.json(
      { error: 'type_id is required' },
      { status: 400 }
    )
  }

  const typeId = parseInt(typeIdStr, 10)
  if (isNaN(typeId) || typeId <= 0) {
    return NextResponse.json(
      { error: 'type_id must be a positive integer' },
      { status: 400 }
    )
  }

  // Parse days parameter
  const daysParam = searchParams.get('days') || '30'
  let daysBack: number
  let daysResponse: number | 'all'

  if (daysParam === 'all') {
    daysBack = 3650 // No cutoff in practice - ESI serves ~13 months max
    daysResponse = 'all'
  } else {
    daysBack = parseInt(daysParam, 10)
    if (isNaN(daysBack) || ![7, 30, 90].includes(daysBack)) {
      daysBack = 30
    }
    daysResponse = daysBack
  }

  try {
    // Fetch market history for all regions in parallel
    const regionsData = await Promise.all(
      CHART_REGIONS.map(async (region): Promise<RegionData> => {
        const empty: RegionData = {
          regionId: region.id,
          regionName: region.name,
          shortName: region.shortName,
          color: region.color,
          dates: [],
          prices: [],
          volumes: [],
          highs: [],
          lows: [],
          dataPoints: 0,
          meanPrice: 0,
          avgVolume: 0,
        }

        try {
          const entries = await getCachedRegionTypeHistory(region.id, typeId)
          const item = computeHistoryArrays(typeId, entries, daysBack)
          if (!item) return empty

          return {
            ...empty,
            dates: item.dates,
            prices: item.prices,
            volumes: item.volumes,
            highs: item.highs,
            lows: item.lows,
            dataPoints: item.data_points,
            meanPrice: item.mean_price,
            avgVolume: item.avg_volume,
          }
        } catch (error) {
          console.error(`[Market History Chart] Error fetching ${region.shortName}:`, error)
          return empty
        }
      })
    )

    // Get item name from the local SDE dump
    let typeName = `Type ${typeId}`
    try {
      const fs = await import('fs')
      const path = await import('path')
      const invTypesPath = path.join(process.cwd(), 'data', 'inv-types.json')
      if (fs.existsSync(invTypesPath)) {
        const invTypes = JSON.parse(fs.readFileSync(invTypesPath, 'utf-8'))
        if (invTypes[typeId]) {
          typeName = invTypes[typeId].name || typeName
        }
      }
    } catch {
      // Ignore file read errors
    }

    // Build summary
    const jitaRegion = regionsData.find(r => r.regionId === REGION_IDS.THE_FORGE)
    const valeRegion = regionsData.find(r => r.regionId === REGION_IDS.VALE_OF_SILENT)
    const dekleinRegion = regionsData.find(r => r.regionId === REGION_IDS.DEKLEIN)

    const response: ChartResponse = {
      typeId,
      typeName,
      days: daysResponse,
      regions: regionsData,
      summary: {
        jitaLatestPrice: jitaRegion?.prices?.length
          ? jitaRegion.prices[jitaRegion.prices.length - 1]
          : null,
        jitaAvgVolume: jitaRegion?.avgVolume || null,
        valeAvgVolume: valeRegion?.avgVolume || null,
        dekleinAvgVolume: dekleinRegion?.avgVolume || null,
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Market History Chart] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market history' },
      { status: 500 }
    )
  }
}
