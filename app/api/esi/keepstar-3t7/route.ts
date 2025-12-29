import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken, getSessionWithCharacters } from '@/lib/auth'
import { promises as fs } from 'fs'
import path from 'path'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole } from '@/types/auth'

const ESI_BASE = 'https://esi.evetech.net'

interface SolarSystem {
  id: number
  name: string
  security: number
}

// Cache for solar systems data
let solarSystemsCache: SolarSystem[] | null = null

async function loadSolarSystems(): Promise<SolarSystem[]> {
  if (solarSystemsCache) return solarSystemsCache

  const filePath = path.join(process.cwd(), 'public', 'solar-systems.json')
  const data = await fs.readFile(filePath, 'utf-8')
  solarSystemsCache = JSON.parse(data) as SolarSystem[]
  return solarSystemsCache
}

function findSystemByName(systems: SolarSystem[], name: string): SolarSystem | undefined {
  const lowerName = name.toLowerCase()
  return systems.find(s => s.name.toLowerCase() === lowerName)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const searchTerm = searchParams.get('search') || '3T7'
  const systemName = searchParams.get('system_name') || '3T7-M8'

  // Get session with main character
  const session = await getSessionWithCharacters()

  if (!session || !session.mainCharacter) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user.id, session.user.role)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const characterId = session.mainCharacter.character_id
  const authToken = await getValidAccessToken()

  if (!authToken) {
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 401 }
    )
  }

  // Look up the solar system by name
  let targetSystemId: number
  let targetSystemName: string

  try {
    const solarSystems = await loadSolarSystems()
    const system = findSystemByName(solarSystems, systemName)

    if (!system) {
      return NextResponse.json({
        error: `System "${systemName}" not found`,
        hint: 'Make sure the system name is spelled correctly (e.g., "Jita", "3T7-M8", "1DQ1-A")',
      }, { status: 400 })
    }

    targetSystemId = system.id
    targetSystemName = system.name
  } catch (error) {
    console.error('Failed to load solar systems:', error)
    return NextResponse.json(
      { error: 'Failed to load solar systems data' },
      { status: 500 }
    )
  }

  try {
    // Search for structures containing the search term
    const queryParams = new URLSearchParams({
      categories: 'structure',
      search: searchTerm,
      strict: 'false',
    })

    const searchResponse = await fetch(
      `${ESI_BASE}/characters/${characterId}/search/?${queryParams.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Compatibility-Date': '2025-11-06',
        },
      }
    )

    if (!searchResponse.ok) {
      const error = await searchResponse.text()
      return NextResponse.json(
        { error: `ESI Search Error: ${searchResponse.status}`, details: error },
        { status: searchResponse.status }
      )
    }

    const searchData = await searchResponse.json()
    const structureIds: number[] = searchData.structure || []

    if (structureIds.length === 0) {
      return NextResponse.json({
        error: `No structures found matching "${searchTerm}". Make sure you have docking access.`,
        character_id_used: characterId,
        search_term: searchTerm,
        target_system: targetSystemName,
        structure_id: null,
      })
    }

    // Get details for each structure to find the Keepstar (type_id: 35834)
    const KEEPSTAR_TYPE_ID = 35834

    const structureDetails: Array<{
      structure_id: number
      name?: string
      type_id?: number
      solar_system_id?: number
      error?: string
    }> = []

    let keepstar = null

    for (const structureId of structureIds) {
      try {
        const structureResponse = await fetch(
          `${ESI_BASE}/universe/structures/${structureId}/`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'X-Compatibility-Date': '2025-11-06',
            },
          }
        )

        if (structureResponse.ok) {
          const structureData = await structureResponse.json()

          structureDetails.push({
            structure_id: structureId,
            name: structureData.name,
            type_id: structureData.type_id,
            solar_system_id: structureData.solar_system_id,
          })

          // Check if it's a Keepstar in the target system
          if (structureData.type_id === KEEPSTAR_TYPE_ID && structureData.solar_system_id === targetSystemId) {
            keepstar = {
              structure_id: structureId,
              name: structureData.name,
              type_id: structureData.type_id,
              type_name: 'Keepstar',
              solar_system_id: structureData.solar_system_id,
              solar_system_name: targetSystemName,
              owner_id: structureData.owner_id,
            }
          }
        } else {
          structureDetails.push({
            structure_id: structureId,
            error: `HTTP ${structureResponse.status}`,
          })
        }
      } catch (err) {
        structureDetails.push({
          structure_id: structureId,
          error: err instanceof Error ? err.message : 'Failed to fetch',
        })
      }
    }

    if (keepstar) {
      return NextResponse.json(keepstar)
    }

    // If no Keepstar found, return all structure details for debugging
    return NextResponse.json({
      error: `No Keepstar found in ${targetSystemName}`,
      character_id_used: characterId,
      search_term: searchTerm,
      target_system: targetSystemName,
      target_system_id: targetSystemId,
      hint: `Showing all structures found matching "${searchTerm}". Looking for type_id=${KEEPSTAR_TYPE_ID} in solar_system_id=${targetSystemId}. HTTP 401 means no docking access.`,
      expected: {
        type_id: KEEPSTAR_TYPE_ID,
        solar_system_id: targetSystemId,
      },
      structures_found: structureDetails,
    })

  } catch (error) {
    console.error('Keepstar search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
