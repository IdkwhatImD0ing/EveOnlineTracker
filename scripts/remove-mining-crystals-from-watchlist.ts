/**
 * Script to remove all Mining Crystal items from the watchlist_items table
 * 
 * Removes items where the item_name contains "Mining Crystal"
 * 
 * Usage: npx tsx scripts/remove-mining-crystals-from-watchlist.ts
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

async function removeMiningCrystals() {
  console.log('=== Remove Mining Crystal Items from Watchlist ===\n')

  // First, find all items with "Mining Crystal" in the name
  const { data: itemsToRemove, error: queryError } = await supabase
    .from('watchlist_items')
    .select('type_id, item_name')
    .ilike('item_name', '%Mining Crystal%')

  if (queryError) {
    console.error('Error querying items:', queryError.message)
    process.exit(1)
  }

  if (!itemsToRemove || itemsToRemove.length === 0) {
    console.log('No items with "Mining Crystal" in the name found.')
    return
  }

  console.log(`Found ${itemsToRemove.length} items to remove:\n`)
  for (const item of itemsToRemove) {
    console.log(`  - ${item.item_name} (type_id: ${item.type_id})`)
  }

  // Delete the matching items
  console.log('\nDeleting items...')
  
  const { error: deleteError } = await supabase
    .from('watchlist_items')
    .delete()
    .ilike('item_name', '%Mining Crystal%')

  if (deleteError) {
    console.error('Error deleting items:', deleteError.message)
    process.exit(1)
  }

  // Verify deletion
  const { data: remaining } = await supabase
    .from('watchlist_items')
    .select('type_id')
    .ilike('item_name', '%Mining Crystal%')

  const remainingCount = remaining?.length ?? 0

  console.log(`\n✓ Deleted ${itemsToRemove.length} Mining Crystal items from watchlist`)
  if (remainingCount > 0) {
    console.log(`  Warning: ${remainingCount} items still remain (unexpected)`)
  }
}

removeMiningCrystals().catch(console.error)

