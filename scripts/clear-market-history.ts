/**
 * Script to clear market_history table
 * 
 * Usage: 
 *   npx tsx scripts/clear-market-history.ts              # Clear ALL regions
 *   npx tsx scripts/clear-market-history.ts 10000015     # Clear Vale only
 *   npx tsx scripts/clear-market-history.ts 10000002     # Clear Jita only
 * 
 * Region IDs:
 *   - 10000002: The Forge (Jita)
 *   - 10000015: Vale of the Silent
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Read .env.local file manually
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local')
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
  10000015: 'Vale of the Silent',
}

async function clearMarketHistory() {
  if (regionId) {
    const regionName = REGION_NAMES[regionId] || `Region ${regionId}`
    console.log(`Clearing market_history for ${regionName} (region_id=${regionId})...`)
    
    const { error } = await supabase
      .from('market_history')
      .delete()
      .eq('region_id', regionId)
    
    if (error) {
      console.error('Error clearing table:', error.message)
      process.exit(1)
    }
    
    console.log(`✓ market_history cleared for ${regionName}`)
  } else {
    console.log('Clearing ALL market_history data (all regions)...')
    
    const { error } = await supabase
      .from('market_history')
      .delete()
      .neq('type_id', 0)  // Delete all rows (neq with impossible condition)
    
    if (error) {
      console.error('Error clearing table:', error.message)
      process.exit(1)
    }
    
    console.log('✓ market_history table cleared (all regions)')
  }
}

clearMarketHistory()
