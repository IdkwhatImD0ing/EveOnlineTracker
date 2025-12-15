import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

/**
 * POST /api/auth/logout
 * 
 * Clears the session cookie and logs the user out.
 */
export async function POST() {
    try {
        await clearSessionCookie()

        return NextResponse.json({
            success: true,
            message: 'Logged out successfully',
        })
    } catch (error) {
        console.error('[Logout] Error:', error)
        return NextResponse.json(
            { error: 'Failed to logout' },
            { status: 500 }
        )
    }
}

