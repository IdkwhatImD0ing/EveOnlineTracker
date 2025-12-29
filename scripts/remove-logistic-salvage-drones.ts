/**
 * Script to remove logistic drones and salvage drones from the watchlist
 * 
 * Removes items from watchlist_items where group_name is "Logistic Drone" or "Salvage Drone"
 * 
 * Usage: npx tsx scripts/remove-logistic-salvage-drones.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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

// Groups to remove
const GROUPS_TO_REMOVE = ['Logistic Drone', 'Salvage Drone']

async function removeLogisticSalvageDrones() {
  console.log('=== Remove Logistic & Salvage Drones from Watchlist ===\n')

  // First, fetch items that will be deleted to show what's being removed
  const { data: itemsToRemove, error: fetchError } = await supabase
    .from('watchlist_items')
    .select('*')
    .in('group_name', GROUPS_TO_REMOVE)

  if (fetchError) {
    console.error('Error fetching items:', fetchError.message)
    process.exit(1)
  }

  if (!itemsToRemove || itemsToRemove.length === 0) {
    console.log('No logistic or salvage drones found in the watchlist.')
    return
  }

  console.log(`Found ${itemsToRemove.length} items to remove:`)
  for (const item of itemsToRemove) {
    console.log(`  - ${item.item_name} (typeId: ${item.type_id}, group: ${item.group_name})`)
  }

  // Delete the items
  const { error: deleteError } = await supabase
    .from('watchlist_items')
    .delete()
    .in('group_name', GROUPS_TO_REMOVE)

  if (deleteError) {
    console.error('Error deleting items:', deleteError.message)
    process.exit(1)
  }

  console.log(`\n✓ Successfully removed ${itemsToRemove.length} drones from the watchlist!`)
  
  // Summary by group
  const groupCounts: Record<string, number> = {}
  for (const item of itemsToRemove) {
    const group = item.group_name || 'Unknown'
    groupCounts[group] = (groupCounts[group] || 0) + 1
  }

  console.log('\nRemoved by group:')
  for (const [group, count] of Object.entries(groupCounts)) {
    console.log(`  ${group}: ${count} drones`)
  }
}

removeLogisticSalvageDrones().catch(console.error)

