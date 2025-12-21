/**
 * Role-based access control configuration
 * 
 * Defines which roles can access which pages and API routes.
 * Unlisted paths default to 'admin' only.
 */

import type { UserRole } from '@/types/auth'

/**
 * Human-readable labels for each role
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  public: 'Pending Approval',
  slyce: 'Slyce Member',
  user: 'User',
  pro: 'Pro',
  admin: 'Admin',
}

/**
 * Tailwind color classes for each role
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  public: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  slyce: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  user: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pro: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

/**
 * Minimum role required to access each navigation path
 * Roles are hierarchical: public < slyce < user < pro < admin
 */
export const NAV_PERMISSIONS: Record<string, UserRole> = {
  // slyce+ access (all approved users)
  '/': 'slyce',
  '/public-market-seeding': 'slyce',
  '/jita-purchase': 'slyce',
  
  // user+ access (excludes slyce)
  '/industry': 'user',
  '/projects': 'user',
  
  // admin only
  '/market-seeder': 'admin',
  '/jita-opportunities': 'admin',
  '/admin': 'admin',
  '/admin/fits': 'admin',
  '/api-explorer': 'admin',
  '/sell-opportunities': 'admin',
  '/market': 'admin',
}

/**
 * Minimum role required to access each API route
 * Supports exact matches and prefix matches (paths ending with /*)
 */
export const API_PERMISSIONS: Record<string, UserRole> = {
  // Public access (all authenticated users including public)
  '/api/auth/*': 'public',
  
  // slyce+ access
  '/api/characters/*': 'slyce',
  '/api/fits-availability': 'slyce',
  '/api/jita-purchase': 'slyce',
  
  // user+ access
  '/api/industry/*': 'user',
  '/api/projects/*': 'user',
  '/api/items/*': 'user',
  '/api/esi/character-assets': 'user',
  
  // admin only
  '/api/market/*': 'admin',
  '/api/market-seeder/*': 'admin',
  '/api/sell-opportunities': 'admin',
  '/api/watchlist/*': 'admin',
  '/api/esi/wallet': 'admin',
  '/api/esi/character-orders': 'admin',
  '/api/esi/structure-orders': 'admin',
  '/api/esi/undercut-check': 'admin',
  '/api/esi/check-orders': 'admin',
  '/api/esi/sell-order-generator': 'admin',
  '/api/esi/keepstar-3t7': 'admin',
  '/api/esi/capital-efficiency': 'admin',
  '/api/esi/ui/*': 'admin',
  '/api/admin/*': 'admin',
}

/**
 * Role hierarchy - higher index = more permissions
 */
const ROLE_HIERARCHY: UserRole[] = ['public', 'slyce', 'user', 'pro', 'admin']

/**
 * Check if a role has at least the required permission level
 */
export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole)
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole)
  return userLevel >= requiredLevel
}

/**
 * Find the required role for a given path in a permissions map
 * Supports wildcard matching (paths ending with /*)
 */
function findRequiredRole(path: string, permissions: Record<string, UserRole>): UserRole | null {
  // Check exact match first
  if (permissions[path]) {
    return permissions[path]
  }
  
  // Check wildcard matches (e.g., /api/auth/* matches /api/auth/login)
  for (const [pattern, role] of Object.entries(permissions)) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1) // Remove the *
      if (path.startsWith(prefix)) {
        return role
      }
    }
  }
  
  return null
}

/**
 * Check if a user role can access a navigation path
 * Unlisted paths default to admin only
 * 
 * @param userRole - The user's role
 * @param path - The navigation path (e.g., '/market-seeder')
 * @returns true if the user can access the path
 */
export function canAccessNav(userRole: UserRole, path: string): boolean {
  const requiredRole = findRequiredRole(path, NAV_PERMISSIONS) ?? 'admin'
  return hasRoleLevel(userRole, requiredRole)
}

/**
 * Check if a user role can access an API route
 * Unlisted routes default to admin only
 * 
 * @param userRole - The user's role
 * @param path - The API path (e.g., '/api/market-seeder/analyze')
 * @returns true if the user can access the route
 */
export function canAccessAPI(userRole: UserRole, path: string): boolean {
  const requiredRole = findRequiredRole(path, API_PERMISSIONS) ?? 'admin'
  return hasRoleLevel(userRole, requiredRole)
}

/**
 * Get all navigation paths accessible by a role
 */
export function getAccessibleNavPaths(userRole: UserRole): string[] {
  return Object.entries(NAV_PERMISSIONS)
    .filter(([, requiredRole]) => hasRoleLevel(userRole, requiredRole))
    .map(([path]) => path)
}
