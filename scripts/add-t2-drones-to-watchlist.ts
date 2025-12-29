/**
 * Script to add all T2 drones to the watchlist
 * 
 * Reads from data/tradeable-items.jsonl and inserts T2 drones (categoryId 18, name ends with " II")
 * into the watchlist_items table.
 * 
 * Usage: npx tsx scripts/add-t2-drones-to-watchlist.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// Read env file manually (checks .env.local first, then .env)
function loadEnvFile() {
  const envFiles = ['.env.local', '.env']
  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile)
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=')
          const value = valueParts.join('=')
          if (key && value && !process.env[key]) {
            process.env[key] = value
          }
        }
      }
      break // Stop after first found env file
    }
  }
}

loadEnvFile()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Drone category ID in EVE Online
const CATEGORY_DRONE = 18

interface TradeableItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number | null
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
      } catch (e) {
        console.error(`Failed to parse line: ${line.substring(0, 100)}...`)
      }
    }
  }

  return items
}

async function addT2DronesToWatchlist() {
  console.log('=== Add T2 Drones to Watchlist ===\n')

  // Read tradeable items
  const dataPath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  
  if (!fs.existsSync(dataPath)) {
    console.error(`Error: tradeable-items.jsonl not found at ${dataPath}`)
    process.exit(1)
  }

  console.log('Reading tradeable-items.jsonl...')
  const items = await readJsonlFile(dataPath)
  console.log(`  Loaded ${items.length} items`)

  // Filter for T2 drones (categoryId 18 and name ends with " II")
  const t2Drones = items.filter(item => 
    item.categoryId === CATEGORY_DRONE && item.name.endsWith(' II')
  )

  console.log(`\nFound ${t2Drones.length} T2 drones:`)
  for (const drone of t2Drones) {
    console.log(`  - ${drone.name} (typeId: ${drone.typeId}, group: ${drone.groupName})`)
  }

  if (t2Drones.length === 0) {
    console.log('\nNo T2 drones found to add.')
    return
  }

  // Prepare data for upsert
  const watchlistItems = t2Drones.map(drone => ({
    type_id: drone.typeId,
    item_name: drone.name,
    group_name: drone.groupName,
    category_name: drone.categoryName,
    volume: drone.volume
  }))

  console.log('\nInserting into watchlist_items...')

  // Upsert to handle existing items (ON CONFLICT on type_id)
  const { data, error } = await supabase
    .from('watchlist_items')
    .upsert(watchlistItems, { 
      onConflict: 'type_id',
      ignoreDuplicates: false 
    })
    .select()

  if (error) {
    console.error('Error inserting items:', error.message)
    process.exit(1)
  }

  console.log(`\n✓ Successfully added/updated ${t2Drones.length} T2 drones to the watchlist!`)
  
  // Group by drone type for summary
  const groupedDrones: Record<string, string[]> = {}
  for (const drone of t2Drones) {
    if (!groupedDrones[drone.groupName]) {
      groupedDrones[drone.groupName] = []
    }
    groupedDrones[drone.groupName].push(drone.name)
  }

  console.log('\nSummary by group:')
  for (const [group, names] of Object.entries(groupedDrones)) {
    console.log(`  ${group}: ${names.length} drones`)
  }
}

addT2DronesToWatchlist().catch(console.error)

