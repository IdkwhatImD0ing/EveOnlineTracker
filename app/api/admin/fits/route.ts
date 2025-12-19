import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { parseEFT } from '@/lib/eft-parser'
import type { AllianceFit, CreateFitRequest } from '@/types/fits'

/**
 * Check if the current user is an admin
 */
async function requireAdmin(request?: NextRequest) {
  const session = await getAuthenticatedUser(request)
  
  if (!session) {
    return { error: 'Not authenticated', status: 401 }
  }
  
  if (session.user.role !== 'admin') {
    return { error: 'Admin access required', status: 403 }
  }
  
  return { session }
}

/**
 * GET /api/admin/fits
 * 
 * Returns all alliance fits. Admin only.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }
  
  try {
    const supabase = createClient()
    
    const { data: fits, error } = await supabase
      .from('alliance_fits')
      .select(`
        id,
        ship_type_id,
        ship_name,
        fit_name,
        raw_eft,
        items,
        created_by,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[Admin Fits] Failed to fetch fits:', error)
      return NextResponse.json(
        { error: 'Failed to fetch fits' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ fits: fits as AllianceFit[] })
  } catch (error) {
    console.error('[Admin Fits] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/fits
 * 
 * Creates a new alliance fit from EFT text. Admin only.
 * 
 * Request body:
 * {
 *   raw_eft: string
 * }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }
  
  try {
    const body = await request.json() as CreateFitRequest
    const { raw_eft } = body
    
    if (!raw_eft || typeof raw_eft !== 'string') {
      return NextResponse.json(
        { error: 'raw_eft is required' },
        { status: 400 }
      )
    }
    
    // Parse the EFT format
    let parsedFit
    try {
      parsedFit = parseEFT(raw_eft)
    } catch (parseError) {
      return NextResponse.json(
        { error: parseError instanceof Error ? parseError.message : 'Failed to parse EFT' },
        { status: 400 }
      )
    }
    
    // Require valid ship type
    if (parsedFit.ship_type_id === null) {
      return NextResponse.json(
        { error: `Unknown ship: ${parsedFit.ship_name}` },
        { status: 400 }
      )
    }
    
    const supabase = createClient()
    
    // Insert the fit
    const { data: fit, error } = await supabase
      .from('alliance_fits')
      .insert({
        ship_type_id: parsedFit.ship_type_id,
        ship_name: parsedFit.ship_name,
        fit_name: parsedFit.fit_name,
        raw_eft: raw_eft,
        items: parsedFit.items,
        created_by: authResult.session.user.id
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Admin Fits] Failed to create fit:', error)
      return NextResponse.json(
        { error: 'Failed to create fit' },
        { status: 500 }
      )
    }
    
    console.log(`[Admin Fits] Created fit "${parsedFit.fit_name}" for ${parsedFit.ship_name} by ${authResult.session.user.main_character_name}`)
    
    return NextResponse.json({
      fit: fit as AllianceFit,
      unresolved_items: parsedFit.unresolved_items
    }, { status: 201 })
  } catch (error) {
    console.error('[Admin Fits] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/fits?id={uuid}
 * 
 * Deletes an alliance fit. Admin only.
 */
export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const fitId = searchParams.get('id')
    
    if (!fitId) {
      return NextResponse.json(
        { error: 'Fit ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = createClient()
    
    // Get fit info for logging
    const { data: existingFit } = await supabase
      .from('alliance_fits')
      .select('fit_name, ship_name')
      .eq('id', fitId)
      .single()
    
    const { error } = await supabase
      .from('alliance_fits')
      .delete()
      .eq('id', fitId)
    
    if (error) {
      console.error('[Admin Fits] Failed to delete fit:', error)
      return NextResponse.json(
        { error: 'Failed to delete fit' },
        { status: 500 }
      )
    }
    
    if (existingFit) {
      console.log(`[Admin Fits] Deleted fit "${existingFit.fit_name}" (${existingFit.ship_name}) by ${authResult.session.user.main_character_name}`)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Fits] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

