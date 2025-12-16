/**
 * Authentication utilities for multi-account support
 */

import { connection } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { refreshAccessToken } from '@/lib/eve-sso'
import type { User, Character, Session, CharacterToken, EveJWTPayload } from '@/types/auth'

const SESSION_COOKIE_NAME = 'eve_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * Parse EVE SSO JWT to extract character info
 */
export function parseEveJWT(token: string): { characterId: number; characterName: string } | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('utf-8')
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload: EveJWTPayload = JSON.parse(jsonPayload)
    const characterId = parseInt(payload.sub.split(':')[2])
    return {
      characterId,
      characterName: payload.name,
    }
  } catch {
    return null
  }
}

/**
 * Set the session cookie with user_id
 */
export async function setSessionCookie(userId: string): Promise<void> {
  await connection()
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  await connection()
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Get user_id from session cookie
 */
export async function getSessionUserId(): Promise<string | null> {
  await connection()
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)
  return session?.value || null
}

/**
 * Get the authenticated user from session
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<Session | null> {
  const userId = await getSessionUserId()
  if (!userId) return null

  const supabase = await createClient()

  // Fetch user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    // Invalid session, clear it
    await clearSessionCookie()
    return null
  }

  // Fetch all characters for this user
  const { data: characters, error: charactersError } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('is_main', { ascending: false })

  if (charactersError) {
    console.error('[Auth] Failed to fetch characters:', charactersError)
    return null
  }

  return {
    user_id: userId,
    user: user as User,
    characters: (characters || []) as Character[],
  }
}

/**
 * Refresh an access token if expired
 * Returns fresh access token
 */
export async function refreshTokenIfNeeded(character: Character): Promise<string> {
  const now = new Date()
  const expiresAt = character.token_expires_at ? new Date(character.token_expires_at) : null

  // If token is still valid (with 5 minute buffer), return it
  if (character.access_token && expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return character.access_token
  }

  // Need to refresh
  const clientId = process.env.EVE_CLIENT_ID
  const clientSecret = process.env.EVE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('EVE SSO not configured')
  }

  const tokens = await refreshAccessToken(character.refresh_token, clientId, clientSecret)

  // Update tokens in database
  const supabase = await createClient()
  const expiresAtDate = new Date(now.getTime() + tokens.expires_in * 1000)

  await supabase
    .from('characters')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAtDate.toISOString(),
    })
    .eq('id', character.id)

  return tokens.access_token
}

/**
 * Get fresh access tokens for all of a user's characters
 * Refreshes expired tokens as needed
 */
export async function getAllCharacterTokens(userId: string): Promise<CharacterToken[]> {
  const supabase = await createClient()

  const { data: characters, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)

  if (error || !characters) {
    console.error('[Auth] Failed to fetch characters:', error)
    return []
  }

  const tokens: CharacterToken[] = []

  for (const character of characters as Character[]) {
    try {
      const accessToken = await refreshTokenIfNeeded(character)
      tokens.push({
        character_id: character.character_id,
        character_name: character.character_name,
        access_token: accessToken,
      })
    } catch (error) {
      console.error(`[Auth] Failed to refresh token for ${character.character_name}:`, error)
      // Continue with other characters even if one fails
    }
  }

  return tokens
}

/**
 * Find or create a user based on character login
 * Returns the user and whether they are new
 */
export async function findOrCreateUser(
  characterId: number,
  characterName: string,
  refreshToken: string,
  accessToken: string,
  expiresIn: number
): Promise<{ user: User; isNew: boolean }> {
  const supabase = await createClient()
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  // Check if character already exists
  const { data: existingCharacter } = await supabase
    .from('characters')
    .select('*, users(*)')
    .eq('character_id', characterId)
    .single()

  if (existingCharacter) {
    // Update tokens for existing character
    await supabase
      .from('characters')
      .update({
        refresh_token: refreshToken,
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
        character_name: characterName, // Update in case name changed
      })
      .eq('character_id', characterId)

    return {
      user: existingCharacter.users as User,
      isNew: false,
    }
  }

  // Create new user with this character as main
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert({
      main_character_id: characterId,
      main_character_name: characterName,
      allowed: false, // New users start as not allowed
    })
    .select()
    .single()

  if (userError || !newUser) {
    throw new Error(`Failed to create user: ${userError?.message}`)
  }

  // Create character linked to user
  const { error: characterError } = await supabase
    .from('characters')
    .insert({
      user_id: newUser.id,
      character_id: characterId,
      character_name: characterName,
      refresh_token: refreshToken,
      access_token: accessToken,
      token_expires_at: expiresAt.toISOString(),
      is_main: true,
    })

  if (characterError) {
    // Rollback user creation
    await supabase.from('users').delete().eq('id', newUser.id)
    throw new Error(`Failed to create character: ${characterError.message}`)
  }

  return {
    user: newUser as User,
    isNew: true,
  }
}

/**
 * Add an alt character to an existing user
 */
export async function addAltCharacter(
  userId: string,
  characterId: number,
  characterName: string,
  refreshToken: string,
  accessToken: string,
  expiresIn: number
): Promise<Character> {
  const supabase = await createClient()
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  // Check if character already exists (might be linked to another user)
  const { data: existingCharacter } = await supabase
    .from('characters')
    .select('*')
    .eq('character_id', characterId)
    .single()

  if (existingCharacter) {
    if (existingCharacter.user_id === userId) {
      // Already linked to this user, just update tokens
      const { data: updated, error } = await supabase
        .from('characters')
        .update({
          refresh_token: refreshToken,
          access_token: accessToken,
          token_expires_at: expiresAt.toISOString(),
          character_name: characterName,
        })
        .eq('character_id', characterId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update character: ${error.message}`)
      return updated as Character
    } else {
      throw new Error('This character is already linked to another account')
    }
  }

  // Create new character linked to user
  const { data: newCharacter, error } = await supabase
    .from('characters')
    .insert({
      user_id: userId,
      character_id: characterId,
      character_name: characterName,
      refresh_token: refreshToken,
      access_token: accessToken,
      token_expires_at: expiresAt.toISOString(),
      is_main: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add alt character: ${error.message}`)
  }

  return newCharacter as Character
}

/**
 * Set a character as the user's main
 */
export async function setMainCharacter(userId: string, characterId: number): Promise<void> {
  const supabase = await createClient()

  // Get the character to verify it belongs to this user
  const { data: character, error: fetchError } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .single()

  if (fetchError || !character) {
    throw new Error('Character not found or does not belong to this user')
  }

  // Clear is_main on all user's characters
  await supabase
    .from('characters')
    .update({ is_main: false })
    .eq('user_id', userId)

  // Set this character as main
  await supabase
    .from('characters')
    .update({ is_main: true })
    .eq('character_id', characterId)

  // Update user's main character info
  await supabase
    .from('users')
    .update({
      main_character_id: characterId,
      main_character_name: character.character_name,
    })
    .eq('id', userId)
}

/**
 * Remove a character from a user's account
 * Cannot remove the main character
 */
export async function removeCharacter(userId: string, characterId: number): Promise<void> {
  const supabase = await createClient()

  // Check if this is the main character
  const { data: character, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .single()

  if (error || !character) {
    throw new Error('Character not found or does not belong to this user')
  }

  if (character.is_main) {
    throw new Error('Cannot remove main character. Set a different main first.')
  }

  await supabase
    .from('characters')
    .delete()
    .eq('character_id', characterId)
}

/**
 * Session response format for API endpoints
 */
export interface SessionWithCharacters {
  user: User
  mainCharacter: Character | null
  allCharacters: Character[]
}

/**
 * Get session with all characters - convenience method for API routes
 * Returns null if not authenticated or not allowed
 */
export async function getSessionWithCharacters(): Promise<SessionWithCharacters | null> {
  const session = await getAuthenticatedUser()
  if (!session) return null

  const mainCharacter = session.characters.find(c => c.is_main) || session.characters[0] || null

  return {
    user: session.user,
    mainCharacter,
    allCharacters: session.characters,
  }
}

/**
 * Get a valid access token for ESI API calls
 * Refreshes the token if expired
 * 
 * @param characterId - Optional specific character. If not provided, uses main character.
 * @returns Fresh access token or null if not authenticated
 */
export async function getValidAccessToken(characterId?: number): Promise<string | null> {
  const session = await getAuthenticatedUser()
  if (!session || session.characters.length === 0) return null

  // Find the character
  let character: Character | undefined
  if (characterId) {
    character = session.characters.find(c => c.character_id === characterId)
  } else {
    // Use main character, or first character if no main set
    character = session.characters.find(c => c.is_main) || session.characters[0]
  }

  if (!character) return null

  try {
    return await refreshTokenIfNeeded(character)
  } catch (error) {
    console.error('[Auth] Failed to get valid access token:', error)
    return null
  }
}

