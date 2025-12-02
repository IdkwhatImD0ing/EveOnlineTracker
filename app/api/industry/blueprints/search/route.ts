import { NextRequest, NextResponse } from 'next/server'
import { searchBlueprints } from '@/lib/blueprints'

export async function GET(request: NextRequest) {
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

