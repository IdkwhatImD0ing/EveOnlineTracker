/**
 * Script to add curated essential items to the essential_items table
 * 
 * This is a hand-picked list of ~140 items that are truly essential for
 * nullsec living in Deklein (Guristas space). No scraping - all items
 * are manually selected for their importance.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

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
      break
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

// ============================================================================
// CURATED ESSENTIAL ITEMS LIST
// Hand-picked for Deklein nullsec living (Guristas space)
// ============================================================================

const ESSENTIAL_TYPE_IDS = [
  // === RATTING SHIPS (4) ===
  12005,  // Ishtar - Primary ratting
  17715,  // Gila - Popular ratting (kinetic bonus for Guristas)
  17843,  // Vexor Navy Issue - Budget ratting
  645,    // Dominix - AFK ratting

  // === MINING SHIPS - ALL BARGES & EXHUMERS (8) ===
  32880,  // Venture - Newbie mining
  17476,  // Covetor - Max yield barge
  17478,  // Retriever - Solo mining barge
  17480,  // Procurer - Tanky barge
  22544,  // Hulk - Max yield exhumer
  22548,  // Mackinaw - Ore hold exhumer
  22546,  // Skiff - Tanky exhumer
  42244,  // Porpoise - Fleet boosting
  28606,  // Orca - Industrial command ship

  // === T3 STRATEGIC CRUISERS (4) ===
  29984,  // Tengu - Caldari T3 (kinetic bonus - great for Guristas)
  29986,  // Legion - Amarr T3
  29988,  // Proteus - Gallente T3
  29990,  // Loki - Minmatar T3

  // === T3 SUBSYSTEMS - TENGU (12) ===
  45625,  // Tengu Core - Electronic Efficiency Gate
  45626,  // Tengu Core - Augmented Graviton Reactor
  45627,  // Tengu Core - Obfuscation Manifold
  45589,  // Tengu Defensive - Covert Reconfiguration
  45590,  // Tengu Defensive - Supplemental Screening
  45591,  // Tengu Defensive - Amplification Node
  45601,  // Tengu Offensive - Accelerated Ejection Bay
  45602,  // Tengu Offensive - Magnetic Infusion Basin
  45603,  // Tengu Offensive - Support Processor
  45613,  // Tengu Propulsion - Interdiction Nullifier
  45614,  // Tengu Propulsion - Chassis Optimization
  45615,  // Tengu Propulsion - Fuel Catalyst

  // === T3 SUBSYSTEMS - LEGION (12) ===
  45622,  // Legion Core - Dissolution Sequencer
  45623,  // Legion Core - Augmented Antimatter Reactor
  45624,  // Legion Core - Energy Parasitic Complex
  45586,  // Legion Defensive - Covert Reconfiguration
  45587,  // Legion Defensive - Augmented Plating
  45588,  // Legion Defensive - Nanobot Injector
  45598,  // Legion Offensive - Liquid Crystal Magnifiers
  45599,  // Legion Offensive - Assault Optimization
  45600,  // Legion Offensive - Support Processor
  45610,  // Legion Propulsion - Interdiction Nullifier
  45611,  // Legion Propulsion - Intercalated Nanofibers
  45612,  // Legion Propulsion - Wake Limiter

  // === T3 SUBSYSTEMS - PROTEUS (12) ===
  45628,  // Proteus Core - Electronic Efficiency Gate
  45629,  // Proteus Core - Augmented Fusion Reactor
  45630,  // Proteus Core - Friction Extension Processor
  45592,  // Proteus Defensive - Covert Reconfiguration
  45593,  // Proteus Defensive - Augmented Plating
  45594,  // Proteus Defensive - Nanobot Injector
  45604,  // Proteus Offensive - Hybrid Encoding Platform
  45605,  // Proteus Offensive - Drone Synthesis Projector
  45606,  // Proteus Offensive - Support Processor
  45616,  // Proteus Propulsion - Interdiction Nullifier
  45617,  // Proteus Propulsion - Hyperspatial Optimization
  45618,  // Proteus Propulsion - Localized Injectors

  // === T3 SUBSYSTEMS - LOKI (12) ===
  45631,  // Loki Core - Dissolution Sequencer
  45632,  // Loki Core - Augmented Nuclear Reactor
  45633,  // Loki Core - Immobility Drivers
  45595,  // Loki Defensive - Covert Reconfiguration
  45596,  // Loki Defensive - Augmented Durability
  45597,  // Loki Defensive - Adaptive Defense Node
  45607,  // Loki Offensive - Projectile Scoping Array
  45608,  // Loki Offensive - Launcher Efficiency Configuration
  45609,  // Loki Offensive - Support Processor
  45619,  // Loki Propulsion - Interdiction Nullifier
  45620,  // Loki Propulsion - Intercalated Nanofibers
  45621,  // Loki Propulsion - Wake Limiter

  // === UTILITY SHIPS (4) ===
  655,    // Epithal - PI hauling
  649,    // Tayra - General hauling
  33468,  // Astero - Exploration
  605,    // Heron - Budget exploration

  // === PVP SHIPS (2) ===
  22456,  // Sabre - Interdictor
  11198,  // Stiletto - Fast tackle/travel

  // === T2 HAULERS - DEEP SPACE TRANSPORTS (5) ===
  12731,  // Bustard - Caldari DST
  12753,  // Impel - Amarr DST
  12747,  // Mastodon - Minmatar DST
  12745,  // Occator - Gallente DST
  81047,  // Torrent - Serpentis DST

  // === T2 HAULERS - BLOCKADE RUNNERS (5) ===
  12729,  // Crane - Caldari BR
  12733,  // Prorator - Amarr BR
  12735,  // Prowler - Minmatar BR
  12743,  // Viator - Gallente BR
  81046,  // Deluge - Serpentis BR

  // === DRONES (12) ===
  2436,   // Wasp II - Heavy kinetic (Guristas)
  21638,  // Vespa II - Medium kinetic (Guristas)
  2466,   // Hornet II - Light kinetic (Guristas)
  2446,   // Ogre II - Heavy thermal
  2185,   // Hammerhead II - Medium thermal
  2456,   // Hobgoblin II - Light thermal
  10250,  // Mining Drone II
  10246,  // Mining Drone I
  32787,  // Salvage Drone I
  43694,  // 'Augmented' Mining Drone
  2488,   // Warrior II - Anti-frig
  2205,   // Acolyte II - Light EM

  // === DRONE MODULES (4) ===
  4405,   // Drone Damage Amplifier II
  24417,  // Drone Navigation Computer II
  24427,  // Drone Link Augmentor II
  24438,  // Omnidirectional Tracking Link II

  // === MINING MODULES - T1 & T2 (6) ===
  17482,  // Strip Miner I
  17912,  // Modulated Strip Miner II
  22542,  // Mining Laser Upgrade I
  28576,  // Mining Laser Upgrade II
  16278,  // Ice Harvester I
  22229,  // Ice Harvester II

  // === SHIELD MODULES (6) ===
  3841,   // Large Shield Extender II
  3831,   // Medium Shield Extender II
  2281,   // Multispectrum Shield Hardener II
  2301,   // EM Shield Hardener II
  2299,   // Kinetic Shield Hardener II
  2048,   // Damage Control II

  // === PROPULSION (4) ===
  35659,  // 50MN Y-T8 Compact Microwarpdrive
  5945,   // 500MN Cold-Gas Enduring Microwarpdrive
  440,    // 5MN Microwarpdrive II
  12058,  // 10MN Afterburner II

  // === TACKLE/EWAR (3) ===
  3244,   // Warp Disruptor II
  448,    // Warp Scrambler II
  527,    // Stasis Webifier II

  // === CLOAKING (2) ===
  11370,  // Prototype Cloaking Device I
  11578,  // Covert Ops Cloaking Device II

  // === DEPLOYABLES (2) ===
  33475,  // Mobile Tractor Unit
  33474,  // Mobile Depot

  // === REPAIR MODULES (4) ===
  3530,   // Medium Armor Repairer II
  3540,   // Large Armor Repairer II
  10850,  // Medium Shield Booster II
  10858,  // Large Shield Booster II

  // === UTILITY (2) ===
  1319,   // Expanded Cargohold II
  2038,   // Cargo Scanner II

  // === EXPLORATION (4) ===
  4258,   // Core Probe Launcher II
  28758,  // Sisters Core Probe Launcher
  30013,  // Core Scanner Probe I
  30488,  // Sisters Core Scanner Probe

  // === AMMUNITION (5) ===
  209,    // Scourge Heavy Missile
  2629,   // Scourge Fury Heavy Missile
  203,    // Scourge Cruise Missile
  24533,  // Scourge Fury Cruise Missile
  28668,  // Nanite Repair Paste

  // === RIGS (5) ===
  31794,  // Small Core Defense Field Extender II
  31796,  // Medium Core Defense Field Extender II
  26448,  // Large Core Defense Field Extender II
  32039,  // Medium Drone Durability Enhancer II
  4395,   // Medium Processor Overclocking Unit I
]

// ============================================================================
// Main script
// ============================================================================

async function addEssentialItems() {
  console.log('=== Add Curated Essential Items for Deklein ===\n')
  console.log('This script adds a hand-picked list of essential items:')
  console.log('  - 32 ships (ratting, mining, T3 cruisers, T2 haulers, utility, PvP)')
  console.log('  - 48 T3 subsystems (all Tengu/Legion/Proteus/Loki)')
  console.log('  - 12 drones (kinetic for Guristas, mining, salvage)')
  console.log('  - ~40 modules (drone mods, mining T1/T2, shields, etc.)')
  console.log('  - Exploration gear, ammo, and rigs')
  console.log(`\nTotal items: ${ESSENTIAL_TYPE_IDS.length}\n`)

  const supabase = createClient(supabaseUrl!, supabaseKey!)

  // Load item data from tradeable-items.jsonl
  const tradeableItemsPath = path.join(process.cwd(), 'data', 'tradeable-items.jsonl')
  if (!fs.existsSync(tradeableItemsPath)) {
    console.error('Error: data/tradeable-items.jsonl not found')
    process.exit(1)
  }

  // Build a map of typeId -> item data
  const itemMap = new Map<number, {
    typeId: number
    name: string
    groupName: string
    categoryName: string
    volume: number
  }>()

  const fileStream = fs.createReadStream(tradeableItemsPath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const item = JSON.parse(line)
      if (ESSENTIAL_TYPE_IDS.includes(item.typeId)) {
        itemMap.set(item.typeId, {
          typeId: item.typeId,
          name: item.name,
          groupName: item.groupName || null,
          categoryName: item.categoryName || null,
          volume: item.volume || 0
        })
      }
    } catch {
      // Skip invalid lines
    }
  }

  console.log(`Found ${itemMap.size}/${ESSENTIAL_TYPE_IDS.length} items in tradeable-items.jsonl\n`)

  // Check for missing items
  const missingIds = ESSENTIAL_TYPE_IDS.filter(id => !itemMap.has(id))
  if (missingIds.length > 0) {
    console.log('Warning: Missing type IDs:', missingIds)
    console.log('These items will be skipped.\n')
  }

  // Build insert data
  const essentialItems = Array.from(itemMap.values()).map(item => ({
    type_id: item.typeId,
    item_name: item.name,
    group_name: item.groupName,
    category_name: item.categoryName,
    volume: item.volume
  }))

  console.log('=== Inserting into essential_items ===\n')

  // Insert in batches
  const BATCH_SIZE = 50
  let insertedCount = 0

  for (let i = 0; i < essentialItems.length; i += BATCH_SIZE) {
    const batch = essentialItems.slice(i, i + BATCH_SIZE)

    const { error } = await supabase
      .from('essential_items')
      .upsert(batch, {
        onConflict: 'type_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      process.exit(1)
    }

    insertedCount += batch.length
    console.log(`Progress: ${insertedCount}/${essentialItems.length} items`)
  }

  console.log(`\n✓ Successfully added ${essentialItems.length} curated essential items!`)

  // Show summary by category
  const categoryCount = new Map<string, number>()
  for (const item of essentialItems) {
    const cat = item.category_name || 'Unknown'
    categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1)
  }

  console.log('\nItems by category:')
  for (const [cat, count] of Array.from(categoryCount.entries()).sort()) {
    console.log(`  ${cat}: ${count}`)
  }
}

addEssentialItems().catch(console.error)
