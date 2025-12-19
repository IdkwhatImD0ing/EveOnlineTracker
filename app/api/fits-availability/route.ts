import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { createClient } from '@/utils/supabase/server'
import type { AllianceFit, FitItem } from '@/types/fits'

const ESI_BASE = 'https://esi.evetech.net'
const DEFAULT_STRUCTURE_ID = '1051567430261' // 3T7-M8 Keepstar

interface MarketOrder {
  duration: number
  is_buy_order: boolean
  issued: string
  location_id: number
  min_volume: number
  order_id: number
  price: number
  range: string
  type_id: number
  volume_remain: number
  volume_total: number
}

interface FitAvailability {
  id: string
  ship_type_id: number
  ship_name: string
  fit_name: string
  available_count: number
  status: 'green' | 'orange' | 'red'
  limiting_items: {
    type_id: number
    name: string
    required: number
    available: number
    max_fits: number
  }[]
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

/**
 * Determine the availability status based on count
 * - Green: >= 10 (well stocked)
 * - Orange: 5-9 (low stock, minimum met)
 * - Red: < 5 (critical, below minimum of 5)
 */
function getStatus(count: number): 'green' | 'orange' | 'red' {
  if (count >= 10) return 'green'
  if (count >= 5) return 'orange'
  return 'red'
}

/**
 * GET /api/fits-availability
 * 
 * Returns all alliance fits with their market availability at 3T7.
 * Requires slyce role or higher (not public).
 * 
 * Query Parameters:
 *   - structure_id (optional): Structure ID to check. Default: 3T7-M8 Keepstar
 */
export async function GET(request: NextRequest) {
  // Get authenticated user from session
  const session = await getAuthenticatedUser(request)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }
  
  // Check for slyce role or higher (not public)
  if (session.user.role === 'public') {
    return NextResponse.json(
      { error: 'Account pending approval' },
      { status: 403 }
    )
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user_id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const searchParams = request.nextUrl.searchParams
  const structureId = searchParams.get('structure_id') || DEFAULT_STRUCTURE_ID

  try {
    // 1. Fetch all fits from database
    const supabase = createClient()
    const { data: fits, error: fitsError } = await supabase
      .from('alliance_fits')
      .select('id, ship_type_id, ship_name, fit_name, items')
      .order('ship_name', { ascending: true })

    if (fitsError) {
      console.error('[Fits Availability] Failed to fetch fits:', fitsError)
      return NextResponse.json(
        { error: 'Failed to fetch fits' },
        { status: 500 }
      )
    }

    if (!fits || fits.length === 0) {
      return NextResponse.json({
        fits: [],
        structure_id: structureId,
        structure_name: '3T7-M8 Keepstar',
        total_fits: 0,
        updated_at: new Date().toISOString()
      })
    }

    // 2. Extract all unique type_ids from all fits
    const allTypeIds = new Set<number>()
    for (const fit of fits) {
      const items = fit.items as FitItem[]
      for (const item of items) {
        if (item.type_id !== null) {
          allTypeIds.add(item.type_id)
        }
      }
    }
    // Also add ship type IDs
    for (const fit of fits) {
      allTypeIds.add(fit.ship_type_id)
    }

    // 3. Fetch structure sell orders from ESI
    const characterTokens = await getAllCharacterTokens(session.user_id)
    
    if (characterTokens.length === 0) {
      return NextResponse.json(
        { error: 'No characters with valid tokens found' },
        { status: 400 }
      )
    }

    const accessToken = characterTokens[0].access_token

    // Fetch all pages of market orders
    let allOrders: MarketOrder[] = []
    let page = 1
    let totalPages = 1

    do {
      const response = await fetch(
        `${ESI_BASE}/markets/structures/${structureId}/?page=${page}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Compatibility-Date': '2025-11-06',
          },
        }
      )

      if (!response.ok) {
        const error = await response.text()
        console.error('[Fits Availability] ESI Error:', response.status, error)
        return NextResponse.json(
          { error: `ESI Error: ${response.status}`, details: error },
          { status: response.status }
        )
      }

      const xPages = response.headers.get('X-Pages')
      if (xPages) {
        totalPages = parseInt(xPages, 10)
      }

      const orders: MarketOrder[] = await response.json()
      allOrders = allOrders.concat(orders)
      page++
    } while (page <= totalPages)

    // 4. Filter to sell orders only and aggregate by type_id
    const stockByTypeId: Record<number, number> = {}
    
    for (const order of allOrders) {
      if (!order.is_buy_order) {
        // Only count sell orders
        stockByTypeId[order.type_id] = (stockByTypeId[order.type_id] || 0) + order.volume_remain
      }
    }

    // 5. Calculate availability for each fit
    const fitsAvailability: FitAvailability[] = []

    for (const fit of fits) {
      const items = fit.items as FitItem[]
      
      // Group items by type_id and sum quantities (same module appears multiple times)
      const itemRequirements: Record<number, { name: string; quantity: number }> = {}
      
      for (const item of items) {
        if (item.type_id === null) continue
        
        if (!itemRequirements[item.type_id]) {
          itemRequirements[item.type_id] = { name: item.name, quantity: 0 }
        }
        itemRequirements[item.type_id].quantity += item.quantity
      }

      // Also add ship hull requirement
      if (!itemRequirements[fit.ship_type_id]) {
        itemRequirements[fit.ship_type_id] = { name: fit.ship_name, quantity: 1 }
      } else {
        itemRequirements[fit.ship_type_id].quantity += 1
      }

      // Calculate how many complete fits can be made
      let minFits = Infinity
      const limitingItems: FitAvailability['limiting_items'] = []
      let itemsInStock = 0
      const totalItems = Object.keys(itemRequirements).length

      for (const [typeIdStr, req] of Object.entries(itemRequirements)) {
        const typeId = parseInt(typeIdStr)
        const available = stockByTypeId[typeId] || 0
        const maxFitsForItem = Math.floor(available / req.quantity)
        
        if (available > 0) {
          itemsInStock++
        }
        
        // Track this item's contribution to limiting
        limitingItems.push({
          type_id: typeId,
          name: req.name,
          required: req.quantity,
          available: available,
          max_fits: maxFitsForItem
        })

        if (maxFitsForItem < minFits) {
          minFits = maxFitsForItem
        }
      }

      // Sort limiting items by max_fits (lowest first = most limiting)
      limitingItems.sort((a, b) => a.max_fits - b.max_fits)

      // Handle case where there are no items
      if (minFits === Infinity) {
        minFits = 0
      }

      fitsAvailability.push({
        id: fit.id,
        ship_type_id: fit.ship_type_id,
        ship_name: fit.ship_name,
        fit_name: fit.fit_name,
        available_count: minFits,
        status: getStatus(minFits),
        limiting_items: limitingItems.slice(0, 5), // Top 5 limiting items
        total_items: totalItems,
        items_in_stock: itemsInStock
      })
    }

    // Sort by available_count (lowest first to highlight issues)
    fitsAvailability.sort((a, b) => a.available_count - b.available_count)

    const response: FitsAvailabilityResponse = {
      fits: fitsAvailability,
      structure_id: structureId,
      structure_name: structureId === DEFAULT_STRUCTURE_ID ? '3T7-M8 Keepstar' : `Structure ${structureId}`,
      total_fits: fits.length,
      updated_at: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Fits Availability] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate fit availability' },
      { status: 500 }
    )
  }
}

