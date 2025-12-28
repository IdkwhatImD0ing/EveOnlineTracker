/**
 * Script to clear all items from the watchlist_items table
 * 
 * This reverts the bulk insert from add-deklein-nullsec-items.ts
 * so that watchlist_items can remain a personal watchlist.
 * 
 * Usage: npx tsx scripts/clear-watchlist-items.ts
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

async function clearWatchlistItems() {
  console.log('=== Clear Watchlist Items ===\n')

  // First, count existing items
  const { count, error: countError } = await supabase
    .from('watchlist_items')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('Error counting items:', countError.message)
    process.exit(1)
  }

  console.log(`Found ${count} items in watchlist_items table`)

  if (count === 0) {
    console.log('Table is already empty. Nothing to do.')
    return
  }

  // Delete all items
  console.log('\nDeleting all items...')
  
  const { error: deleteError } = await supabase
    .from('watchlist_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (neq with impossible value)

  if (deleteError) {
    console.error('Error deleting items:', deleteError.message)
    process.exit(1)
  }

  // Verify deletion
  const { count: remainingCount } = await supabase
    .from('watchlist_items')
    .select('*', { count: 'exact', head: true })

  console.log(`\n✓ Deleted ${count} items from watchlist_items`)
  console.log(`  Remaining items: ${remainingCount}`)
}

clearWatchlistItems().catch(console.error)

