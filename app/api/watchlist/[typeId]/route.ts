import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'

/**
 * DELETE /api/watchlist/[typeId]
 * 
 * Removes an item from the watchlist by type_id.
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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user_id)
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
      .from('watchlist_items')
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
    console.error('Watchlist delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove item' },
      { status: 500 }
    )
  }
}

