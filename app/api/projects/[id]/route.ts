import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { ProjectWithDetails } from '@/types/database'

// GET /api/projects/[id] - Get a single project with all details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient()

    // Fetch project with all related data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Fetch related data in parallel
    const [rawMaterialsResult, componentsResult, costsResult] = await Promise.all([
      supabase
        .from('raw_materials')
        .select('*')
        .eq('project_id', id)
        .order('item_name'),
      supabase
        .from('components')
        .select('*')
        .eq('project_id', id)
        .order('item_name'),
      supabase
        .from('additional_costs')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false }),
    ])

    // Check for errors in any of the parallel queries
    const errors = [
      rawMaterialsResult.error && `raw_materials: ${rawMaterialsResult.error.message}`,
      componentsResult.error && `components: ${componentsResult.error.message}`,
      costsResult.error && `additional_costs: ${costsResult.error.message}`,
    ].filter(Boolean)

    if (errors.length > 0) {
      console.error('Error fetching project data:', errors)
      return NextResponse.json(
        { error: 'Failed to fetch project data', details: errors },
        { status: 500 }
      )
    }

    const result: ProjectWithDetails = {
      ...project,
      raw_materials: rawMaterialsResult.data ?? [],
      components: componentsResult.data ?? [],
      additional_costs: costsResult.data ?? [],
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Error fetching project:', err)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient()

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting project:', err)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}

