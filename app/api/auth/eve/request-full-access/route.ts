import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateState, getAuthorizationUrl } from '@/lib/eve-sso'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { config } from '@/lib/config'
import { FULL_ESI_SCOPES } from '@/lib/esi-scopes'

/**
 * GET /api/auth/eve/request-full-access
 * 
 * Initiates OAuth flow to upgrade a user's permissions to full ESI scopes.
 * Must be authenticated to use this endpoint.
 * Updates the existing character's tokens with new scopes.
 */
export async function GET() {
  // Check if user is authenticated
  const session = await getAuthenticatedUser()
  if (!session) {
    return NextResponse.json(
      { error: 'Must be logged in to request full access' },
      { status: 401 }
    )
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(session.user_id)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  const clientId = process.env.EVE_CLIENT_ID
  const callbackUrl = config.callbackUrl

  if (!clientId) {
    return NextResponse.json(
      { error: 'EVE_CLIENT_ID not configured' },
      { status: 500 }
    )
  }

  // Generate state with full_access marker
  const state = generateState() + ':full_access'

  // Store state in a cookie (expires in 10 minutes)
  const cookieStore = await cookies()
  cookieStore.set('eve_sso_state', state, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const authUrl = getAuthorizationUrl(clientId, callbackUrl, state, FULL_ESI_SCOPES)

  // Redirect to EVE SSO
  return NextResponse.redirect(authUrl)
}
