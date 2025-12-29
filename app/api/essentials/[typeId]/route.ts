import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { isAdminRole } from '@/types/auth'

/**
 * DELETE /api/essentials/[typeId]
 * 
 * Removes an item from the essentials list by type_id (admin only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getAuthenticatedUser()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const { typeId } = await params
    const typeIdNum = parseInt(typeId, 10)

    if (isNaN(typeIdNum)) {
      return NextResponse.json(
        { error: 'Invalid typeId' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('essential_items')
      .delete()
      .eq('type_id', typeIdNum)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to remove item', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      removed_type_id: typeIdNum,
    })

  } catch (error) {
    console.error('Essentials delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove item' },
      { status: 500 }
    )
  }
}

