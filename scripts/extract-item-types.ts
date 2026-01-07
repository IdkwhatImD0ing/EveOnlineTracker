/**
 * EVE Online Item Type Extraction Script
 * Extracts ships, modules, ammo, drones, implants, subsystems, fighters, and deployables from JSONL static data
 * 
 * Usage: npx tsx scripts/extract-item-types.ts [input-folder]
 * 
 * Default input folder: c:\Users\aaaab\Downloads\eve-online-static-data-3133773-jsonl
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import Database from 'better-sqlite3'

// Target categories
const CATEGORY_SHIP = 6
const CATEGORY_MODULE = 7
const CATEGORY_CHARGE = 8 // Ammo
const CATEGORY_DRONE = 18
const CATEGORY_IMPLANT = 20 // Implants and Boosters
const CATEGORY_DEPLOYABLE = 22
const CATEGORY_SUBSYSTEM = 32
const CATEGORY_FIGHTER = 87

// Target groups (for items not filtered by category)
const GROUP_BOOSTER = 303 // Drugs like Blue Pill (subset of Implant category)

const TARGET_CATEGORIES = new Set([
  CATEGORY_SHIP,
  CATEGORY_MODULE,
  CATEGORY_CHARGE,
  CATEGORY_DRONE,
  CATEGORY_IMPLANT,
  CATEGORY_DEPLOYABLE,
  CATEGORY_SUBSYSTEM,
  CATEGORY_FIGHTER
])

const CATEGORY_NAMES: Record<number, string> = {
  [CATEGORY_SHIP]: 'Ship',
  [CATEGORY_MODULE]: 'Module',
  [CATEGORY_CHARGE]: 'Charge',
  [CATEGORY_DRONE]: 'Drone',
  [CATEGORY_IMPLANT]: 'Implant',
  [CATEGORY_DEPLOYABLE]: 'Deployable',
  [CATEGORY_SUBSYSTEM]: 'Subsystem',
  [CATEGORY_FIGHTER]: 'Fighter'
}

interface GroupData {
  _key: number
  categoryID: number
  name: { en: string }
  published: boolean
}

interface TypeData {
  _key: number
  groupID: number
  name: { en: string } | string
  published: boolean
  volume?: number
  mass?: number
  basePrice?: number
  marketGroupID?: number
}

interface ExtractedItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number | null
  metaGroupId: number
  metaGroupName: string
}

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

async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  const items: T[] = []
  
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        items.push(JSON.parse(line) as T)
      } catch (e) {
        console.error(`Failed to parse line: ${line.substring(0, 100)}...`)
      }
    }
  }

  return items
}

/**
 * Load meta group mappings from SQLite database
 * Returns a map of typeId -> metaGroupId
 */
function loadMetaGroupsFromSQLite(): Map<number, number> {
  const dbPath = path.join(__dirname, '..', 'data', 'sqlite-latest.sqlite')
  
  if (!fs.existsSync(dbPath)) {
    console.warn(`Warning: SQLite database not found at ${dbPath}`)
    console.warn('  Meta group data will not be available. All items will default to Tech I.')
    return new Map()
  }
  
  console.log('Loading meta group data from SQLite...')
  const db = new Database(dbPath, { readonly: true })
  
  try {
    // Query all meta type mappings
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
  // Get input folder from command line or use default
  const inputFolder = process.argv[2] || 'c:\\Users\\aaaab\\Downloads\\eve-online-static-data-3133773-jsonl'
  const outputPath = path.join(__dirname, '..', 'data', 'tradeable-items.jsonl')

  console.log('=== EVE Item Type Extraction ===\n')
  console.log(`Input folder: ${inputFolder}`)
  console.log(`Output file: ${outputPath}\n`)

  // Verify input files exist
  const groupsPath = path.join(inputFolder, 'groups.jsonl')
  const typesPath = path.join(inputFolder, 'types.jsonl')

  if (!fs.existsSync(groupsPath)) {
    console.error(`Error: groups.jsonl not found at ${groupsPath}`)
    process.exit(1)
  }
  if (!fs.existsSync(typesPath)) {
    console.error(`Error: types.jsonl not found at ${typesPath}`)
    process.exit(1)
  }

  // Step 0: Load meta group data from SQLite
  const metaGroupMap = loadMetaGroupsFromSQLite()

  // Step 1: Read groups and build lookup maps
  console.log('Reading groups.jsonl...')
  const groups = await readJsonlFile<GroupData>(groupsPath)
  
  const groupToCategoryMap = new Map<number, number>()
  const groupNameMap = new Map<number, string>()
  
  for (const group of groups) {
    groupToCategoryMap.set(group._key, group.categoryID)
    const groupName = typeof group.name === 'object' ? group.name.en : String(group.name)
    groupNameMap.set(group._key, groupName)
  }
  console.log(`  Loaded ${groups.length} groups`)

  // Step 2: Read types and filter
  console.log('Reading types.jsonl and filtering...')
  const types = await readJsonlFile<TypeData>(typesPath)
  
  const extractedItems: ExtractedItem[] = []
  const stats = {
    ships: 0,
    modules: 0,
    charges: 0,
    drones: 0,
    implants: 0,
    boosters: 0, // Subset of implants (Group 303)
    deployables: 0,
    subsystems: 0,
    fighters: 0,
    skippedUnpublished: 0,
    skippedNoMatch: 0
  }
  const metaStats: Record<string, number> = {}

  for (const type of types) {
    // Skip unpublished items
    if (!type.published) {
      stats.skippedUnpublished++
      continue
    }

    const groupId = type.groupID
    const categoryId = groupToCategoryMap.get(groupId) ?? -1
    
    // Check if this item matches our criteria
    const matchesCategory = TARGET_CATEGORIES.has(categoryId)
    const isBooster = groupId === GROUP_BOOSTER

    if (!matchesCategory && !isBooster) {
      stats.skippedNoMatch++
      continue
    }

    // Extract name (handle both object and string formats)
    const name = typeof type.name === 'object' ? type.name.en : String(type.name)
    
    // Skip items without English names
    if (!name) {
      continue
    }

    const groupName = groupNameMap.get(groupId) || 'Unknown'
    const categoryName = CATEGORY_NAMES[categoryId] || 'Unknown'
    
    // Get meta group (default to Tech I if not found)
    const metaGroupId = metaGroupMap.get(type._key) ?? 1
    const metaGroupName = META_GROUP_NAMES[metaGroupId] ?? 'Tech I'

    const item: ExtractedItem = {
      typeId: type._key,
      name,
      groupId,
      groupName,
      categoryId,
      categoryName: isBooster ? 'Booster' : categoryName,
      volume: type.volume ?? 0,
      marketGroupId: type.marketGroupID ?? null,
      metaGroupId,
      metaGroupName
    }

    extractedItems.push(item)
    
    // Update meta group stats
    metaStats[metaGroupName] = (metaStats[metaGroupName] || 0) + 1

    // Update stats
    if (categoryId === CATEGORY_SHIP) {
      stats.ships++
    } else if (categoryId === CATEGORY_MODULE) {
      stats.modules++
    } else if (categoryId === CATEGORY_CHARGE) {
      stats.charges++
    } else if (categoryId === CATEGORY_DRONE) {
      stats.drones++
    } else if (categoryId === CATEGORY_IMPLANT) {
      stats.implants++
      if (isBooster) {
        stats.boosters++ // Also count boosters separately
      }
    } else if (categoryId === CATEGORY_DEPLOYABLE) {
      stats.deployables++
    } else if (categoryId === CATEGORY_SUBSYSTEM) {
      stats.subsystems++
    } else if (categoryId === CATEGORY_FIGHTER) {
      stats.fighters++
    }
  }

  // Sort by name for consistent output
  extractedItems.sort((a, b) => a.name.localeCompare(b.name))

  // Step 3: Write output JSONL
  console.log(`\nWriting ${extractedItems.length} items to ${outputPath}...`)
  
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputStream = fs.createWriteStream(outputPath, { encoding: 'utf-8' })
  for (const item of extractedItems) {
    outputStream.write(JSON.stringify(item) + '\n')
  }
  outputStream.end()

  // Print summary
  console.log('\n=== Extraction Complete ===')
  console.log(`Total items extracted: ${extractedItems.length}`)
  console.log(`\nBy Category:`)
  console.log(`  Ships: ${stats.ships}`)
  console.log(`  Modules: ${stats.modules}`)
  console.log(`  Charges (Ammo): ${stats.charges}`)
  console.log(`  Drones: ${stats.drones}`)
  console.log(`  Implants: ${stats.implants} (incl. ${stats.boosters} boosters)`)
  console.log(`  Deployables: ${stats.deployables}`)
  console.log(`  Subsystems: ${stats.subsystems}`)
  console.log(`  Fighters: ${stats.fighters}`)
  console.log(`\nBy Meta Type:`)
  // Sort meta types by count descending
  const sortedMeta = Object.entries(metaStats).sort((a, b) => b[1] - a[1])
  for (const [metaName, count] of sortedMeta) {
    console.log(`  ${metaName}: ${count}`)
  }
  console.log(`\nSkipped:`)
  console.log(`  Unpublished: ${stats.skippedUnpublished}`)
  console.log(`  Not matching criteria: ${stats.skippedNoMatch}`)
}

main().catch(console.error)

