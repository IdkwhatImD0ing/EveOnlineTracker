import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, setMainCharacter } from '@/lib/auth'

/**
 * POST /api/characters/[id]/main
 * 
 * Sets the specified character as the user's main character.
 * The [id] parameter is the character_id (EVE character ID).
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getAuthenticatedUser()

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        }

        if (!session.user.allowed) {
            return NextResponse.json(
                { error: 'Account pending approval' },
                { status: 403 }
            )
        }

        const { id } = await params
        const characterId = parseInt(id)

        if (isNaN(characterId)) {
            return NextResponse.json(
                { error: 'Invalid character ID' },
                { status: 400 }
            )
        }

        await setMainCharacter(session.user_id, characterId)

        return NextResponse.json({
            success: true,
            message: 'Main character updated successfully',
        })
    } catch (error) {
        console.error('[Characters] Set main error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to set main character' },
            { status: 400 }
        )
    }
}

