import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isApprovedRole } from '@/types/auth'

const ESI_BASE = 'https://esi.evetech.net/latest'

interface CharacterDetails {
  character_id: number
  character_name: string
  // Wallet
  wallet_balance: number | null
  wallet_balance_formatted: string | null
  // Skills
  total_sp: number | null
  total_sp_formatted: string | null
  unallocated_sp: number | null
  // Skill Queue
  current_training: {
    skill_name: string
    finish_date: string
    time_remaining: string
  } | null
  // Online status
  online: boolean | null
  last_login: string | null
  last_logout: string | null
  // Location
  solar_system_id: number | null
  solar_system_name: string | null
  // Corporation/Alliance
  corporation_id: number | null
  corporation_name: string | null
  alliance_id: number | null
  alliance_name: string | null
  // Error handling
  requires_full_access: boolean
  errors: string[]
}

/**
 * GET /api/characters/details
 * 
 * Fetches detailed ESI information for all characters linked to the authenticated user.
 * Includes wallet, skills, training, online status, location, and corp/alliance info.
 */
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedUser(request)

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }

  if (!isApprovedRole(session.user.role)) {
    return NextResponse.json(
      { error: 'Account pending approval' },
      { status: 403 }
    )
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  // Get tokens for all characters
  const characterTokens = await getAllCharacterTokens(session.user_id)

  // Build a map of character_id to scope_level from session
  const scopeLevelMap = new Map<number, string>()
  for (const char of session.characters) {
    scopeLevelMap.set(char.character_id, char.scope_level)
  }

  try {
    // Fetch details for each character in parallel
    const detailsPromises = characterTokens.map(async (token): Promise<CharacterDetails> => {
      const scopeLevel = scopeLevelMap.get(token.character_id) || 'minimal'
      const isFullAccess = scopeLevel === 'full'
      const errors: string[] = []

      // Initialize result
      const result: CharacterDetails = {
        character_id: token.character_id,
        character_name: token.character_name,
        wallet_balance: null,
        wallet_balance_formatted: null,
        total_sp: null,
        total_sp_formatted: null,
        unallocated_sp: null,
        current_training: null,
        online: null,
        last_login: null,
        last_logout: null,
        solar_system_id: null,
        solar_system_name: null,
        corporation_id: null,
        corporation_name: null,
        alliance_id: null,
        alliance_name: null,
        requires_full_access: !isFullAccess,
        errors: [],
      }

      // Fetch public character info (no auth needed)
      try {
        const charInfoResponse = await fetch(
          `${ESI_BASE}/characters/${token.character_id}/`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'EveOnlineTracker/1.0',
            },
          }
        )
        if (charInfoResponse.ok) {
          const charInfo = await charInfoResponse.json()
          result.corporation_id = charInfo.corporation_id

          // Fetch corporation name
          if (charInfo.corporation_id) {
            const corpResponse = await fetch(
              `${ESI_BASE}/corporations/${charInfo.corporation_id}/`,
              {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'EveOnlineTracker/1.0',
                },
              }
            )
            if (corpResponse.ok) {
              const corpInfo = await corpResponse.json()
              result.corporation_name = corpInfo.name
              result.alliance_id = corpInfo.alliance_id || null

              // Fetch alliance name if exists
              if (corpInfo.alliance_id) {
                const allianceResponse = await fetch(
                  `${ESI_BASE}/alliances/${corpInfo.alliance_id}/`,
                  {
                    headers: {
                      'Accept': 'application/json',
                      'User-Agent': 'EveOnlineTracker/1.0',
                    },
                  }
                )
                if (allianceResponse.ok) {
                  const allianceInfo = await allianceResponse.json()
                  result.alliance_name = allianceInfo.name
                }
              }
            }
          }
        }
      } catch (err) {
        errors.push('Failed to fetch character info')
      }

      // Skip authenticated endpoints if not full access
      if (!isFullAccess) {
        result.errors = errors
        return result
      }

      // Parallel fetch of authenticated data
      const [walletResult, skillsResult, skillqueueResult, onlineResult, locationResult] = await Promise.allSettled([
        // Wallet
        fetch(`${ESI_BASE}/characters/${token.character_id}/wallet/`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token.access_token}`,
            'X-Compatibility-Date': '2025-11-06',
          },
        }),
        // Skills
        fetch(`${ESI_BASE}/characters/${token.character_id}/skills/`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token.access_token}`,
            'X-Compatibility-Date': '2025-11-06',
          },
        }),
        // Skill Queue
        fetch(`${ESI_BASE}/characters/${token.character_id}/skillqueue/`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token.access_token}`,
            'X-Compatibility-Date': '2025-11-06',
          },
        }),
        // Online Status
        fetch(`${ESI_BASE}/characters/${token.character_id}/online/`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token.access_token}`,
            'X-Compatibility-Date': '2025-11-06',
          },
        }),
        // Location
        fetch(`${ESI_BASE}/characters/${token.character_id}/location/`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token.access_token}`,
            'X-Compatibility-Date': '2025-11-06',
          },
        }),
      ])

      // Process wallet
      if (walletResult.status === 'fulfilled' && walletResult.value.ok) {
        const balance = await walletResult.value.json()
        result.wallet_balance = balance
        result.wallet_balance_formatted = formatISK(balance)
      } else {
        errors.push('Failed to fetch wallet')
      }

      // Process skills
      if (skillsResult.status === 'fulfilled' && skillsResult.value.ok) {
        const skills = await skillsResult.value.json()
        result.total_sp = skills.total_sp
        result.total_sp_formatted = formatSP(skills.total_sp)
        result.unallocated_sp = skills.unallocated_sp || 0
      } else {
        errors.push('Failed to fetch skills')
      }

      // Process skill queue
      if (skillqueueResult.status === 'fulfilled' && skillqueueResult.value.ok) {
        const queue: Array<{
          skill_id: number
          finish_date?: string
          start_date?: string
          queue_position: number
        }> = await skillqueueResult.value.json()

        // Find the currently training skill (first in queue with finish_date in future)
        const now = new Date()
        const currentTraining = queue.find(q => 
          q.finish_date && new Date(q.finish_date) > now
        )

        if (currentTraining?.finish_date) {
          // Fetch skill name
          const skillName = await getTypeName(currentTraining.skill_id)
          const finishDate = new Date(currentTraining.finish_date)
          const timeRemaining = formatTimeRemaining(finishDate)

          result.current_training = {
            skill_name: skillName,
            finish_date: currentTraining.finish_date,
            time_remaining: timeRemaining,
          }
        }
      } else {
        errors.push('Failed to fetch skill queue')
      }

      // Process online status
      if (onlineResult.status === 'fulfilled' && onlineResult.value.ok) {
        const onlineData = await onlineResult.value.json()
        result.online = onlineData.online
        result.last_login = onlineData.last_login || null
        result.last_logout = onlineData.last_logout || null
      } else {
        errors.push('Failed to fetch online status')
      }

      // Process location
      if (locationResult.status === 'fulfilled' && locationResult.value.ok) {
        const locationData = await locationResult.value.json()
        result.solar_system_id = locationData.solar_system_id

        // Fetch solar system name
        if (locationData.solar_system_id) {
          const systemName = await getSolarSystemName(locationData.solar_system_id)
          result.solar_system_name = systemName
        }
      } else {
        errors.push('Failed to fetch location')
      }

      result.errors = errors
      return result
    })

    // Also add characters without tokens (couldn't refresh, etc.)
    const charactersWithTokens = new Set(characterTokens.map(t => t.character_id))
    const charactersWithoutTokens = session.characters.filter(
      c => !charactersWithTokens.has(c.character_id)
    )

    const noTokenDetails: CharacterDetails[] = charactersWithoutTokens.map(char => ({
      character_id: char.character_id,
      character_name: char.character_name,
      wallet_balance: null,
      wallet_balance_formatted: null,
      total_sp: null,
      total_sp_formatted: null,
      unallocated_sp: null,
      current_training: null,
      online: null,
      last_login: null,
      last_logout: null,
      solar_system_id: null,
      solar_system_name: null,
      corporation_id: null,
      corporation_name: null,
      alliance_id: null,
      alliance_name: null,
      requires_full_access: char.scope_level !== 'full',
      errors: ['Token refresh failed'],
    }))

    const allDetails = await Promise.all(detailsPromises)
    const combinedDetails = [...allDetails, ...noTokenDetails]

    // Calculate totals
    const totalWallet = combinedDetails.reduce((sum, d) => sum + (d.wallet_balance || 0), 0)
    const totalSP = combinedDetails.reduce((sum, d) => sum + (d.total_sp || 0), 0)

    return NextResponse.json({
      characters: combinedDetails,
      totals: {
        wallet_balance: totalWallet,
        wallet_balance_formatted: formatISK(totalWallet),
        total_sp: totalSP,
        total_sp_formatted: formatSP(totalSP),
      },
    })

  } catch (error) {
    console.error('Character details fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch character details' },
      { status: 500 }
    )
  }
}

function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(2)
}

function formatSP(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B SP`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M SP`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K SP`
  }
  return `${value} SP`
}

function formatTimeRemaining(finishDate: Date): string {
  const now = new Date()
  const diff = finishDate.getTime() - now.getTime()
  
  if (diff <= 0) return 'Done'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

// Cache for type names and solar system names
const typeNameCache = new Map<number, string>()
const solarSystemCache = new Map<number, string>()

async function getTypeName(typeId: number): Promise<string> {
  if (typeNameCache.has(typeId)) {
    return typeNameCache.get(typeId)!
  }

  try {
    const response = await fetch(`${ESI_BASE}/universe/types/${typeId}/`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EveOnlineTracker/1.0',
      },
    })

    if (response.ok) {
      const data = await response.json()
      typeNameCache.set(typeId, data.name)
      return data.name
    }
  } catch {
    // Ignore errors
  }

  return `Type ${typeId}`
}

async function getSolarSystemName(systemId: number): Promise<string> {
  if (solarSystemCache.has(systemId)) {
    return solarSystemCache.get(systemId)!
  }

  try {
    const response = await fetch(`${ESI_BASE}/universe/systems/${systemId}/`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EveOnlineTracker/1.0',
      },
    })

    if (response.ok) {
      const data = await response.json()
      solarSystemCache.set(systemId, data.name)
      return data.name
    }
  } catch {
    // Ignore errors
  }

  return `System ${systemId}`
}

