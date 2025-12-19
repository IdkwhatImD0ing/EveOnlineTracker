import { NextResponse } from 'next/server'
import { getAuthenticatedUser, removeCharacter } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/characters
 * 
 * Returns all characters linked to the current user.
 */
export async function GET() {
    try {
        const session = await getAuthenticatedUser()

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        }

        if (session.user.role === 'public') {
            return NextResponse.json(
                { error: 'Account pending approval' },
                { status: 403 }
            )
        }

        // Rate limiting
        const rateLimitResult = await checkRateLimit(session.user_id)
        if (!rateLimitResult.success) {
            return createRateLimitResponse(rateLimitResult)
        }

        return NextResponse.json({
            characters: session.characters.map(c => ({
                id: c.id,
                character_id: c.character_id,
                character_name: c.character_name,
                is_main: c.is_main,
                created_at: c.created_at,
            })),
        })
    } catch (error) {
        console.error('[Characters] Error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch characters' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/characters
 * 
 * Removes a character from the user's account.
 * Body: { character_id: number }
 */
export async function DELETE(request: Request) {
    try {
        const session = await getAuthenticatedUser()

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        }

        if (session.user.role === 'public') {
            return NextResponse.json(
                { error: 'Account pending approval' },
                { status: 403 }
            )
        }

        // Rate limiting
        const rateLimitResult = await checkRateLimit(session.user_id)
        if (!rateLimitResult.success) {
            return createRateLimitResponse(rateLimitResult)
        }

        const body = await request.json()
        const { character_id } = body

        if (!character_id) {
            return NextResponse.json(
                { error: 'character_id is required' },
                { status: 400 }
            )
        }

        await removeCharacter(session.user_id, character_id)

        return NextResponse.json({
            success: true,
            message: 'Character removed successfully',
        })
    } catch (error) {
        console.error('[Characters] Delete error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to remove character' },
            { status: 400 }
        )
    }
}

