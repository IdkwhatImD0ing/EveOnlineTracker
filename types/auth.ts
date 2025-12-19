/**
 * Authentication types for multi-account support
 */

/**
 * User roles for access control
 * - public: Logged in, not in Slyce alliance, pending approval
 * - slyce: Logged in, member of Slyce alliance, auto-approved
 * - user: Manually granted access by admin
 * - pro: Premium features granted by admin
 * - admin: Full admin access
 */
export type UserRole = 'public' | 'slyce' | 'user' | 'pro' | 'admin'

/**
 * Roles that have access to the application (not pending)
 */
export const APPROVED_ROLES: UserRole[] = ['slyce', 'user', 'pro', 'admin']

/**
 * Check if a role has access to the application
 */
export function isApprovedRole(role: UserRole): boolean {
    return APPROVED_ROLES.includes(role)
}

/**
 * Check if a role has admin access
 */
export function isAdminRole(role: UserRole): boolean {
    return role === 'admin'
}

export interface User {
    id: string
    main_character_id: number
    main_character_name: string
    role: UserRole
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

