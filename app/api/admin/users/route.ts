import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { UserRole } from '@/types/auth'

/**
 * Check if the current user is an admin
 */
async function requireAdmin(request?: NextRequest) {
  const session = await getAuthenticatedUser(request)
  
  if (!session) {
    return { error: 'Not authenticated', status: 401 }
  }
  
  if (session.user.role !== 'admin') {
    return { error: 'Admin access required', status: 403 }
  }
  
  return { session }
}

/**
 * GET /api/admin/users
 * 
 * Returns all users with their roles. Admin only.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }
  
  try {
    const supabase = await createClient()
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, main_character_id, main_character_name, role, created_at, updated_at')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[Admin] Failed to fetch users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ users })
  } catch (error) {
    console.error('[Admin] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/users
 * 
 * Updates a user's role. Admin only.
 * 
 * Request body:
 * {
 *   user_id: string,
 *   role: UserRole
 * }
 */
export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }
  
  try {
    const body = await request.json()
    const { user_id, role } = body as { user_id: string; role: UserRole }
    
    if (!user_id || !role) {
      return NextResponse.json(
        { error: 'user_id and role are required' },
        { status: 400 }
      )
    }
    
    // Validate role
    const validRoles: UserRole[] = ['public', 'slyce', 'user', 'pro', 'admin']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Prevent admin from demoting themselves
    if (user_id === authResult.session.user.id && role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', user_id)
      .select('id, main_character_id, main_character_name, role, created_at, updated_at')
      .single()
    
    if (error) {
      console.error('[Admin] Failed to update user:', error)
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      )
    }
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    console.log(`[Admin] User ${updatedUser.main_character_name} role changed to ${role} by ${authResult.session.user.main_character_name}`)
    
    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('[Admin] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

