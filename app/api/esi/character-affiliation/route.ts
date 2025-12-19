import { NextRequest, NextResponse } from 'next/server'

const ESI_BASE = 'https://esi.evetech.net/latest'

interface CharacterPublicInfo {
  corporation_id: number
  name: string
  alliance_id?: number
}

interface CorporationPublicInfo {
  name: string
  ticker: string
  alliance_id?: number
}

interface AlliancePublicInfo {
  name: string
  ticker: string
}

interface AffiliationResponse {
  character_id: number
  character_name: string
  corporation_id: number
  corporation_name: string
  corporation_ticker: string
  alliance_id: number | null
  alliance_name: string | null
  alliance_ticker: string | null
}

// Simple in-memory cache to avoid hitting ESI too often
// Keys: `char:{id}`, `corp:{id}`, `alliance:{id}`
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) {
    return entry.data as T
  }
  cache.delete(key)
  return null
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

/**
 * GET /api/esi/character-affiliation
 * 
 * Fetches public affiliation info (corporation, alliance) for a character.
 * This uses public ESI endpoints that don't require authentication.
 * 
 * Query Parameters:
 *   - character_id: number (required) - The character ID to look up
 * 
 * Returns corporation and alliance information for the character.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const characterIdParam = searchParams.get('character_id')

  if (!characterIdParam) {
    return NextResponse.json(
      { error: 'character_id is required' },
      { status: 400 }
    )
  }

  const characterId = parseInt(characterIdParam)
  if (isNaN(characterId)) {
    return NextResponse.json(
      { error: 'character_id must be a valid number' },
      { status: 400 }
    )
  }

  try {
    // Fetch character public info (includes corporation_id)
    const charCacheKey = `char:${characterId}`
    let charInfo = getCached<CharacterPublicInfo>(charCacheKey)
    
    if (!charInfo) {
      const charResponse = await fetch(
        `${ESI_BASE}/characters/${characterId}/`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EveIndustryTracker/1.0',
          },
        }
      )

      if (!charResponse.ok) {
        if (charResponse.status === 404) {
          return NextResponse.json(
            { error: 'Character not found' },
            { status: 404 }
          )
        }
        throw new Error(`ESI character lookup failed: ${charResponse.status}`)
      }

      charInfo = await charResponse.json()
      setCache(charCacheKey, charInfo)
    }

    const corporationId = charInfo!.corporation_id

    // Fetch corporation public info
    const corpCacheKey = `corp:${corporationId}`
    let corpInfo = getCached<CorporationPublicInfo>(corpCacheKey)
    
    if (!corpInfo) {
      const corpResponse = await fetch(
        `${ESI_BASE}/corporations/${corporationId}/`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EveIndustryTracker/1.0',
          },
        }
      )

      if (!corpResponse.ok) {
        throw new Error(`ESI corporation lookup failed: ${corpResponse.status}`)
      }

      corpInfo = await corpResponse.json()
      setCache(corpCacheKey, corpInfo)
    }

    // Build response
    const response: AffiliationResponse = {
      character_id: characterId,
      character_name: charInfo!.name,
      corporation_id: corporationId,
      corporation_name: corpInfo!.name,
      corporation_ticker: corpInfo!.ticker,
      alliance_id: null,
      alliance_name: null,
      alliance_ticker: null,
    }

    // Fetch alliance info if the corporation is in an alliance
    const allianceId = corpInfo!.alliance_id
    if (allianceId) {
      const allianceCacheKey = `alliance:${allianceId}`
      let allianceInfo = getCached<AlliancePublicInfo>(allianceCacheKey)
      
      if (!allianceInfo) {
        const allianceResponse = await fetch(
          `${ESI_BASE}/alliances/${allianceId}/`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'EveIndustryTracker/1.0',
            },
          }
        )

        if (allianceResponse.ok) {
          allianceInfo = await allianceResponse.json()
          setCache(allianceCacheKey, allianceInfo)
        }
      }

      if (allianceInfo) {
        response.alliance_id = allianceId
        response.alliance_name = allianceInfo.name
        response.alliance_ticker = allianceInfo.ticker
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Character Affiliation] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character affiliation' },
      { status: 500 }
    )
  }
}

