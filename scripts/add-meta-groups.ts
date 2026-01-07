/**
 * Add Meta Group Data to Tradeable Items
 * 
 * This script augments the existing tradeable-items.jsonl with meta group data
 * from the SQLite database (invMetaTypes table).
 * 
 * Usage: npx tsx scripts/add-meta-groups.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import Database from 'better-sqlite3'

const DATA_DIR = path.join(__dirname, '..', 'data')
const TRADEABLE_ITEMS_PATH = path.join(DATA_DIR, 'tradeable-items.jsonl')
const SQLITE_PATH = path.join(DATA_DIR, 'sqlite-latest.sqlite')

// Meta group names from EVE SDE
const META_GROUP_NAMES: Record<number, string> = {
  1: 'Tech I',
  2: 'Tech II',
  3: 'Storyline',
  4: 'Faction',
  5: 'Officer',
  6: 'Deadspace',
  14: 'Tech III',
  15: 'Abyssal',
  17: 'Premium',
  19: 'Limited Time',
  52: 'Structure Faction',
  53: 'Structure Tech II',
  54: 'Structure Tech I'
}

interface TradeableItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number | null
  metaGroupId?: number
  metaGroupName?: string
}

async function readJsonlFile(filePath: string): Promise<TradeableItem[]> {
  const items: TradeableItem[] = []
  
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        items.push(JSON.parse(line) as TradeableItem)
      } catch {
        // Skip invalid lines
      }
    }
  }

  return items
}

function loadMetaGroupsFromSQLite(): Map<number, number> {
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite database not found at ${SQLITE_PATH}`)
  }
  
  console.log('Loading meta group data from SQLite...')
  const db = new Database(SQLITE_PATH, { readonly: true })
  
  try {
    const rows = db.prepare(`
      SELECT typeID, metaGroupID 
      FROM invMetaTypes 
      WHERE metaGroupID IS NOT NULL
    `).all() as { typeID: number; metaGroupID: number }[]
    
    const metaGroupMap = new Map<number, number>()
    for (const row of rows) {
      metaGroupMap.set(row.typeID, row.metaGroupID)
    }
    
    console.log(`  Loaded ${metaGroupMap.size} meta group mappings`)
    return metaGroupMap
  } finally {
    db.close()
  }
}

async function main() {
  console.log('=== Add Meta Groups to Tradeable Items ===\n')
  
  // Load meta groups from SQLite
  const metaGroupMap = loadMetaGroupsFromSQLite()
  
  // Read existing tradeable items
  console.log('\nReading existing tradeable-items.jsonl...')
  const items = await readJsonlFile(TRADEABLE_ITEMS_PATH)
  console.log(`  Loaded ${items.length} items`)
  
  // Add meta group data to each item
  console.log('\nAdding meta group data...')
  const metaStats: Record<string, number> = {}
  
  for (const item of items) {
    const metaGroupId = metaGroupMap.get(item.typeId) ?? 1
    const metaGroupName = META_GROUP_NAMES[metaGroupId] ?? 'Tech I'
    
    item.metaGroupId = metaGroupId
    item.metaGroupName = metaGroupName
    
    metaStats[metaGroupName] = (metaStats[metaGroupName] || 0) + 1
  }
  
  // Write updated file
  console.log('\nWriting updated tradeable-items.jsonl...')
  const outputStream = fs.createWriteStream(TRADEABLE_ITEMS_PATH, { encoding: 'utf-8' })
  for (const item of items) {
    outputStream.write(JSON.stringify(item) + '\n')
  }
  outputStream.end()
  
  // Print stats
  console.log('\n=== Complete ===')
  console.log(`Updated ${items.length} items with meta group data`)
  console.log('\nMeta group breakdown:')
  const sortedMeta = Object.entries(metaStats).sort((a, b) => b[1] - a[1])
  for (const [metaName, count] of sortedMeta) {
    console.log(`  ${metaName}: ${count}`)
  }
}

main().catch(console.error)

