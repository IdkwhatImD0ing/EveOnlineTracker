import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

interface TradeableItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number
}

// Cache for tradeable items
let itemsCache: TradeableItem[] | null = null

async function loadItems(): Promise<TradeableItem[]> {
  if (itemsCache) return itemsCache

  const filePath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  
  if (!fs.existsSync(filePath)) {
    console.warn('[Items Search] tradeable-items.jsonl not found')
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const items: TradeableItem[] = []
  
  for (const line of content.split('\n')) {
    if (line.trim()) {
      try {
        items.push(JSON.parse(line))
      } catch {
        // Skip malformed lines
      }
    }
  }

  itemsCache = items
  return items
}

/**
 * GET /api/items/search
 * 
 * Search tradeable items by name.
 * 
 * Query Parameters:
 *   - q (required): Search query (minimum 2 characters)
 *   - limit (optional): Max results to return (default: 20, max: 50)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  try {
    const items = await loadItems()
    const lowerQuery = query.toLowerCase()

    const results = items
      .filter(item => item.name.toLowerCase().includes(lowerQuery))
      .slice(0, limit)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Items search error:', error)
    return NextResponse.json(
      { error: 'Failed to search items' },
      { status: 500 }
    )
  }
}

