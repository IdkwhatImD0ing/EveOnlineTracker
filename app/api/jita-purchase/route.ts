/**
 * Jita Purchase Calculator API
 * 
 * Calculates the total cost to purchase items from Jita by walking
 * the sell order book until the required quantity is fulfilled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isApprovedRole } from '@/types/auth'
import invTypes from '@/data/inv-types.json'

// Type the imported JSON
interface InvType {
  name: string
  groupId: number
  volume: number
}

const invTypesData = invTypes as Record<string, InvType>

// ESI constants
const ESI_BASE = 'https://esi.evetech.net/latest'
const REGION_THE_FORGE = 10000002 // Jita's region
const CONCURRENT_REQUESTS = 20

// Build reverse lookup: name (lowercase) -> type_id (cached)
let nameToTypeId: Map<string, number> | null = null

function getNameToTypeIdMap(): Map<string, number> {
  if (nameToTypeId === null) {
    nameToTypeId = new Map()
    for (const [typeId, data] of Object.entries(invTypesData)) {
      nameToTypeId.set(data.name.toLowerCase(), parseInt(typeId, 10))
    }
  }
  return nameToTypeId
}

function resolveTypeId(itemName: string): number | null {
  const lookup = getNameToTypeIdMap()
  return lookup.get(itemName.toLowerCase().trim()) ?? null
}

function getTypeName(typeId: number): string {
  return invTypesData[typeId.toString()]?.name || `Unknown (${typeId})`
}

// ESI Market Order type
interface ESIMarketOrder {
  order_id: number
  type_id: number
  location_id: number
  volume_total: number
  volume_remain: number
  min_volume: number
  price: number
  is_buy_order: boolean
  duration: number
  issued: string
  range: string
}

// Parsed item from input
interface ParsedItem {
  name: string
  quantity: number
  typeId: number | null
}

// Result for a single item
interface ItemPurchaseResult {
  typeId: number
  name: string
  quantityRequested: number
  quantityFulfilled: number
  quantityUnfulfilled: number
  totalCost: number
  avgPrice: number
  lowestPrice: number | null
  highestPricePaid: number | null
  ordersConsumed: number
  status: 'full' | 'partial' | 'unavailable' | 'unknown'
}

// Full response
interface PurchaseCalculationResponse {
  success: boolean
  items: ItemPurchaseResult[]
  summary: {
    totalItems: number
    fullyAvailable: number
    partiallyAvailable: number
    unavailable: number
    unknownItems: number
    grandTotalCost: number
    grandTotalCostFormatted: string
  }
  failures: string[]
  timing: {
    parseMs: number
    fetchMs: number
    totalMs: number
  }
}

/**
 * Parse input text into items with quantities
 * Supports formats:
 * - "Item Name 1000"
 * - "Item Name x1000"
 * - "Item Name\t1000" (tab separated)
 */
function parseItemList(input: string): ParsedItem[] {
  const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const items: ParsedItem[] = []

  for (const line of lines) {
    // Try tab-separated first (EVE inventory export)
    if (line.includes('\t')) {
      const parts = line.split('\t')
      const name = parts[0].trim()
      const quantity = parseInt(parts[1]?.replace(/,/g, ''), 10) || 1
      const typeId = resolveTypeId(name)
      items.push({ name, quantity, typeId })
      continue
    }

    // Try "Item Name x1000" format
    const xMatch = line.match(/^(.+?)\s+x\s*(\d+(?:,\d+)*)$/i)
    if (xMatch) {
      const name = xMatch[1].trim()
      const quantity = parseInt(xMatch[2].replace(/,/g, ''), 10)
      const typeId = resolveTypeId(name)
      items.push({ name, quantity, typeId })
      continue
    }

    // Try "Item Name 1000" format (space + number at end)
    const spaceMatch = line.match(/^(.+?)\s+(\d+(?:,\d+)*)$/)
    if (spaceMatch) {
      const name = spaceMatch[1].trim()
      const quantity = parseInt(spaceMatch[2].replace(/,/g, ''), 10)
      const typeId = resolveTypeId(name)
      items.push({ name, quantity, typeId })
      continue
    }

    // Just item name (quantity = 1)
    const typeId = resolveTypeId(line)
    items.push({ name: line, quantity: 1, typeId })
  }

  return items
}

/**
 * Fetch all sell orders for an item from ESI
 */
async function fetchSellOrders(typeId: number): Promise<ESIMarketOrder[]> {
  const allOrders: ESIMarketOrder[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `${ESI_BASE}/markets/${REGION_THE_FORGE}/orders/?type_id=${typeId}&order_type=sell&page=${page}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EveOnlineTracker/1.0',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return [] // No orders for this item
      }
      console.error(`[Jita Purchase] ESI error for type ${typeId}: ${response.status}`)
      return []
    }

    // Get total pages from header
    const xPages = response.headers.get('X-Pages')
    if (xPages) {
      totalPages = parseInt(xPages, 10)
    }

    const orders: ESIMarketOrder[] = await response.json()
    allOrders.push(...orders)
    page++
  } while (page <= totalPages)

  return allOrders
}

/**
 * Calculate purchase cost by walking the order book
 */
function calculatePurchaseCost(
  orders: ESIMarketOrder[],
  quantity: number
): {
  totalCost: number
  fulfilled: number
  avgPrice: number
  lowestPrice: number | null
  highestPricePaid: number | null
  ordersConsumed: number
} {
  if (orders.length === 0) {
    return {
      totalCost: 0,
      fulfilled: 0,
      avgPrice: 0,
      lowestPrice: null,
      highestPricePaid: null,
      ordersConsumed: 0,
    }
  }

  // Sort by price ascending (cheapest first)
  const sortedOrders = [...orders].sort((a, b) => a.price - b.price)
  
  let remaining = quantity
  let totalCost = 0
  let ordersConsumed = 0
  let lowestPrice = sortedOrders[0].price
  let highestPricePaid: number | null = null

  for (const order of sortedOrders) {
    if (remaining <= 0) break
    
    const take = Math.min(remaining, order.volume_remain)
    totalCost += take * order.price
    remaining -= take
    ordersConsumed++
    highestPricePaid = order.price
  }

  const fulfilled = quantity - remaining
  const avgPrice = fulfilled > 0 ? totalCost / fulfilled : 0

  return {
    totalCost,
    fulfilled,
    avgPrice,
    lowestPrice,
    highestPricePaid,
    ordersConsumed,
  }
}

/**
 * Format ISK value with appropriate suffix
 */
function formatIsk(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T ISK`
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B ISK`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M ISK`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K ISK`
  }
  return `${value.toFixed(2)} ISK`
}

export async function POST(request: NextRequest): Promise<NextResponse<PurchaseCalculationResponse | { error: string }>> {
  const startTime = Date.now()
  
  // Authentication
  const session = await getAuthenticatedUser(request)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  if (!isApprovedRole(session.user.role)) {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
  }
  
  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult) as NextResponse<{ error: string }>
  }
  
  try {
    // Parse input
    const parseStart = Date.now()
    const body = await request.text()
    
    if (!body.trim()) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    const parsedItems = parseItemList(body)
    
    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'No valid items found in input' }, { status: 400 })
    }

    const parseMs = Date.now() - parseStart

    // Track failures (unknown items)
    const failures: string[] = []
    const validItems = parsedItems.filter(item => {
      if (item.typeId === null) {
        failures.push(`Unknown item: ${item.name}`)
        return false
      }
      return true
    })

    // Fetch orders for all valid items
    const fetchStart = Date.now()
    const results: ItemPurchaseResult[] = []
    
    // Add results for unknown items first
    for (const item of parsedItems) {
      if (item.typeId === null) {
        results.push({
          typeId: 0,
          name: item.name,
          quantityRequested: item.quantity,
          quantityFulfilled: 0,
          quantityUnfulfilled: item.quantity,
          totalCost: 0,
          avgPrice: 0,
          lowestPrice: null,
          highestPricePaid: null,
          ordersConsumed: 0,
          status: 'unknown',
        })
      }
    }

    // Process valid items in concurrent batches
    for (let i = 0; i < validItems.length; i += CONCURRENT_REQUESTS) {
      const batch = validItems.slice(i, i + CONCURRENT_REQUESTS)
      
      const batchPromises = batch.map(async (item) => {
        const orders = await fetchSellOrders(item.typeId!)
        const calc = calculatePurchaseCost(orders, item.quantity)
        
        let status: ItemPurchaseResult['status']
        if (calc.fulfilled === 0) {
          status = 'unavailable'
        } else if (calc.fulfilled < item.quantity) {
          status = 'partial'
        } else {
          status = 'full'
        }

        return {
          typeId: item.typeId!,
          name: getTypeName(item.typeId!),
          quantityRequested: item.quantity,
          quantityFulfilled: calc.fulfilled,
          quantityUnfulfilled: item.quantity - calc.fulfilled,
          totalCost: calc.totalCost,
          avgPrice: calc.avgPrice,
          lowestPrice: calc.lowestPrice,
          highestPricePaid: calc.highestPricePaid,
          ordersConsumed: calc.ordersConsumed,
          status,
        } satisfies ItemPurchaseResult
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches to respect rate limits
      if (i + CONCURRENT_REQUESTS < validItems.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    const fetchMs = Date.now() - fetchStart

    // Calculate summary
    const grandTotalCost = results.reduce((sum, r) => sum + r.totalCost, 0)
    const fullyAvailable = results.filter(r => r.status === 'full').length
    const partiallyAvailable = results.filter(r => r.status === 'partial').length
    const unavailable = results.filter(r => r.status === 'unavailable').length
    const unknownItems = results.filter(r => r.status === 'unknown').length

    const response: PurchaseCalculationResponse = {
      success: true,
      items: results,
      summary: {
        totalItems: results.length,
        fullyAvailable,
        partiallyAvailable,
        unavailable,
        unknownItems,
        grandTotalCost,
        grandTotalCostFormatted: formatIsk(grandTotalCost),
      },
      failures,
      timing: {
        parseMs,
        fetchMs,
        totalMs: Date.now() - startTime,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Jita Purchase] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

