import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens } from '@/lib/eve-sso'
import {
  parseEveJWT,
  findOrCreateUser,
  addAltCharacter,
  setSessionCookie,
  getSessionUserId,
} from '@/lib/auth'

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

    // State format: "random16chars" or "random16chars:add_alt"
    const [storedStateBase, mode] = (storedState || '').split(':')
    const [stateBase] = (state || '').split(':')

    if (!storedStateBase || storedStateBase !== stateBase) {
      return NextResponse.json(
        { error: 'Invalid state parameter - possible CSRF attack' },
        { status: 400 }
      )
    }

    // Clear the state cookie
    cookieStore.delete('eve_sso_state')

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret)

    // Parse character info from JWT
    const characterInfo = parseEveJWT(tokens.access_token)
    if (!characterInfo) {
      return NextResponse.json(
        { error: 'Failed to parse character info from token' },
        { status: 500 }
      )
    }

    const { characterId, characterName } = characterInfo
    const isAddAlt = mode === 'add_alt'

    if (isAddAlt) {
      // Adding an alt to existing user
      const currentUserId = await getSessionUserId()
      if (!currentUserId) {
        return NextResponse.json(
          { error: 'Must be logged in to add an alt' },
          { status: 401 }
        )
      }

      try {
        const character = await addAltCharacter(
          currentUserId,
          characterId,
          characterName,
          tokens.refresh_token,
          tokens.access_token,
          tokens.expires_in
        )

        return NextResponse.json({
          success: true,
          mode: 'add_alt',
          character: {
            character_id: character.character_id,
            character_name: character.character_name,
          },
        })
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to add alt' },
          { status: 400 }
        )
      }
    } else {
      // Normal login flow
      const { user, isNew } = await findOrCreateUser(
        characterId,
        characterName,
        tokens.refresh_token,
        tokens.access_token,
        tokens.expires_in
      )

      // Set session cookie
      await setSessionCookie(user.id)

      return NextResponse.json({
        success: true,
        mode: 'login',
        user: {
          id: user.id,
          main_character_name: user.main_character_name,
          allowed: user.allowed,
        },
        is_new: isNew,
      })
    }
  } catch (error) {
    console.error('Token exchange error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token exchange failed' },
      { status: 500 }
    )
  }
}
