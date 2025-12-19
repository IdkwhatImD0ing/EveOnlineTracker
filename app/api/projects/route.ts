import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAppraisal } from '@/lib/janice'
import { getGroupNamesBatch } from '@/lib/sde'
import { getAuthenticatedUser } from '@/lib/auth'
import type { CreateProjectRequest, Project } from '@/types/database'

// GET /api/projects - List all projects
export async function GET() {
  try {
    const session = await getAuthenticatedUser()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!session.user.allowed) {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }

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
    const session = await getAuthenticatedUser()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!session.user.allowed) {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }

    const body: CreateProjectRequest = await request.json()
    const { name, rawMaterialsInput, componentsInput, structuredData } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Create the project first
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

    // Check if we have structured data from industry calculator
    if (structuredData) {
      // Insert raw materials from structured data
      if (structuredData.materials.length > 0) {
        const rawMaterialsData = structuredData.materials.map((item) => ({
          project_id: project.id,
          item_name: item.name,
          type_id: item.typeId,
          quantity: item.quantity,
          collected: false,
          buy_price: item.sellPrice, // Use sell price as buy reference
          sell_price: item.sellPrice,
          split_price: null,
          // item.volume from calculation is total volume; store per-unit volume instead
          volume: item.quantity > 0 ? item.volume / item.quantity : 0,
          item_type: item.groupName || null,
        }))

        const { error: rawError } = await supabase
          .from('raw_materials')
          .insert(rawMaterialsData)

        if (rawError) {
          console.error('Error inserting raw materials:', rawError)
          insertionErrors.push(`Raw materials: ${rawError.message}`)
        }
      }

      // Insert components from structured data
      // Note: build_cost, should_buy, savings are not stored in DB - they're calculated on demand
      if (structuredData.components.length > 0) {
        const componentsData = structuredData.components.map((item) => ({
          project_id: project.id,
          item_name: item.name,
          type_id: item.typeId,
          quantity: item.quantity,
          collected: false,
          buy_price: item.sellPrice,
          sell_price: item.sellPrice,
          split_price: null,
          // item.volume from calculation is total volume; store per-unit volume instead
          volume: item.quantity > 0 ? item.volume / item.quantity : 0,
          item_type: item.groupName || null,
        }))

        const { error: compError } = await supabase
          .from('components')
          .insert(componentsData)

        if (compError) {
          console.error('Error inserting components:', compError)
          insertionErrors.push(`Components: ${compError.message}`)
        }
      }

      // If any insertions failed, rollback
      if (insertionErrors.length > 0) {
        await supabase.from('projects').delete().eq('id', project.id)
        return NextResponse.json(
          { error: 'Failed to save project items', details: insertionErrors },
          { status: 500 }
        )
      }

      return NextResponse.json({ project, warnings: {} })
    }

    // Legacy path: Parse items through Janice API
    const [rawMaterialsResult, componentsResult] = await Promise.all([
      rawMaterialsInput?.trim()
        ? createAppraisal(rawMaterialsInput)
        : Promise.resolve({ items: [], totals: { buyPrice: 0, sellPrice: 0, splitPrice: 0 }, failures: null }),
      componentsInput?.trim()
        ? createAppraisal(componentsInput)
        : Promise.resolve({ items: [], totals: { buyPrice: 0, sellPrice: 0, splitPrice: 0 }, failures: null }),
    ])

    // Look up group names from EVE SDE for all items
    const allTypeIds = [
      ...rawMaterialsResult.items.map(i => i.typeId),
      ...componentsResult.items.map(i => i.typeId),
    ].filter(id => id > 0)
    
    const groupNames = allTypeIds.length > 0 
      ? getGroupNamesBatch(allTypeIds) 
      : new Map<number, string>()

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
        item_type: groupNames.get(item.typeId) || null,
      }))

      const { error: rawError } = await supabase
        .from('raw_materials')
        .insert(rawMaterialsData)

      if (rawError) {
        console.error('Error inserting raw materials:', rawError)
        insertionErrors.push(`Raw materials: ${rawError.message}`)
      }
    }

    // Insert components (no prices - component exports don't have price columns)
    if (componentsResult.items.length > 0) {
      const componentsData = componentsResult.items.map((item) => ({
        project_id: project.id,
        item_name: item.itemName,
        type_id: item.typeId,
        quantity: item.quantity,
        collected: false,
        buy_price: null,
        sell_price: null,
        split_price: null,
        volume: item.volume,
        item_type: groupNames.get(item.typeId) || null,
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

