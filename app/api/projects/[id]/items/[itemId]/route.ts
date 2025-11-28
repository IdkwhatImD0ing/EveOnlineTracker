import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { UpdateItemRequest } from '@/types/database'

// PATCH /api/projects/[id]/items/[itemId] - Update item collected status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: projectId, itemId } = await params
    const body: UpdateItemRequest = await request.json()
    const { collected } = body

    if (typeof collected !== 'boolean') {
      return NextResponse.json(
        { error: 'collected must be a boolean' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const url = new URL(request.url)
    const type = url.searchParams.get('type') // 'raw' or 'component'

    if (!type || !['raw', 'component'].includes(type)) {
      return NextResponse.json(
        { error: 'type query param must be "raw" or "component"' },
        { status: 400 }
      )
    }

    const tableName = type === 'raw' ? 'raw_materials' : 'components'

    const { data, error } = await supabase
      .from(tableName)
      .update({ collected })
      .eq('id', itemId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error updating item:', err)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

