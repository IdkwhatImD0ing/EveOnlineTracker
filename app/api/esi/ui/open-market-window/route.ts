import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken, getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'

const ESI_BASE = 'https://esi.evetech.net'

/**
 * POST /api/esi/ui/open-market-window
 * 
 * Opens the market details window for a specific item type in the EVE client.
 * Requires the esi-ui.open_window.v1 scope.
 * 
 * Query Parameters:
 * - type_id: The item type ID to open in the market window
 * - character_id (optional): The character ID to open the window for. 
 *   If provided, uses that character's token (opens in their EVE client).
 *   If not provided, uses the main character's token.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser(request)

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user_id)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const typeId = request.nextUrl.searchParams.get('type_id')
    const characterId = request.nextUrl.searchParams.get('character_id')

    if (!typeId) {
      return NextResponse.json(
        { error: 'type_id parameter is required' },
        { status: 400 }
      )
    }

    // Get access token for specific character if provided, otherwise main character
    const authToken = await getValidAccessToken(
      characterId ? parseInt(characterId) : undefined,
      request
    )
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Login with EVE SSO first.' },
        { status: 401 }
      )
    }

    // Call ESI to open the market window
    const esiUrl = `${ESI_BASE}/latest/ui/openwindow/marketdetails/?type_id=${typeId}`
    
    const response = await fetch(esiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Compatibility-Date': '2025-11-06',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`ESI open market window failed: ${response.status} - ${errorText}`)
      
      // Handle specific ESI errors
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Unauthorized - token may be expired or missing esi-ui.open_window.v1 scope' },
          { status: 401 }
        )
      }
      
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Forbidden - missing esi-ui.open_window.v1 scope' },
          { status: 403 }
        )
      }

      if (response.status === 420) {
        return NextResponse.json(
          { error: 'Rate limited - too many UI requests' },
          { status: 420 }
        )
      }

      return NextResponse.json(
        { error: `ESI error: ${response.status}` },
        { status: response.status }
      )
    }

    // ESI returns 204 No Content on success
    return NextResponse.json(
      { 
        success: true, 
        type_id: parseInt(typeId),
        character_id: characterId ? parseInt(characterId) : undefined
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error opening market window:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

