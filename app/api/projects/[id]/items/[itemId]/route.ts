import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { UpdateItemRequest } from '@/types/database'

// PATCH /api/projects/[id]/items/[itemId] - Update item collected status and/or quantity_made
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: projectId, itemId } = await params
    const body: UpdateItemRequest = await request.json()
    const { collected, quantity_made } = body

    const supabase = createClient()
    const url = new URL(request.url)
    const type = url.searchParams.get('type') // 'raw' or 'component'

    if (!type || !['raw', 'component'].includes(type)) {
      return NextResponse.json(
        { error: 'type query param must be "raw" or "component"' },
        { status: 400 }
      )
    }

    // Validate that at least one field is being updated
    if (collected === undefined && quantity_made === undefined) {
      return NextResponse.json(
        { error: 'Must provide collected or quantity_made' },
        { status: 400 }
      )
    }

    // Validate types if provided
    if (collected !== undefined && typeof collected !== 'boolean') {
      return NextResponse.json(
        { error: 'collected must be a boolean' },
        { status: 400 }
      )
    }

    if (quantity_made !== undefined && (typeof quantity_made !== 'number' || quantity_made < 0)) {
      return NextResponse.json(
        { error: 'quantity_made must be a non-negative number' },
        { status: 400 }
      )
    }

    const tableName = type === 'raw' ? 'raw_materials' : 'components'

    // Build update object with only provided fields
    const updateData: Record<string, boolean | number> = {}
    if (collected !== undefined) {
      updateData.collected = collected
    }
    // Only allow quantity_made for components
    if (quantity_made !== undefined && type === 'component') {
      updateData.quantity_made = quantity_made
    }

    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
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

