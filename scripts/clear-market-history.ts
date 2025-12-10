/**
 * Script to clear market_history table
 * 
 * Usage: 
 *   set -a && source .env.local && set +a && npx tsx scripts/clear-market-history.ts
 *   OR on Windows PowerShell:
 *   $env:NEXT_PUBLIC_SUPABASE_URL="your-url"; $env:SUPABASE_SERVICE_ROLE_KEY="your-key"; npx tsx scripts/clear-market-history.ts
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

async function clearMarketHistory() {
  console.log('Clearing market_history table...')
  
  const { error } = await supabase
    .from('market_history')
    .delete()
    .neq('type_id', 0)  // Delete all rows (neq with impossible condition)
  
  if (error) {
    console.error('Error clearing table:', error.message)
    process.exit(1)
  }
  
  console.log('✓ market_history table cleared')
}

clearMarketHistory()

