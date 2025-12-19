import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateState, getAuthorizationUrl } from '@/lib/eve-sso'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { config } from '@/lib/config'
import { MINIMAL_ESI_SCOPES } from '@/lib/esi-scopes'

/**
 * GET /api/auth/eve/add-alt
 * 
 * Initiates OAuth flow to add an alt character.
 * Must be authenticated and allowed to use this endpoint.
 */
export async function GET() {
    // Check if user is authenticated and allowed
    const session = await getAuthenticatedUser()
    if (!session) {
        return NextResponse.json(
            { error: 'Must be logged in to add an alt' },
            { status: 401 }
        )
    }

    if (session.user.role === 'public') {
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

    const clientId = process.env.EVE_CLIENT_ID
    const callbackUrl = config.callbackUrl

    if (!clientId) {
        return NextResponse.json(
            { error: 'EVE_CLIENT_ID not configured' },
            { status: 500 }
        )
    }

    // Generate state with add_alt marker
    const state = generateState() + ':add_alt'

    // Store state in a cookie (expires in 10 minutes)
    const cookieStore = await cookies()
    cookieStore.set('eve_sso_state', state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
    })

    // Build authorization URL with minimal scopes
    // Alt characters can request full access separately via /api/auth/eve/request-full-access
    const authUrl = getAuthorizationUrl(clientId, callbackUrl, state, MINIMAL_ESI_SCOPES)

    // Redirect to EVE SSO
    return NextResponse.redirect(authUrl)
}

