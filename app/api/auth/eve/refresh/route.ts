import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/eve-sso'

/**
 * POST /api/auth/eve/refresh
 * 
 * Refreshes an EVE SSO access token using a refresh token.
 * 
 * Request Body:
 *   { "refresh_token": "..." }
 * 
 * Returns new token data including a fresh access_token.
 */
export async function POST(request: NextRequest) {
  const clientId = process.env.EVE_CLIENT_ID
  const clientSecret = process.env.EVE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'EVE SSO not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const refreshToken = body.refresh_token

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'refresh_token is required' },
        { status: 400 }
      )
    }

    const tokens = await refreshAccessToken(refreshToken, clientId, clientSecret)

    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    })

  } catch (error) {
    console.error('[Token Refresh] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh token' },
      { status: 401 }
    )
  }
}

