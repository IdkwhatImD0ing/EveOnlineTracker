import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * GET /api/auth/session
 * 
 * Returns the current user session if authenticated.
 * Used by client-side to check auth state.
 */
export async function GET() {
    try {
        const session = await getAuthenticatedUser()

        if (!session) {
            return NextResponse.json(
                { authenticated: false },
                { status: 200 }
            )
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: session.user.id,
                main_character_id: session.user.main_character_id,
                main_character_name: session.user.main_character_name,
                allowed: session.user.allowed,
            },
            characters: session.characters.map(c => ({
                id: c.id,
                character_id: c.character_id,
                character_name: c.character_name,
                is_main: c.is_main,
            })),
        })
    } catch (error) {
        console.error('[Session] Error:', error)
        return NextResponse.json(
            { authenticated: false, error: 'Failed to get session' },
            { status: 500 }
        )
    }
}

