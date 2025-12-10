import { NextRequest, NextResponse } from 'next/server'

const ESI_BASE = 'https://esi.evetech.net'

/**
 * GET /api/esi/wallet
 * 
 * Fetches character wallet balance from ESI.
 * 
 * Query Parameters:
 *   - character_id (required): The character ID
 * 
 * Headers:
 *   - Authorization (required): Bearer token from EVE SSO (requires esi-wallet.read_character_wallet.v1 scope)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const characterId = searchParams.get('character_id')
  
  const authHeader = request.headers.get('authorization')

  if (!characterId) {
    return NextResponse.json(
      { error: 'character_id is required' },
      { status: 400 }
    )
  }

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authorization header required. Requires esi-wallet.read_character_wallet.v1 scope.' },
      { status: 401 }
    )
  }

  try {
    const response = await fetch(
      `${ESI_BASE}/characters/${characterId}/wallet/`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'X-Compatibility-Date': '2025-11-06',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `ESI Error: ${response.status}`, details: error },
        { status: response.status }
      )
    }

    const balance: number = await response.json()

    return NextResponse.json({
      character_id: characterId,
      balance,
      balance_formatted: formatISK(balance),
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

