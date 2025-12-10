import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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

