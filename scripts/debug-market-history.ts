/**
 * Debug script to compare market history data for specific dates
 * Run with: npx tsx scripts/debug-market-history.ts
 * 
 * Purpose: Investigate market history issues starting December 10th
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env or .env.local manually
let envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  envPath = path.join(process.cwd(), '.env')
}
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const lines = envContent.split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Configuration
const DAMAGE_CONTROL_II = 2048
const JITA_REGION = 10000002      // The Forge
const VALE_REGION = 10000003      // Vale of the Silent

const DATE_DEC9 = '2025-12-09'
const DATE_DEC10 = '2025-12-10'
const DATE_DEC11 = '2025-12-11'

interface MarketHistoryRow {
  type_id: number
  date: string
  region_id: number
  average: number
  highest: number
  lowest: number
  order_count: number
  volume: number
  updated_at: string
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A'
  return n.toLocaleString()
}

function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ISK'
}

async function queryMarketHistory(typeId: number, regionId: number, date: string): Promise<MarketHistoryRow | null> {
  const { data, error } = await supabase
    .from('market_history')
    .select('*')
    .eq('type_id', typeId)
    .eq('region_id', regionId)
    .eq('date', date)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error(`Query error for ${date}, region ${regionId}:`, error.message)
    return null
  }

  return data as MarketHistoryRow
}

async function debugMarketHistory() {
  console.log('═══════════════════════════════════════════════════════════════════════════════════════')
  console.log('  MARKET HISTORY DEBUG - Damage Control II (type_id: 2048)')
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n')

  // First, find the latest dates in the database for this item
  console.log('Finding latest dates in database...\n')
  
  const { data: jitaLatest, error: jitaErr } = await supabase
    .from('market_history')
    .select('date, volume, average, updated_at')
    .eq('type_id', DAMAGE_CONTROL_II)
    .eq('region_id', JITA_REGION)
    .order('date', { ascending: false })
    .limit(15)
  
  const { data: valeLatest, error: valeErr } = await supabase
    .from('market_history')
    .select('date, volume, average, updated_at')
    .eq('type_id', DAMAGE_CONTROL_II)
    .eq('region_id', VALE_REGION)
    .order('date', { ascending: false })
    .limit(15)

  console.log('┌─────────────────────────────────────────────────────────────────┐')
  console.log('│  JITA - Last 15 days of data                                    │')
  console.log('├─────────────────────────────────────────────────────────────────┤')
  if (jitaErr) {
    console.log(`│  ERROR: ${jitaErr.message}`)
  } else if (!jitaLatest || jitaLatest.length === 0) {
    console.log('│  NO DATA FOUND')
  } else {
    console.log('│  Date        │ Volume    │ Average Price   │ Updated At      │')
    console.log('│  ──────────────────────────────────────────────────────────── │')
    for (const row of jitaLatest) {
      const updatedDate = new Date(row.updated_at).toISOString().split('T')[0]
      console.log(`│  ${row.date}   │ ${row.volume.toString().padEnd(9)} │ ${formatNumber(row.average).padEnd(15)} │ ${updatedDate}       │`)
    }
  }
  console.log('└─────────────────────────────────────────────────────────────────┘\n')

  console.log('┌─────────────────────────────────────────────────────────────────┐')
  console.log('│  VALE - Last 15 days of data                                    │')
  console.log('├─────────────────────────────────────────────────────────────────┤')
  if (valeErr) {
    console.log(`│  ERROR: ${valeErr.message}`)
  } else if (!valeLatest || valeLatest.length === 0) {
    console.log('│  NO DATA FOUND')
  } else {
    console.log('│  Date        │ Volume    │ Average Price   │ Updated At      │')
    console.log('│  ──────────────────────────────────────────────────────────── │')
    for (const row of valeLatest) {
      const updatedDate = new Date(row.updated_at).toISOString().split('T')[0]
      console.log(`│  ${row.date}   │ ${row.volume.toString().padEnd(9)} │ ${formatNumber(row.average).padEnd(15)} │ ${updatedDate}       │`)
    }
  }
  console.log('└─────────────────────────────────────────────────────────────────┘\n')

  // Also check global latest dates across ALL items
  console.log('═══════════════════════════════════════════════════════════════════════════════════════')
  console.log('  GLOBAL DATABASE STATS')
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n')

  const { data: globalStats } = await supabase
    .from('market_history')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)

  const { data: oldestStats } = await supabase
    .from('market_history')
    .select('date')
    .order('date', { ascending: true })
    .limit(1)

  const { count: totalRows } = await supabase
    .from('market_history')
    .select('*', { count: 'exact', head: true })

  console.log(`Latest date in DB:  ${globalStats?.[0]?.date || 'N/A'}`)
  console.log(`Oldest date in DB:  ${oldestStats?.[0]?.date || 'N/A'}`)
  console.log(`Total rows in DB:   ${totalRows?.toLocaleString() || 'N/A'}`)

  // Check date distribution around Dec 10
  console.log('\n═══════════════════════════════════════════════════════════════════════════════════════')
  console.log('  ROW COUNTS BY DATE (Dec 8-15, 2025)')
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n')

  const datesToCheck = [
    '2025-12-08', '2025-12-09', '2025-12-10', '2025-12-11',
    '2025-12-12', '2025-12-13', '2025-12-14', '2025-12-15'
  ]

  for (const date of datesToCheck) {
    const { count: jitaCount } = await supabase
      .from('market_history')
      .select('*', { count: 'exact', head: true })
      .eq('region_id', JITA_REGION)
      .eq('date', date)

    const { count: valeCount } = await supabase
      .from('market_history')
      .select('*', { count: 'exact', head: true })
      .eq('region_id', VALE_REGION)
      .eq('date', date)

    console.log(`${date}: Jita=${(jitaCount || 0).toString().padStart(5)} rows, Vale=${(valeCount || 0).toString().padStart(5)} rows`)
  }
}

debugMarketHistory()
  .then(() => console.log('\n═══════════════════════════════════════════════════════════════════\n  Debug complete\n═══════════════════════════════════════════════════════════════════'))
  .catch(err => console.error('Error:', err.message))

