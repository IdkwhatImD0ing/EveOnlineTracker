import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import type { CharacterToken } from '@/types/auth'

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
  characters: string[]  // List of character names that have this item
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

/**
 * Fetch all assets for a single character
 */
async function fetchAllAssetsForCharacter(
  characterToken: CharacterToken,
  filterLocationId: number | null,
  includeBlueprints: boolean
): Promise<{ assets: ESIAsset[]; characterName: string }> {
  const { assets: firstPageAssets, totalPages } = await fetchAssetsPage(
    characterToken.character_id,
    characterToken.access_token,
    1
  )
  
  const allAssets: ESIAsset[] = [...firstPageAssets]
  
  if (totalPages > 1) {
    const pagePromises: Promise<{ assets: ESIAsset[]; totalPages: number }>[] = []
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(fetchAssetsPage(characterToken.character_id, characterToken.access_token, page))
    }
    
    const results = await Promise.all(pagePromises)
    for (const result of results) {
      allAssets.push(...result.assets)
    }
  }

  return { assets: allAssets, characterName: characterToken.character_name }
}

// Jita 4-4 station ID
const JITA_STATION_ID = 60003760

/**
 * GET /api/esi/character-assets
 * 
 * Fetches all assets for all characters linked to the authenticated user and aggregates them by type.
 * 
 * Query Parameters:
 *   - include_blueprints: boolean (default: false) - Include blueprint copies
 *   - location_id: number (optional) - Filter to specific location (default: Jita 4-4)
 *   - all_locations: boolean (default: false) - Include all locations (ignores location_id)
 * 
 * Returns aggregated assets with type names and total quantities across all characters.
 */
export async function GET(request: NextRequest) {
  // Get authenticated user
  const session = await getAuthenticatedUser()
  
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }

  if (!session.user.allowed) {
    return NextResponse.json(
      { error: 'Account pending approval' },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const includeBlueprints = searchParams.get('include_blueprints') === 'true'
  const allLocations = searchParams.get('all_locations') === 'true'
  const locationIdParam = searchParams.get('location_id')
  
  // Default to Jita 4-4 unless all_locations is true or a specific location is provided
  const filterLocationId = allLocations ? null : (locationIdParam ? parseInt(locationIdParam) : JITA_STATION_ID)

  try {
    // Get fresh tokens for all characters
    const characterTokens = await getAllCharacterTokens(session.user_id)

    if (characterTokens.length === 0) {
      return NextResponse.json(
        { error: 'No characters with valid tokens found' },
        { status: 400 }
      )
    }

    // Fetch assets from all characters in parallel
    const assetResults = await Promise.allSettled(
      characterTokens.map(token => 
        fetchAllAssetsForCharacter(token, filterLocationId, includeBlueprints)
      )
    )

    // Load type names
    const invTypes = loadInvTypes()

    // Aggregate assets by type_id across all characters
    const aggregated = new Map<number, AggregatedAsset>()
    const locationsByType = new Map<number, Set<number>>()
    const charactersByType = new Map<number, Set<string>>()
    
    let totalItems = 0
    let filteredItems = 0
    let successfulCharacters = 0
    const failedCharacters: string[] = []

    for (let i = 0; i < assetResults.length; i++) {
      const result = assetResults[i]
      const characterName = characterTokens[i].character_name

      if (result.status === 'rejected') {
        console.error(`[Character Assets] Failed for ${characterName}:`, result.reason)
        failedCharacters.push(characterName)
        continue
      }

      successfulCharacters++
      const { assets: allAssets, characterName: charName } = result.value
      totalItems += allAssets.length

      // Find all item_ids that are in the target location (including nested items)
      const itemsInLocation = new Set<number>()
      
      if (filterLocationId !== null) {
        // First pass: find items directly in the target location
        for (const asset of allAssets) {
          if (asset.location_id === filterLocationId) {
            itemsInLocation.add(asset.item_id)
          }
        }
        
        // Multiple passes to find nested items (items inside ships/containers)
        let foundNew = true
        while (foundNew) {
          foundNew = false
          for (const asset of allAssets) {
            if (!itemsInLocation.has(asset.item_id) && itemsInLocation.has(asset.location_id)) {
              itemsInLocation.add(asset.item_id)
              foundNew = true
            }
          }
        }
      }

      // Aggregate assets
      for (const asset of allAssets) {
        // Skip blueprint copies unless requested
        if (asset.is_blueprint_copy && !includeBlueprints) {
          continue
        }

        // Filter by location if specified
        if (filterLocationId !== null && !itemsInLocation.has(asset.item_id)) {
          continue
        }
        
        filteredItems++

        const existing = aggregated.get(asset.type_id)
        const typeName = invTypes[asset.type_id.toString()]?.name || `Unknown (${asset.type_id})`

        if (existing) {
          existing.total_quantity += asset.quantity
          locationsByType.get(asset.type_id)!.add(asset.location_id)
          charactersByType.get(asset.type_id)!.add(charName)
        } else {
          aggregated.set(asset.type_id, {
            type_id: asset.type_id,
            type_name: typeName,
            total_quantity: asset.quantity,
            locations: 1,
            characters: [charName],
            is_blueprint_copy: asset.is_blueprint_copy,
          })
          locationsByType.set(asset.type_id, new Set([asset.location_id]))
          charactersByType.set(asset.type_id, new Set([charName]))
        }
      }
    }

    // Update location and character counts
    for (const [typeId, asset] of aggregated) {
      asset.locations = locationsByType.get(typeId)!.size
      asset.characters = Array.from(charactersByType.get(typeId)!)
    }

    // Convert to array and sort by quantity descending
    const assets = Array.from(aggregated.values()).sort((a, b) => b.total_quantity - a.total_quantity)

    return NextResponse.json({
      characters_queried: characterTokens.length,
      characters_successful: successfulCharacters,
      characters_failed: failedCharacters,
      total_unique_types: assets.length,
      total_items: totalItems,
      filtered_items: filteredItems,
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
