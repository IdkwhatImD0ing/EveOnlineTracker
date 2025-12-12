/**
 * Test script to check if items have market history in the database
 * Run with: npx tsx scripts/test-market-history.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local')
console.log('Looking for env at:', envPath)
console.log('File exists:', fs.existsSync(envPath))

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const lines = envContent.split(/\r?\n/)
  console.log('Env file lines:', lines.length)
  for (const line of lines) {
    console.log('Line:', JSON.stringify(line))
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
      console.log('Loaded:', key)
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  console.error('URL:', SUPABASE_URL)
  console.error('KEY:', SUPABASE_KEY ? '[SET]' : '[MISSING]')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Region IDs
const VALE_OF_SILENT = 10000003
const THE_FORGE = 10000002 // Jita

// Test items from watchlist
const TEST_ITEMS = [
  { typeId: 29984, name: 'Tengu' },
  { typeId: 45627, name: 'Tengu Core - Obfuscation Manifold' },
  { typeId: 45602, name: 'Tengu Offensive - Magnetic Infusion Basin' },
  { typeId: 45603, name: 'Tengu Offensive - Support Processor' },
  { typeId: 45614, name: 'Tengu Propulsion - Chassis Optimization' },
  { typeId: 45626, name: 'Tengu Core - Augmented Graviton Reactor' },
]

async function checkMarketHistory() {
  console.log('Checking market history for test items...\n')
  
  const typeIds = TEST_ITEMS.map(i => i.typeId)
  
  // Check Vale of the Silent
  console.log('=== VALE OF THE SILENT (Region 10000003) ===\n')
  
  const { data: valeData, error: valeError } = await supabase
    .from('market_history')
    .select('type_id, date, volume, average')
    .eq('region_id', VALE_OF_SILENT)
    .in('type_id', typeIds)
    .order('date', { ascending: false })
    .limit(50)
  
  if (valeError) {
    console.error('Vale query error:', valeError.message)
  } else {
    console.log(`Found ${valeData?.length || 0} rows in Vale market history`)
    
    // Group by type_id
    const byType = new Map<number, { count: number; latestDate: string; totalVolume: number }>()
    for (const row of valeData || []) {
      const existing = byType.get(row.type_id) || { count: 0, latestDate: '', totalVolume: 0 }
      existing.count++
      if (!existing.latestDate || row.date > existing.latestDate) {
        existing.latestDate = row.date
      }
      existing.totalVolume += row.volume
      byType.set(row.type_id, existing)
    }
    
    for (const item of TEST_ITEMS) {
      const data = byType.get(item.typeId)
      if (data) {
        console.log(`  ✓ ${item.name}: ${data.count} days, latest ${data.latestDate}, total vol ${data.totalVolume}`)
      } else {
        console.log(`  ✗ ${item.name}: NO DATA`)
      }
    }
  }
  
  console.log('\n=== THE FORGE / JITA (Region 10000002) ===\n')
  
  const { data: jitaData, error: jitaError } = await supabase
    .from('market_history')
    .select('type_id, date, volume, average')
    .eq('region_id', THE_FORGE)
    .in('type_id', typeIds)
    .order('date', { ascending: false })
    .limit(50)
  
  if (jitaError) {
    console.error('Jita query error:', jitaError.message)
  } else {
    console.log(`Found ${jitaData?.length || 0} rows in Jita market history`)
    
    // Group by type_id
    const byType = new Map<number, { count: number; latestDate: string; totalVolume: number }>()
    for (const row of jitaData || []) {
      const existing = byType.get(row.type_id) || { count: 0, latestDate: '', totalVolume: 0 }
      existing.count++
      if (!existing.latestDate || row.date > existing.latestDate) {
        existing.latestDate = row.date
      }
      existing.totalVolume += row.volume
      byType.set(row.type_id, existing)
    }
    
    for (const item of TEST_ITEMS) {
      const data = byType.get(item.typeId)
      if (data) {
        console.log(`  ✓ ${item.name}: ${data.count} days, latest ${data.latestDate}, total vol ${data.totalVolume}`)
      } else {
        console.log(`  ✗ ${item.name}: NO DATA`)
      }
    }
  }
  
  // Also test the RPC function
  console.log('\n=== Testing get_market_seeder_statistics RPC ===\n')
  
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_market_seeder_statistics', {
    p_type_ids: typeIds,
    p_region_id: VALE_OF_SILENT,
    p_days_back: 30
  })
  
  if (rpcError) {
    console.error('RPC error:', rpcError.message)
  } else {
    console.log('RPC returned:', rpcData?.length || 0, 'items')
    for (const row of rpcData || []) {
      const item = TEST_ITEMS.find(i => i.typeId === row.type_id)
      console.log(`  ${item?.name || row.type_id}: avg_daily_volume=${row.avg_daily_volume}, avg_price=${row.avg_price}`)
    }
  }
}

checkMarketHistory()
  .then(() => console.log('\n=== Done ==='))
  .catch(err => console.error('Error:', err.message))

