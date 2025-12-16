import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken, getAuthenticatedUser } from '@/lib/auth'

const ESI_BASE = 'https://esi.evetech.net'

/**
 * POST /api/esi/ui/open-market-window
 * 
 * Opens the market details window for a specific item type in the EVE client.
 * Requires the esi-ui.open_window.v1 scope.
 * 
 * Query Parameters:
 * - type_id: The item type ID to open in the market window
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser(request)

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!session.user.allowed) {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }

    const typeId = request.nextUrl.searchParams.get('type_id')

    if (!typeId) {
      return NextResponse.json(
        { error: 'type_id parameter is required' },
        { status: 400 }
      )
    }

    // Get access token from session or Authorization header
    const authToken = await getValidAccessToken(undefined, request)
    
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
      { success: true, type_id: parseInt(typeId) },
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

