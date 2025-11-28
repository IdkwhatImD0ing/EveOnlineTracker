import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { CreateAdditionalCostRequest } from '@/types/database'

// POST /api/projects/[id]/costs - Add an additional cost
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body: CreateAdditionalCostRequest = await request.json()
    const { note, amount } = body

    if (!note?.trim()) {
      return NextResponse.json(
        { error: 'Note is required' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Amount must be a valid number' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Verify project exists
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from('additional_costs')
      .insert({
        project_id: projectId,
        note: note.trim(),
        amount,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error creating additional cost:', err)
    return NextResponse.json(
      { error: 'Failed to create additional cost' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/costs?costId=xxx - Delete an additional cost
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const url = new URL(request.url)
    const costId = url.searchParams.get('costId')

    if (!costId) {
      return NextResponse.json(
        { error: 'costId query param is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('additional_costs')
      .delete()
      .eq('id', costId)
      .eq('project_id', projectId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting additional cost:', err)
    return NextResponse.json(
      { error: 'Failed to delete additional cost' },
      { status: 500 }
    )
  }
}

