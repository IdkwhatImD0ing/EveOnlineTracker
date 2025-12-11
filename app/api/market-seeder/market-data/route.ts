/**
 * Market Data API for Stock Depletion Predictor
 * 
 * Returns Jita market history (daily volume), current prices, and item info for specified type IDs.
 * This is a lightweight endpoint for the depletion predictor feature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCachedMarketSeederStatistics, getCachedJitaPrices } from '@/lib/cached-data'
import { REGION_IDS, type TradeableItem } from '@/types/market-seeder'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// Cache for tradeable items (loaded once per server instance)
let tradeableItemsCache: Map<number, TradeableItem> | null = null

/**
 * Load tradeable items from JSONL file into a map keyed by typeId
 */
async function loadTradeableItemsMap(): Promise<Map<number, TradeableItem>> {
  if (tradeableItemsCache) {
    return tradeableItemsCache
  }

  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  const itemsMap = new Map<number, TradeableItem>()

  if (!fs.existsSync(filePath)) {
    console.warn('[Market Data API] Tradeable items file not found, item names will be unavailable')
    return itemsMap
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const item = JSON.parse(line) as TradeableItem
        itemsMap.set(item.typeId, item)
      } catch {
        // Skip invalid lines
      }
    }
  }

  tradeableItemsCache = itemsMap
  console.log(`[Market Data API] Loaded ${itemsMap.size} tradeable items`)
  return itemsMap
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const typeIdsParam = searchParams.get('type_ids')
    
    if (!typeIdsParam) {
      return NextResponse.json(
        { error: 'type_ids parameter is required' },
        { status: 400 }
      )
    }
    
    // Parse type IDs
    const typeIds = typeIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    
    if (typeIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid type IDs provided' },
        { status: 400 }
      )
    }
    
    if (typeIds.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 type IDs allowed' },
        { status: 400 }
      )
    }
    
    // Load tradeable items for name lookup and fetch market data in parallel
    const [tradeableItems, marketHistory, jitaPrices] = await Promise.all([
      loadTradeableItemsMap(),
      getCachedMarketSeederStatistics(typeIds, 30, REGION_IDS.VALE_OF_SILENT),
      getCachedJitaPrices(typeIds)
    ])
    
    // Build response object with item info
    const marketData: Record<number, {
      name: string
      categoryName: string | null
      groupName: string | null
      volume: number | null
      avgDailyVolume: number
      totalVolume30d: number
      avgPrice: number
      jitaSellPrice: number | null
    }> = {}
    
    for (const typeId of typeIds) {
      const item = tradeableItems.get(typeId)
      const history = marketHistory.get(typeId)
      const price = jitaPrices.get(typeId)
      
      marketData[typeId] = {
        name: item?.name || `Unknown (${typeId})`,
        categoryName: item?.categoryName || null,
        groupName: item?.groupName || null,
        volume: item?.volume || null,
        avgDailyVolume: history?.avgDailyVolume || 0,
        totalVolume30d: history?.totalVolume30d || 0,
        avgPrice: history?.avgPrice || 0,
        jitaSellPrice: price?.lowestSellPrice || null
      }
    }
    
    return NextResponse.json({
      success: true,
      data: marketData,
      typeCount: typeIds.length,
      fetchedAt: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('[Market Data API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch market data' },
      { status: 500 }
    )
  }
}

