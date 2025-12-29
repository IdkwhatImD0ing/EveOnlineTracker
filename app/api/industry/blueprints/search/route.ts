import { NextRequest, NextResponse } from 'next/server'
import { searchBlueprints } from '@/lib/blueprints'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { hasRoleLevel } from '@/lib/permissions'

export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '20')
  
  if (query.length < 2) {
    return NextResponse.json([])
  }
  
  const results = searchBlueprints(query, Math.min(limit, 50))
  
  // Return simplified results for autocomplete
  const simplifiedResults = results.map(bp => ({
    blueprintTypeId: bp.blueprintTypeId,
    blueprintName: bp.blueprintName,
    productTypeId: bp.productTypeId,
    productName: bp.productName,
    isReaction: bp.activityId === 11 // ACTIVITY_REACTION
  }))
  
  return NextResponse.json(simplifiedResults)
}

