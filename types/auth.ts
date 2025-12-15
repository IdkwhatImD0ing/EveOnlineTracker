/**
 * Authentication types for multi-account support
 */

export interface User {
    id: string
    main_character_id: number
    main_character_name: string
    allowed: boolean
    created_at: string
    updated_at: string
}

export interface Character {
    id: string
    user_id: string
    character_id: number
    character_name: string
    refresh_token: string
    access_token: string | null
    token_expires_at: string | null
    is_main: boolean
    created_at: string
    updated_at: string
}

export interface UserWithCharacters extends User {
    characters: Character[]
}

export interface Session {
    user_id: string
    user: User
    characters: Character[]
}

export interface CharacterToken {
    character_id: number
    character_name: string
    access_token: string
}

/**
 * Parsed JWT payload from EVE SSO
 */
export interface EveJWTPayload {
    sub: string // Format: "CHARACTER:EVE:{character_id}"
    name: string
    owner: string
    exp: number
    iss: string
}

