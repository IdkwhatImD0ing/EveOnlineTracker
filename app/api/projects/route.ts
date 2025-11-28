import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAppraisal } from '@/lib/janice'
import type { CreateProjectRequest, Project } from '@/types/database'

// GET /api/projects - List all projects
export async function GET() {
  try {
    const supabase = createClient()
    
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(projects as Project[])
  } catch (err) {
    console.error('Error fetching projects:', err)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body: CreateProjectRequest = await request.json()
    const { name, rawMaterialsInput, componentsInput } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Parse items through Janice API (in parallel)
    const [rawMaterialsResult, componentsResult] = await Promise.all([
      rawMaterialsInput?.trim() 
        ? createAppraisal(rawMaterialsInput) 
        : Promise.resolve({ items: [], totals: { buyPrice: 0, sellPrice: 0, splitPrice: 0 }, failures: null }),
      componentsInput?.trim() 
        ? createAppraisal(componentsInput) 
        : Promise.resolve({ items: [], totals: { buyPrice: 0, sellPrice: 0, splitPrice: 0 }, failures: null }),
    ])

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({ name: name.trim() })
      .select()
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: projectError?.message || 'Failed to create project' },
        { status: 500 }
      )
    }

    const insertionErrors: string[] = []

    // Insert raw materials
    if (rawMaterialsResult.items.length > 0) {
      const rawMaterialsData = rawMaterialsResult.items.map((item) => ({
        project_id: project.id,
        item_name: item.itemName,
        type_id: item.typeId,
        quantity: item.quantity,
        collected: false,
        buy_price: item.buyPrice,
        sell_price: item.sellPrice,
        split_price: item.splitPrice,
        volume: item.volume,
      }))

      const { error: rawError } = await supabase
        .from('raw_materials')
        .insert(rawMaterialsData)

      if (rawError) {
        console.error('Error inserting raw materials:', rawError)
        insertionErrors.push(`Raw materials: ${rawError.message}`)
      }
    }

    // Insert components
    if (componentsResult.items.length > 0) {
      const componentsData = componentsResult.items.map((item) => ({
        project_id: project.id,
        item_name: item.itemName,
        type_id: item.typeId,
        quantity: item.quantity,
        collected: false,
        buy_price: item.buyPrice,
        sell_price: item.sellPrice,
        split_price: item.splitPrice,
        volume: item.volume,
      }))

      const { error: compError } = await supabase
        .from('components')
        .insert(componentsData)

      if (compError) {
        console.error('Error inserting components:', compError)
        insertionErrors.push(`Components: ${compError.message}`)
      }
    }

    // If any insertions failed, rollback by deleting the project
    if (insertionErrors.length > 0) {
      await supabase.from('projects').delete().eq('id', project.id)
      return NextResponse.json(
        { 
          error: 'Failed to save project items', 
          details: insertionErrors 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      project,
      warnings: {
        rawMaterialsFailures: rawMaterialsResult.failures,
        componentsFailures: componentsResult.failures,
      },
    })
  } catch (err) {
    console.error('Error creating project:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create project' },
      { status: 500 }
    )
  }
}

