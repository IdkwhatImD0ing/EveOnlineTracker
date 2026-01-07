import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { REGION_IDS } from '@/types/market-seeder'

// Regions for market history comparison
const CHART_REGIONS = [
  { id: REGION_IDS.THE_FORGE, name: 'The Forge', shortName: 'Jita', color: '#22d3ee' },
  { id: REGION_IDS.VALE_OF_SILENT, name: 'Vale of the Silent', shortName: 'Vale', color: '#f59e0b' },
  { id: REGION_IDS.DEKLEIN, name: 'Deklein', shortName: 'Deklein', color: '#10b981' },
] as const

interface MarketHistoryArrays {
  type_id: number
  item_name: string
  dates: string[]
  prices: number[]
  volumes: number[]
  highs: number[]
  lows: number[]
  data_points: number
  mean_price: number
  std_dev: number
  avg_volume: number
  volatility: number
}

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
 * Fetch market history data for a single item across multiple regions.
 * 
 * Query Parameters:
 *   - type_id (required): The item type ID
 *   - days (optional): Number of days of history (7, 30, 90, or 'all'). Default: 30
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
    daysBack = 365 * 2 // Fetch up to 2 years of history
    daysResponse = 'all'
  } else {
    daysBack = parseInt(daysParam, 10)
    if (isNaN(daysBack) || ![7, 30, 90].includes(daysBack)) {
      daysBack = 30
    }
    daysResponse = daysBack
  }
  
  try {
    const supabase = await createClient()
    
    // Fetch market history for all regions in parallel
    const regionPromises = CHART_REGIONS.map(async (region) => {
      const { data, error } = await supabase.rpc('get_market_history_arrays', {
        p_type_ids: [typeId],
        p_region_id: region.id,
        p_days_back: daysBack
      })
      
      if (error) {
        console.error(`[Market History Chart] Error fetching ${region.shortName}:`, error.message)
        return null
      }
      
      const historyData = data as MarketHistoryArrays[] | null
      if (!historyData || historyData.length === 0) {
        return {
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
        } as RegionData
      }
      
      const item = historyData[0]
      return {
        regionId: region.id,
        regionName: region.name,
        shortName: region.shortName,
        color: region.color,
        dates: item.dates || [],
        prices: item.prices || [],
        volumes: item.volumes?.map(v => Number(v)) || [],
        highs: item.highs || [],
        lows: item.lows || [],
        dataPoints: item.data_points || 0,
        meanPrice: item.mean_price || 0,
        avgVolume: item.avg_volume || 0,
      } as RegionData
    })
    
    const regionsData = await Promise.all(regionPromises)
    const validRegions = regionsData.filter((r): r is RegionData => r !== null)
    
    // Get item name from tradeable items or database
    let typeName = `Type ${typeId}`
    
    // Try to get item name from the first region that has data
    // The RPC doesn't return item_name, so we need to fetch it separately
    const { data: itemData } = await supabase
      .from('market_history')
      .select('type_id')
      .eq('type_id', typeId)
      .limit(1)
    
    // Fallback: try to load from inv-types.json
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
    const jitaRegion = validRegions.find(r => r.regionId === REGION_IDS.THE_FORGE)
    const valeRegion = validRegions.find(r => r.regionId === REGION_IDS.VALE_OF_SILENT)
    const dekleinRegion = validRegions.find(r => r.regionId === REGION_IDS.DEKLEIN)
    
    const response: ChartResponse = {
      typeId,
      typeName,
      days: daysResponse,
      regions: validRegions,
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

