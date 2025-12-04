import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { CalculateResponse } from '@/app/api/industry/calculate/route'

interface CreateFromCalculationRequest {
  calculation: CalculateResponse
  quantity: number
}

// POST /api/projects/from-calculation - Create project from industry calculator results
export async function POST(request: NextRequest) {
  try {
    const body: CreateFromCalculationRequest = await request.json()
    const { calculation, quantity } = body

    if (!calculation?.blueprint) {
      return NextResponse.json(
        { error: 'Calculation data is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Auto-generate project name: "2x Chimera" or "1x Chimera"
    const projectName = quantity === 1
      ? calculation.blueprint.productName
      : `${quantity}x ${calculation.blueprint.productName}`

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({ name: projectName })
      .select()
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: projectError?.message || 'Failed to create project' },
        { status: 500 }
      )
    }

    const insertionErrors: string[] = []

    // Insert raw materials from calculation
    if (calculation.materials.length > 0) {
      const rawMaterialsData = calculation.materials.map((material) => ({
        project_id: project.id,
        item_name: material.name,
        type_id: material.typeId,
        quantity: material.quantity,
        collected: false,
        buy_price: material.buyPrice,
        sell_price: material.sellPrice,
        split_price: (material.buyPrice + material.sellPrice) / 2,
        // material.volume from calculation is total volume; store per-unit volume instead
        volume: material.quantity > 0 ? material.volume / material.quantity : 0,
        item_type: material.groupName || null,
      }))

      const { error: rawError } = await supabase
        .from('raw_materials')
        .insert(rawMaterialsData)

      if (rawError) {
        console.error('Error inserting raw materials:', rawError)
        insertionErrors.push(`Raw materials: ${rawError.message}`)
      }
    }

    // Insert components from calculation
    if (calculation.components && calculation.components.length > 0) {
      const componentsData = calculation.components.map((component) => ({
        project_id: project.id,
        item_name: component.name,
        type_id: component.typeId,
        quantity: component.quantity,
        collected: false,
        quantity_made: 0,
        buy_price: component.buyPrice,
        sell_price: component.sellPrice,
        split_price: (component.buyPrice + component.sellPrice) / 2,
        // component.volume from calculation is total volume; store per-unit volume instead
        volume: component.quantity > 0 ? component.volume / component.quantity : 0,
        item_type: component.groupName || null,
        // Store materials breakdown for buy mode calculations
        materials_breakdown: component.materialsBreakdown || null,
        build_cost: component.buildCost || null,
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

    return NextResponse.json({ project })
  } catch (err) {
    console.error('Error creating project from calculation:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create project' },
      { status: 500 }
    )
  }
}

