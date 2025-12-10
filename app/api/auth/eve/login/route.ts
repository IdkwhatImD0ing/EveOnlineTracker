import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateState, getAuthorizationUrl } from '@/lib/eve-sso'

export async function GET() {
  const clientId = process.env.EVE_CLIENT_ID
  const callbackUrl = process.env.EVE_CALLBACK_URL || 'http://localhost:3000/callback'

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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Build authorization URL
  // NOTE: These scopes must also be added to your EVE Developer Application at developers.eveonline.com
  const scopes: string[] = [
    'esi-search.search_structures.v1',     // Required for structure search
    'esi-universe.read_structures.v1',     // Required for reading structure details (type_id, name, etc.)
    'esi-markets.structure_markets.v1',    // Required for fetching market orders from structures
    'esi-assets.read_assets.v1',           // Required for fetching character assets
  ]
  const authUrl = getAuthorizationUrl(clientId, callbackUrl, state, scopes)

  // Redirect to EVE SSO
  return NextResponse.redirect(authUrl)
}

