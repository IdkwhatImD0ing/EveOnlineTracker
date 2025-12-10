import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const ESI_BASE = 'https://esi.evetech.net/latest'

interface ESIAsset {
  is_blueprint_copy?: boolean
  is_singleton: boolean
  item_id: number
  location_flag: string
  location_id: number
  location_type: string
  quantity: number
  type_id: number
}

interface InvType {
  name: string
  groupId: number
  volume: number
}

interface AggregatedAsset {
  type_id: number
  type_name: string
  total_quantity: number
  locations: number
  is_blueprint_copy?: boolean
}

// Cache for inv-types data
let invTypesCache: Record<string, InvType> | null = null

function loadInvTypes(): Record<string, InvType> {
  if (invTypesCache) return invTypesCache
  
  const filePath = path.join(process.cwd(), 'data', 'inv-types.json')
  if (!fs.existsSync(filePath)) {
    console.warn('inv-types.json not found, type names will be unavailable')
    return {}
  }
  
  invTypesCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return invTypesCache!
}

/**
 * Parse JWT to extract character ID
 */
function getCharacterIdFromToken(token: string): number | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('utf-8')
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    return parseInt(payload.sub.split(':')[2])
  } catch {
    return null
  }
}

/**
 * Fetch a single page of assets from ESI
 */
async function fetchAssetsPage(
  characterId: number,
  accessToken: string,
  page: number
): Promise<{ assets: ESIAsset[]; totalPages: number }> {
  const response = await fetch(
    `${ESI_BASE}/characters/${characterId}/assets/?page=${page}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'X-Compatibility-Date': '2025-11-06',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ESI Error (${response.status}): ${errorText}`)
  }

  const totalPages = parseInt(response.headers.get('X-Pages') || '1')
  const assets = await response.json()

  return { assets, totalPages }
}

// Jita 4-4 station ID
const JITA_STATION_ID = 60003760

/**
 * GET /api/esi/character-assets
 * 
 * Fetches all assets for the authenticated character and aggregates them by type.
 * 
 * Headers:
 *   - Authorization: Bearer <access_token> (required)
 * 
 * Query Parameters:
 *   - include_blueprints: boolean (default: false) - Include blueprint copies
 *   - location_id: number (optional) - Filter to specific location (default: Jita 4-4)
 *   - all_locations: boolean (default: false) - Include all locations (ignores location_id)
 * 
 * Returns aggregated assets with type names and total quantities.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header required. Login with EVE SSO first (requires esi-assets.read_assets.v1 scope).' },
      { status: 401 }
    )
  }

  const accessToken = authHeader.replace('Bearer ', '')
  const characterId = getCharacterIdFromToken(accessToken)

  if (!characterId) {
    return NextResponse.json(
      { error: 'Invalid access token - could not extract character ID' },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const includeBlueprints = searchParams.get('include_blueprints') === 'true'
  const allLocations = searchParams.get('all_locations') === 'true'
  const locationIdParam = searchParams.get('location_id')
  
  // Default to Jita 4-4 unless all_locations is true or a specific location is provided
  const filterLocationId = allLocations ? null : (locationIdParam ? parseInt(locationIdParam) : JITA_STATION_ID)

  try {
    // Fetch first page to get total pages
    const { assets: firstPageAssets, totalPages } = await fetchAssetsPage(characterId, accessToken, 1)
    
    // Fetch remaining pages in parallel
    const allAssets: ESIAsset[] = [...firstPageAssets]
    
    if (totalPages > 1) {
      const pagePromises: Promise<{ assets: ESIAsset[]; totalPages: number }>[] = []
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(fetchAssetsPage(characterId, accessToken, page))
      }
      
      const results = await Promise.all(pagePromises)
      for (const result of results) {
        allAssets.push(...result.assets)
      }
    }

    // Load type names
    const invTypes = loadInvTypes()

    // Find all item_ids that are in the target location (including nested items)
    // An item is "in" a location if:
    // 1. Its location_id matches the target location, OR
    // 2. Its location_id is an item_id of another item that is "in" the target location
    const itemsInLocation = new Set<number>()
    
    if (filterLocationId !== null) {
      // First pass: find items directly in the target location
      for (const asset of allAssets) {
        if (asset.location_id === filterLocationId) {
          itemsInLocation.add(asset.item_id)
        }
      }
      
      // Multiple passes to find nested items (items inside ships/containers)
      // Keep iterating until no new items are found
      let foundNew = true
      while (foundNew) {
        foundNew = false
        for (const asset of allAssets) {
          // If this item's location is another item that's in our target location
          if (!itemsInLocation.has(asset.item_id) && itemsInLocation.has(asset.location_id)) {
            itemsInLocation.add(asset.item_id)
            foundNew = true
          }
        }
      }
    }

    // Aggregate assets by type_id
    const aggregated = new Map<number, AggregatedAsset>()
    const locationsByType = new Map<number, Set<number>>()
    let filteredCount = 0

    for (const asset of allAssets) {
      // Skip blueprint copies unless requested
      if (asset.is_blueprint_copy && !includeBlueprints) {
        continue
      }

      // Filter by location if specified
      if (filterLocationId !== null && !itemsInLocation.has(asset.item_id)) {
        continue
      }
      
      filteredCount++

      const existing = aggregated.get(asset.type_id)
      const typeName = invTypes[asset.type_id.toString()]?.name || `Unknown (${asset.type_id})`

      if (existing) {
        existing.total_quantity += asset.quantity
        locationsByType.get(asset.type_id)!.add(asset.location_id)
      } else {
        aggregated.set(asset.type_id, {
          type_id: asset.type_id,
          type_name: typeName,
          total_quantity: asset.quantity,
          locations: 1,
          is_blueprint_copy: asset.is_blueprint_copy,
        })
        locationsByType.set(asset.type_id, new Set([asset.location_id]))
      }
    }

    // Update location counts
    for (const [typeId, asset] of aggregated) {
      asset.locations = locationsByType.get(typeId)!.size
    }

    // Convert to array and sort by quantity descending
    const assets = Array.from(aggregated.values()).sort((a, b) => b.total_quantity - a.total_quantity)

    return NextResponse.json({
      character_id: characterId,
      total_unique_types: assets.length,
      total_items: allAssets.length,
      filtered_items: filteredCount,
      pages_fetched: totalPages,
      location_filter: filterLocationId,
      location_name: filterLocationId === JITA_STATION_ID ? 'Jita 4-4' : (filterLocationId ? `Location ${filterLocationId}` : 'All locations'),
      assets,
    })

  } catch (error) {
    console.error('[Character Assets] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch character assets' },
      { status: 500 }
    )
  }
}

