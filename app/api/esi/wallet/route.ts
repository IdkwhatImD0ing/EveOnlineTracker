import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getAllCharacterTokens } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'

const ESI_BASE = 'https://esi.evetech.net'

/**
 * GET /api/esi/wallet
 * 
 * Fetches wallet balances for all characters linked to the authenticated user.
 * Uses session-based authentication.
 * 
 * Returns aggregated wallet data across all characters.
 */
export async function GET(request: NextRequest) {
  // Get authenticated user from session or Authorization header
  const session = await getAuthenticatedUser(request)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated. Login with EVE SSO first.' },
      { status: 401 }
    )
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user_id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  // Get tokens for all characters
  const characterTokens = await getAllCharacterTokens(session.user_id)
  
  if (characterTokens.length === 0) {
    return NextResponse.json(
      { error: 'No characters with valid tokens found' },
      { status: 400 }
    )
  }

  try {
    // Fetch wallet balance for each character
    const walletResults = await Promise.allSettled(
      characterTokens.map(async (token) => {
        const response = await fetch(
          `${ESI_BASE}/characters/${token.character_id}/wallet/`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token.access_token}`,
              'X-Compatibility-Date': '2025-11-06',
            },
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch wallet for ${token.character_name}`)
        }

        const balance: number = await response.json()
        return {
          character_id: token.character_id,
          character_name: token.character_name,
          balance,
          balance_formatted: formatISK(balance),
        }
      })
    )

    // Process results
    const wallets: Array<{
      character_id: number
      character_name: string
      balance: number
      balance_formatted: string
    }> = []
    
    for (const result of walletResults) {
      if (result.status === 'fulfilled') {
        wallets.push(result.value)
      }
    }

    // Calculate total balance
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0)

    return NextResponse.json({
      characters_queried: characterTokens.length,
      characters_successful: wallets.length,
      total_balance: totalBalance,
      total_balance_formatted: formatISK(totalBalance),
      wallets,
    })

  } catch (error) {
    console.error('Wallet fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch wallet' },
      { status: 500 }
    )
  }
}

function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T ISK`
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B ISK`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M ISK`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K ISK`
  }
  return `${value.toFixed(2)} ISK`
}
