import { NextRequest, NextResponse } from 'next/server'
import { getSystemCostIndex } from '@/lib/esi'

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

