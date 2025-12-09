import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens } from '@/lib/eve-sso'

export async function POST(request: NextRequest) {
  const clientId = process.env.EVE_CLIENT_ID
  const clientSecret = process.env.EVE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'EVE SSO credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { code, state } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    // Verify state for CSRF protection
    const cookieStore = await cookies()
    const storedState = cookieStore.get('eve_sso_state')?.value

    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { error: 'Invalid state parameter - possible CSRF attack' },
        { status: 400 }
      )
    }

    // Clear the state cookie
    cookieStore.delete('eve_sso_state')

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret)

    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    })
  } catch (error) {
    console.error('Token exchange error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token exchange failed' },
      { status: 500 }
    )
  }
}

