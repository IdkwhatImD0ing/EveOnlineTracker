/**
 * Role-based permissions configuration
 * Centralizes access control for navigation and API routes
 */

import type { UserRole } from '@/types/auth'

/**
 * Navigation permissions - which roles can see each nav item
 */
export const NAV_PERMISSIONS: Record<string, UserRole[]> = {
  '/': ['slyce', 'user', 'pro', 'admin'],
  '/industry': ['user', 'pro', 'admin'],
  '/projects': ['user', 'pro', 'admin'],
  '/public-market-seeding': ['slyce', 'user', 'pro', 'admin'],
  '/jita-purchase': ['slyce', 'user', 'pro', 'admin'],
  '/market-seeder': ['admin'],
  '/jita-opportunities': ['admin'],
  '/callback': ['admin'],
  '/admin': ['admin'],
  '/admin/fits': ['admin'],
}

/**
 * API route permissions - which roles can access each API endpoint pattern
 */
export const API_PERMISSIONS: Record<string, UserRole[]> = {
  // Industry & Projects - user, pro, admin
  '/api/industry': ['user', 'pro', 'admin'],
  '/api/projects': ['user', 'pro', 'admin'],
  
  // Public Market Seeding - slyce and above
  '/api/fits-availability': ['slyce', 'user', 'pro', 'admin'],
  
  // Jita Purchase - slyce and above
  '/api/jita-purchase': ['slyce', 'user', 'pro', 'admin'],
  
  // Market features - admin only
  '/api/market': ['admin'],
  '/api/market-seeder': ['admin'],
  '/api/sell-opportunities': ['admin'],
  '/api/watchlist': ['admin'],
  
  // ESI endpoints - varies by feature
  '/api/esi/wallet': ['admin'],
  '/api/esi/character-orders': ['admin'],
  '/api/esi/structure-orders': ['admin'],
  '/api/esi/keepstar-3t7': ['admin'],
  '/api/esi/undercut-check': ['admin'],
  '/api/esi/sell-order-generator': ['admin'],
  '/api/esi/capital-efficiency': ['admin'],
  '/api/esi/ui': ['admin'],
  '/api/esi/character-assets': ['user', 'pro', 'admin'],
  
  // Character management - all authenticated users
  '/api/characters': ['slyce', 'user', 'pro', 'admin'],
  '/api/auth': ['public', 'slyce', 'user', 'pro', 'admin'],
  
  // Items search - user and above for industry
  '/api/items': ['user', 'pro', 'admin'],
  
  // Admin endpoints
  '/api/admin': ['admin'],
  '/api/admin/fits': ['admin'],
}

/**
 * Check if a role has access to a navigation path
 */
export function canAccessNav(role: UserRole, path: string): boolean {
  // Find the matching permission entry
  const permissions = NAV_PERMISSIONS[path]
  if (permissions) {
    return permissions.includes(role)
  }
  
  // Default: admin only for unlisted paths
  return role === 'admin'
}

/**
 * Check if a role has access to an API route
 */
export function canAccessAPI(role: UserRole, path: string): boolean {
  // Check for exact match first
  if (API_PERMISSIONS[path]) {
    return API_PERMISSIONS[path].includes(role)
  }
  
  // Check for prefix match (e.g., /api/projects/[id] matches /api/projects)
  for (const [prefix, roles] of Object.entries(API_PERMISSIONS)) {
    if (path.startsWith(prefix)) {
      return roles.includes(role)
    }
  }
  
  // Default: admin only for unlisted paths
  return role === 'admin'
}

/**
 * Get all navigation paths accessible by a role
 */
export function getAccessibleNavPaths(role: UserRole): string[] {
  return Object.entries(NAV_PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([path]) => path)
}

/**
 * Role display labels
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  public: 'Public',
  slyce: 'Slyce Member',
  user: 'User',
  pro: 'Pro',
  admin: 'Admin',
}

/**
 * Role colors for UI
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  public: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  slyce: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  user: 'bg-green-500/20 text-green-400 border-green-500/30',
  pro: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

