import { NextRequest, NextResponse } from 'next/server'

const ESI_BASE = 'https://esi.evetech.net'

// Common region IDs for quick reference
const REGIONS = {
  THE_FORGE: 10000002,      // Jita
  VALE_OF_THE_SILENT: 10000003,
  DOMAIN: 10000043,         // Amarr
  SINQ_LAISON: 10000032,    // Dodixie
  HEIMATAR: 10000030,       // Rens
  METROPOLIS: 10000042,     // Hek
}

interface ESIMarketHistoryEntry {
  average: number
  date: string
  highest: number
  lowest: number
  order_count: number
  volume: number
}

/**
 * GET /api/esi/market-history-raw
 * 
 * Test endpoint to fetch raw market history for a single item from ESI.
 * Does NOT store to database - pure ESI debugging tool.
 * 
 * Query Parameters:
 *   - type_id (required): The item type ID to fetch history for
 *   - region_id (optional): The region ID. Defaults to 10000002 (The Forge/Jita)
 *   - days (optional): Number of recent days to return. Defaults to 30
 * 
 * Common Region IDs:
 *   - 10000002: The Forge (Jita)
 *   - 10000003: Vale of the Silent
 *   - 10000043: Domain (Amarr)
 *   - 10000032: Sinq Laison (Dodixie)
 *   - 10000030: Heimatar (Rens)
 *   - 10000042: Metropolis (Hek)
 * 
 * Example Subsystem Type IDs:
 *   - 45610: Legion Offensive - Liquid Crystal Magnifiers
 *   - 45611: Legion Propulsion - Chassis Optimization
 *   - 45612: Legion Defensive - Nanobot Injector
 *   - 45613: Legion Core - Augmented Antimatter Reactor
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET for cron job authentication (Vercel Cron uses Authorization: Bearer)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const typeIdParam = searchParams.get('type_id')
  const regionId = parseInt(searchParams.get('region_id') || String(REGIONS.THE_FORGE))
  const days = parseInt(searchParams.get('days') || '30')

  // Validate type_id
  if (!typeIdParam) {
    return NextResponse.json(
      { 
        error: 'type_id is required',
        hint: 'Example: ?type_id=45610&region_id=10000003 for a Legion subsystem in Vale of the Silent',
        common_regions: REGIONS
      },
      { status: 400 }
    )
  }

  const typeId = parseInt(typeIdParam)
  if (isNaN(typeId) || typeId <= 0) {
    return NextResponse.json(
      { error: 'Invalid type_id parameter' },
      { status: 400 }
    )
  }

  if (isNaN(regionId) || regionId <= 0) {
    return NextResponse.json(
      { error: 'Invalid region_id parameter', common_regions: REGIONS },
      { status: 400 }
    )
  }

  const startTime = Date.now()

  try {
    // Fetch market history from ESI
    const esiUrl = `${ESI_BASE}/markets/${regionId}/history/?type_id=${typeId}`
    
    console.log(`[Market History Raw] Fetching: ${esiUrl}`)
    
    const esiResponse = await fetch(esiUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Compatibility-Date': '2025-11-06',
        'User-Agent': 'EveIndustryTracker/1.0'
      }
    })

    const duration = Date.now() - startTime

    // Handle ESI errors
    if (!esiResponse.ok) {
      const errorText = await esiResponse.text()
      
      // 404 is common - means no market data for this item in this region
      if (esiResponse.status === 404) {
        return NextResponse.json({
          success: false,
          message: 'No market history for this item in this region',
          type_id: typeId,
          region_id: regionId,
          esi_status: 404,
          hint: 'This item may not be traded in this region, or has no recent trade history',
          duration_ms: duration
        })
      }
      
      return NextResponse.json(
        { 
          error: `ESI Error: ${esiResponse.status}`, 
          details: errorText,
          url: esiUrl,
          type_id: typeId,
          region_id: regionId,
          duration_ms: duration
        },
        { status: esiResponse.status }
      )
    }

    const historyData: ESIMarketHistoryEntry[] = await esiResponse.json()

    // Filter to recent days
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    const recentHistory = historyData.filter(entry => entry.date >= cutoffDateStr)

    // Sort by date descending (most recent first)
    recentHistory.sort((a, b) => b.date.localeCompare(a.date))

    // Calculate summary stats
    const summary = recentHistory.length > 0 ? {
      avg_price: recentHistory.reduce((sum, e) => sum + e.average, 0) / recentHistory.length,
      min_price: Math.min(...recentHistory.map(e => e.lowest)),
      max_price: Math.max(...recentHistory.map(e => e.highest)),
      total_volume: recentHistory.reduce((sum, e) => sum + e.volume, 0),
      total_orders: recentHistory.reduce((sum, e) => sum + e.order_count, 0),
      avg_daily_volume: Math.round(recentHistory.reduce((sum, e) => sum + e.volume, 0) / recentHistory.length),
      days_with_trades: recentHistory.length
    } : null

    return NextResponse.json({
      success: true,
      type_id: typeId,
      region_id: regionId,
      region_name: getRegionName(regionId),
      esi_url: esiUrl,
      total_entries_from_esi: historyData.length,
      entries_in_date_range: recentHistory.length,
      date_filter: {
        days_requested: days,
        cutoff_date: cutoffDateStr,
        oldest_in_response: recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].date : null,
        newest_in_response: recentHistory.length > 0 ? recentHistory[0].date : null,
      },
      summary,
      data: recentHistory,
      all_esi_data: {
        oldest_date: historyData.length > 0 ? historyData[0].date : null,
        newest_date: historyData.length > 0 ? historyData[historyData.length - 1].date : null,
        total_entries: historyData.length
      },
      duration_ms: duration
    })

  } catch (error) {
    console.error('[Market History Raw] Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch market history',
        type_id: typeId,
        region_id: regionId,
        duration_ms: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

function getRegionName(regionId: number): string {
  const names: Record<number, string> = {
    10000002: 'The Forge (Jita)',
    10000003: 'Vale of the Silent',
    10000043: 'Domain (Amarr)',
    10000032: 'Sinq Laison (Dodixie)',
    10000030: 'Heimatar (Rens)',
    10000042: 'Metropolis (Hek)',
  }
  return names[regionId] || `Region ${regionId}`
}

