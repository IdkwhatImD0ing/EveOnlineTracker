import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const ESI_BASE = 'https://esi.evetech.net'
const REGION_THE_FORGE = 10000002 // Jita's region

interface ESIMarketHistoryEntry {
  average: number
  date: string
  highest: number
  lowest: number
  order_count: number
  volume: number
}

/**
 * GET /api/esi/market-history-test
 * 
 * Test endpoint to fetch market history for a single item from ESI
 * and store the last 7 days in Supabase.
 * 
 * Query Parameters:
 *   - type_id (optional): The item type ID to fetch history for. Defaults to 34 (Tritanium)
 *   - region_id (optional): The region ID. Defaults to 10000002 (The Forge/Jita)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const typeId = parseInt(searchParams.get('type_id') || '34')
  const regionId = parseInt(searchParams.get('region_id') || String(REGION_THE_FORGE))

  if (isNaN(typeId) || typeId <= 0) {
    return NextResponse.json(
      { error: 'Invalid type_id parameter' },
      { status: 400 }
    )
  }

  try {
    // Step 1: Fetch market history from ESI
    const esiUrl = `${ESI_BASE}/markets/${regionId}/history/?type_id=${typeId}`
    
    const esiResponse = await fetch(esiUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Compatibility-Date': '2025-11-06',
        'User-Agent': 'EveIndustryTracker/1.0'
      }
    })

    if (!esiResponse.ok) {
      const errorText = await esiResponse.text()
      return NextResponse.json(
        { 
          error: `ESI Error: ${esiResponse.status}`, 
          details: errorText,
          url: esiUrl
        },
        { status: esiResponse.status }
      )
    }

    const historyData: ESIMarketHistoryEntry[] = await esiResponse.json()

    // Step 2: Filter to last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    const recentHistory = historyData.filter(entry => entry.date >= sevenDaysAgoStr)

    if (recentHistory.length === 0) {
      return NextResponse.json({
        message: 'No market history in the last 7 days for this item',
        type_id: typeId,
        region_id: regionId,
        total_history_entries: historyData.length,
        oldest_entry: historyData[0]?.date,
        newest_entry: historyData[historyData.length - 1]?.date
      })
    }

    // Step 3: Prepare data for Supabase upsert
    const rows = recentHistory.map(entry => ({
      type_id: typeId,
      date: entry.date,
      average: entry.average,
      highest: entry.highest,
      lowest: entry.lowest,
      order_count: entry.order_count,
      volume: entry.volume,
      region_id: regionId,
      updated_at: new Date().toISOString()
    }))

    // Step 4: Upsert into Supabase
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('market_history')
      .upsert(rows, {
        onConflict: 'type_id,date,region_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      return NextResponse.json(
        { 
          error: 'Supabase upsert failed', 
          details: error.message,
          hint: error.hint,
          code: error.code
        },
        { status: 500 }
      )
    }

    // Step 5: Return success response
    return NextResponse.json({
      success: true,
      type_id: typeId,
      region_id: regionId,
      entries_fetched: historyData.length,
      entries_stored: recentHistory.length,
      date_range: {
        from: recentHistory[0]?.date,
        to: recentHistory[recentHistory.length - 1]?.date
      },
      data: data || rows,
      summary: {
        avg_price: recentHistory.reduce((sum, e) => sum + e.average, 0) / recentHistory.length,
        total_volume: recentHistory.reduce((sum, e) => sum + e.volume, 0),
        total_orders: recentHistory.reduce((sum, e) => sum + e.order_count, 0)
      }
    })

  } catch (error) {
    console.error('Market history test error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch market history' },
      { status: 500 }
    )
  }
}

