/**
 * Script to clear market_history table
 * 
 * Usage: 
 *   npx tsx scripts/clear-market-history.ts              # Clear ALL regions
 *   npx tsx scripts/clear-market-history.ts 10000003     # Clear Vale only
 *   npx tsx scripts/clear-market-history.ts 10000002     # Clear Jita only
 * 
 * Region IDs:
 *   - 10000002: The Forge (Jita)
 *   - 10000003: Vale of the Silent
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

// Parse command line argument for region_id
const regionIdArg = process.argv[2]
const regionId = regionIdArg ? parseInt(regionIdArg) : null

const REGION_NAMES: Record<number, string> = {
  10000002: 'The Forge (Jita)',
  10000003: 'Vale of the Silent',
}

async function deleteInBatches(regionId: number | null) {
  const BATCH_SIZE = 10000
  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    // Get a batch of distinct type_ids to delete
    let query = supabase
      .from('market_history')
      .select('type_id')
      .limit(BATCH_SIZE)
    
    if (regionId) {
      query = query.eq('region_id', regionId)
    }

    const { data: rows, error: selectError } = await query

    if (selectError) {
      console.error('Error selecting rows:', selectError.message)
      process.exit(1)
    }

    if (!rows || rows.length === 0) {
      hasMore = false
      break
    }

    const typeIds = [...new Set(rows.map(r => r.type_id))]
    
    // Delete these type_ids
    let deleteQuery = supabase
      .from('market_history')
      .delete()
      .in('type_id', typeIds)
    
    if (regionId) {
      deleteQuery = deleteQuery.eq('region_id', regionId)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error deleting batch:', deleteError.message)
      process.exit(1)
    }

    totalDeleted += rows.length
    process.stdout.write(`\rDeleted ${totalDeleted.toLocaleString()} rows...`)
  }

  return totalDeleted
}

async function clearMarketHistory() {
  if (regionId) {
    const regionName = REGION_NAMES[regionId] || `Region ${regionId}`
    console.log(`Clearing market_history for ${regionName} (region_id=${regionId})...`)
    const count = await deleteInBatches(regionId)
    console.log(`\n✓ market_history cleared for ${regionName} (${count.toLocaleString()} rows deleted)`)
  } else {
    console.log('Clearing ALL market_history data (all regions)...')
    console.log('This may take a while for large tables...')
    const count = await deleteInBatches(null)
    console.log(`\n✓ market_history table cleared (${count.toLocaleString()} rows deleted)`)
  }
}

clearMarketHistory()
