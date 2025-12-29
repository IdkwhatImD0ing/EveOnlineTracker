import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse, applyRateLimitHeaders } from '@/lib/rate-limit'
import { hasRoleLevel } from '@/lib/permissions'
import type { Project } from '@/types/database'

// PATCH /api/projects/[id]/complete - Toggle project completion status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!hasRoleLevel(session.user.role, 'user')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const { id } = await params
    const body = await request.json()
    const { completed } = body

    if (typeof completed !== 'boolean') {
      return NextResponse.json(
        { error: 'completed field must be a boolean' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Update the project's completed status
    const { data: project, error } = await supabase
      .from('projects')
      .update({ completed })
      .eq('id', id)
      .select()
      .single()

    if (error || !project) {
      return NextResponse.json(
        { error: error?.message || 'Project not found' },
        { status: error ? 500 : 404 }
      )
    }

    const response = NextResponse.json(project as Project)
    return applyRateLimitHeaders(response, rateLimitResult)
  } catch (err) {
    console.error('Error updating project completion:', err)
    return NextResponse.json(
      { error: 'Failed to update project completion' },
      { status: 500 }
    )
  }
}

