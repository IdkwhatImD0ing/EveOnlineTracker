import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateState, getAuthorizationUrl } from '@/lib/eve-sso'
import { config } from '@/lib/config'

export async function GET() {
  const clientId = process.env.EVE_CLIENT_ID
  const callbackUrl = config.callbackUrl

  if (!clientId) {
    return NextResponse.json(
      { error: 'EVE_CLIENT_ID not configured' },
      { status: 500 }
    )
  }

  // Generate state for CSRF protection
  const state = generateState()

  // Store state in a cookie (expires in 10 minutes)
  const cookieStore = await cookies()
  cookieStore.set('eve_sso_state', state, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Build authorization URL with minimal scopes for initial login
  // Users can request full access later via /api/auth/eve/request-full-access
  const scopes: string[] = [
    'publicData',
    'esi-search.search_structures.v1',
    'esi-universe.read_structures.v1',
    'esi-markets.structure_markets.v1',
  ]
  const authUrl = getAuthorizationUrl(clientId, callbackUrl, state, scopes)

  // Redirect to EVE SSO
  return NextResponse.redirect(authUrl)
}

