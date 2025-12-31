import { NextRequest, NextResponse } from 'next/server'
import { getSystemCostIndex } from '@/lib/esi'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { hasRoleLevel } from '@/lib/permissions'

// Pre-defined popular systems
const POPULAR_SYSTEMS = [
  { name: 'Jita', region: 'The Forge' },
  { name: 'Perimeter', region: 'The Forge' },
  { name: 'Amarr', region: 'Domain' },
  { name: 'Dodixie', region: 'Sinq Laison' },
  { name: 'Rens', region: 'Heimatar' },
  { name: 'Hek', region: 'Metropolis' },
  { name: 'Osmon', region: 'The Forge' },
]

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
  
  // If no query, return popular systems
  if (query.length < 2) {
    return NextResponse.json(POPULAR_SYSTEMS)
  }
  
  // Filter popular systems by query
  const lowerQuery = query.toLowerCase()
  const matchingPopular = POPULAR_SYSTEMS.filter(
    s => s.name.toLowerCase().includes(lowerQuery)
  )
  
  return NextResponse.json(matchingPopular)
}

// Get cost index for a specific system by name
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!['user', 'pro', 'admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(session.user_id, session.user.role)
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const { systemName, activityId = 1 } = await request.json()
    
    if (!systemName) {
      return NextResponse.json({ error: 'systemName required' }, { status: 400 })
    }
    
    const costIndex = await getSystemCostIndex(systemName, activityId)
    
    return NextResponse.json({ 
      systemName, 
      activityId, 
      costIndex,
      costIndexPercent: (costIndex * 100).toFixed(2) + '%'
    })
  } catch (error) {
    console.error('Cost index error:', error)
    return NextResponse.json({ error: 'Failed to fetch cost index' }, { status: 500 })
  }
}

