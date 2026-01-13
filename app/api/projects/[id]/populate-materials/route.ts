import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse, applyRateLimitHeaders } from '@/lib/rate-limit'
import { hasRoleLevel } from '@/lib/permissions'
import { getBlueprintByProduct, getTypeName, calculateMaterialQuantity } from '@/lib/blueprints'

// Default ME values for component blueprints (typical values)
const DEFAULT_BLUEPRINT_ME = 10
const DEFAULT_STRUCTURE_ME_BONUS = 0.01 // 1% from structure
const DEFAULT_RIG_ME_BONUS = 0.042 // 4.2% from T2 rig

// POST /api/projects/[id]/populate-materials - Populate materials breakdown for components
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!hasRoleLevel(session.user.role, 'user')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const { id } = await params
    const supabase = createClient()

    // Fetch components that need materials populated
    const { data: components, error: fetchError } = await supabase
      .from('components')
      .select('id, type_id, quantity')
      .eq('project_id', id)
      .is('materials_breakdown', null)

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      )
    }

    if (!components || components.length === 0) {
      return NextResponse.json({ 
        message: 'No components need materials populated',
        updated: 0 
      })
    }

    let updated = 0
    const errors: string[] = []

    // Process each component
    for (const comp of components) {
      const blueprint = getBlueprintByProduct(comp.type_id)
      
      if (!blueprint) {
        errors.push(`No blueprint found for type_id ${comp.type_id}`)
        continue
      }

      // Calculate materials for 1 run (per component unit)
      const materialsBreakdown = blueprint.materials.map(mat => {
        const adjustedQty = calculateMaterialQuantity(
          mat.quantity,
          1, // 1 run per component
          DEFAULT_BLUEPRINT_ME,
          DEFAULT_STRUCTURE_ME_BONUS,
          DEFAULT_RIG_ME_BONUS,
          1.0 // Nullsec security multiplier
        )
        
        return {
          typeId: mat.typeId,
          name: getTypeName(mat.typeId),
          quantity: adjustedQty
        }
      })

      // Estimate build cost (we don't have prices here, so just leave as null or existing)
      // The main goal is to populate materials_breakdown

      const { error: updateError } = await supabase
        .from('components')
        .update({ materials_breakdown: materialsBreakdown })
        .eq('id', comp.id)

      if (updateError) {
        errors.push(`Failed to update component ${comp.id}: ${updateError.message}`)
      } else {
        updated++
      }
    }

    const response = NextResponse.json({
      message: `Updated ${updated} of ${components.length} components`,
      updated,
      total: components.length,
      errors: errors.length > 0 ? errors : undefined
    })
    
    return applyRateLimitHeaders(response, rateLimitResult)
  } catch (err) {
    console.error('Error populating materials:', err)
    return NextResponse.json(
      { error: 'Failed to populate materials' },
      { status: 500 }
    )
  }
}

