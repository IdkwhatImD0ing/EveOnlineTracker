/**
 * Official SDE Download and Processing Script
 * Downloads EVE Online Static Data Export from the official CCP source
 * 
 * Usage: npx tsx scripts/download-official-sde.ts [--compare]
 * 
 * Data Source: https://developers.eveonline.com/static-data/
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as readline from 'readline'
import AdmZip from 'adm-zip'

const OFFICIAL_SDE_URL = 'https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip'
const DATA_DIR = path.join(__dirname, '..', 'data')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const TEMP_DIR = path.join(__dirname, '..', '.sde-temp')

// Activity IDs in EVE
const ACTIVITY_MANUFACTURING = 1
const ACTIVITY_REACTION = 11

// Target categories for tradeable items
const TARGET_CATEGORIES = new Set([6, 7, 8, 18, 20, 22, 32, 87])
const CATEGORY_NAMES: Record<number, string> = {
  6: 'Ship',
  7: 'Module',
  8: 'Charge',
  18: 'Drone',
  20: 'Implant',
  22: 'Deployable',
  32: 'Subsystem',
  87: 'Fighter'
}

// Interfaces for parsed JSONL data
interface TypeData {
  _key: number
  name: { en: string } | string
  groupID: number
  volume?: number
  published?: boolean
  marketGroupID?: number
}

interface GroupData {
  _key: number
  name: { en: string } | string
  categoryID: number
}

interface BlueprintData {
  _key: number
  activities?: {
    manufacturing?: {
      materials?: { typeID: number; quantity: number }[]
      products?: { typeID: number; quantity: number }[]
      time?: number
    }
    reaction?: {
      materials?: { typeID: number; quantity: number }[]
      products?: { typeID: number; quantity: number }[]
      time?: number
    }
  }
}

interface SolarSystemData {
  _key: number
  name?: { en: string } | string
  solarSystemName?: string
  security?: number
  securityStatus?: number
}

interface ProcessedBlueprint {
  blueprintTypeId: number
  blueprintName: string
  productTypeId: number
  productName: string
  activityId: number
  time: number
  materials: { typeId: number; quantity: number }[]
  producedQuantity: number
}

interface ExtractedItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume: number
  marketGroupId: number | null
}

// Download file with redirect support
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`)
    
    const handleResponse = (response: import('http').IncomingMessage) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          console.log(`  Redirecting to ${redirectUrl}`)
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject)
          return
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`))
        return
      }

      const fileStream = fs.createWriteStream(destPath)
      let downloadedBytes = 0
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length
        if (totalBytes > 0) {
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1)
          process.stdout.write(`\r  Downloaded ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB (${percent}%)`)
        }
      })
      
      response.pipe(fileStream)
      
      fileStream.on('finish', () => {
        console.log('\n  Download complete!')
        fileStream.close()
        resolve()
      })
      
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    }
    
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'EveOnlineTracker/1.0 (https://github.com/eve-tracker)',
        'Accept': '*/*'
      }
    }
    
    https.request(options, handleResponse).on('error', reject).end()
  })
}

// Read JSONL file line by line (memory efficient)
async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  const items: T[] = []
  
  if (!fs.existsSync(filePath)) {
    console.warn(`  Warning: ${filePath} not found`)
    return items
  }
  
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        items.push(JSON.parse(line) as T)
      } catch {
        // Skip invalid lines
      }
    }
  }

  return items
}

// Extract name from various formats
function extractName(nameField: { en: string } | string | undefined): string {
  if (!nameField) return 'Unknown'
  if (typeof nameField === 'string') return nameField
  return nameField.en || 'Unknown'
}

async function processTypes(extractedDir: string): Promise<Record<number, { name: string; groupId: number | null; volume: number }>> {
  console.log('\nProcessing types.jsonl...')
  const typesPath = path.join(extractedDir, 'types.jsonl')
  const types = await readJsonlFile<TypeData>(typesPath)
  
  const result: Record<number, { name: string; groupId: number | null; volume: number }> = {}
  
  for (const type of types) {
    const typeId = type._key
    if (typeId !== undefined) {
      result[typeId] = {
        name: extractName(type.name),
        groupId: type.groupID ?? null,
        volume: type.volume ?? 0
      }
    }
  }
  
  console.log(`  Processed ${Object.keys(result).length} types`)
  return result
}

async function processGroups(extractedDir: string): Promise<Record<number, { name: string; categoryId: number }>> {
  console.log('\nProcessing groups.jsonl...')
  const groupsPath = path.join(extractedDir, 'groups.jsonl')
  const groups = await readJsonlFile<GroupData>(groupsPath)
  
  const result: Record<number, { name: string; categoryId: number }> = {}
  
  for (const group of groups) {
    const groupId = group._key
    if (groupId !== undefined) {
      result[groupId] = {
        name: extractName(group.name),
        categoryId: group.categoryID
      }
    }
  }
  
  console.log(`  Processed ${Object.keys(result).length} groups`)
  return result
}

async function processBlueprints(
  extractedDir: string,
  types: Record<number, { name: string; groupId: number | null; volume: number }>
): Promise<{
  blueprints: Record<number, ProcessedBlueprint>
  blueprintsByProduct: Record<number, number>
  blueprintSearch: { id: number; name: string; productId: number; productName: string; isReaction: boolean }[]
}> {
  console.log('\nProcessing blueprints.jsonl...')
  const blueprintsPath = path.join(extractedDir, 'blueprints.jsonl')
  const rawBlueprints = await readJsonlFile<BlueprintData>(blueprintsPath)
  
  const blueprints: Record<number, ProcessedBlueprint> = {}
  const blueprintsByProduct: Record<number, number> = {}
  
  for (const bp of rawBlueprints) {
    const blueprintTypeId = bp._key
    if (blueprintTypeId === undefined || !bp.activities) continue
    
    // Process manufacturing activity
    const manufacturing = bp.activities.manufacturing
    if (manufacturing?.products?.length && manufacturing?.materials?.length) {
      const product = manufacturing.products[0]
      const materials = manufacturing.materials.map(m => ({
        typeId: m.typeID,
        quantity: m.quantity
      }))
      
      const blueprintName = types[blueprintTypeId]?.name || `Unknown Blueprint ${blueprintTypeId}`
      const productName = types[product.typeID]?.name || `Unknown Product ${product.typeID}`
      
      blueprints[blueprintTypeId] = {
        blueprintTypeId,
        blueprintName,
        productTypeId: product.typeID,
        productName,
        activityId: ACTIVITY_MANUFACTURING,
        time: manufacturing.time || 0,
        materials,
        producedQuantity: product.quantity || 1
      }
      
      // Map product to blueprint (prefer manufacturing)
      blueprintsByProduct[product.typeID] = blueprintTypeId
    }
    
    // Process reaction activity
    const reaction = bp.activities.reaction
    if (reaction?.products?.length && reaction?.materials?.length) {
      const product = reaction.products[0]
      const materials = reaction.materials.map(m => ({
        typeId: m.typeID,
        quantity: m.quantity
      }))
      
      const blueprintName = types[blueprintTypeId]?.name || `Unknown Blueprint ${blueprintTypeId}`
      const productName = types[product.typeID]?.name || `Unknown Product ${product.typeID}`
      
      // Only add if not already added by manufacturing
      if (!blueprints[blueprintTypeId]) {
        blueprints[blueprintTypeId] = {
          blueprintTypeId,
          blueprintName,
          productTypeId: product.typeID,
          productName,
          activityId: ACTIVITY_REACTION,
          time: reaction.time || 0,
          materials,
          producedQuantity: product.quantity || 1
        }
      }
      
      // Map product to blueprint (only if not already mapped by manufacturing)
      if (!blueprintsByProduct[product.typeID]) {
        blueprintsByProduct[product.typeID] = blueprintTypeId
      }
    }
  }
  
  // Create search data
  const blueprintSearch = Object.values(blueprints).map(bp => ({
    id: bp.blueprintTypeId,
    name: bp.blueprintName,
    productId: bp.productTypeId,
    productName: bp.productName,
    isReaction: bp.activityId === ACTIVITY_REACTION
  }))
  
  console.log(`  Processed ${Object.keys(blueprints).length} blueprints`)
  return { blueprints, blueprintsByProduct, blueprintSearch }
}

async function processSolarSystems(extractedDir: string): Promise<{ id: number; name: string; security: number }[]> {
  console.log('\nProcessing mapSolarSystems.jsonl...')
  const systemsPath = path.join(extractedDir, 'mapSolarSystems.jsonl')
  const systems = await readJsonlFile<SolarSystemData>(systemsPath)
  
  const result: { id: number; name: string; security: number }[] = []
  
  for (const system of systems) {
    const systemId = system._key
    // Handle name being either a string or an object with 'en' property
    let name: string | undefined
    if (system.name) {
      name = typeof system.name === 'string' ? system.name : system.name.en
    } else {
      name = system.solarSystemName
    }
    const security = system.security ?? system.securityStatus ?? 0
    
    if (systemId !== undefined && name) {
      result.push({
        id: systemId,
        name,
        security: Math.round(security * 10) / 10
      })
    }
  }
  
  // Sort by name for easier searching
  result.sort((a, b) => a.name.localeCompare(b.name))
  
  console.log(`  Processed ${result.length} solar systems`)
  return result
}

function generateTradeableItems(
  types: Record<number, { name: string; groupId: number | null; volume: number }>,
  groups: Record<number, { name: string; categoryId: number }>,
  rawTypes: TypeData[]
): ExtractedItem[] {
  console.log('\nGenerating tradeable-items.jsonl...')
  
  const items: ExtractedItem[] = []
  
  for (const type of rawTypes) {
    // Skip unpublished items
    if (type.published === false) continue
    
    const groupId = type.groupID
    const group = groups[groupId]
    if (!group) continue
    
    const categoryId = group.categoryId
    
    // Check if this category is tradeable
    if (!TARGET_CATEGORIES.has(categoryId)) continue
    
    const name = extractName(type.name)
    if (!name || name === 'Unknown') continue
    
    items.push({
      typeId: type._key,
      name,
      groupId,
      groupName: group.name,
      categoryId,
      categoryName: CATEGORY_NAMES[categoryId] || 'Unknown',
      volume: type.volume ?? 0,
      marketGroupId: type.marketGroupID ?? null
    })
  }
  
  // Sort by name
  items.sort((a, b) => a.name.localeCompare(b.name))
  
  console.log(`  Generated ${items.length} tradeable items`)
  return items
}


async function main() {
  console.log('=== Official EVE SDE Download Script ===\n')
  console.log(`Data Source: ${OFFICIAL_SDE_URL}`)
  console.log(`Output Directory: ${DATA_DIR}\n`)
  
  // Ensure directories exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
  
  const zipPath = path.join(TEMP_DIR, 'sde-latest.zip')
  const extractedDir = path.join(TEMP_DIR, 'extracted')
  
  try {
    try {
      // Step 1: Download the ZIP
      console.log('Step 1: Downloading official SDE...')
      await downloadFile(OFFICIAL_SDE_URL, zipPath)
      
      // Step 2: Extract the ZIP
      console.log('\nStep 2: Extracting ZIP...')
      if (fs.existsSync(extractedDir)) {
        fs.rmSync(extractedDir, { recursive: true })
      }
      fs.mkdirSync(extractedDir, { recursive: true })
      
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(extractedDir, true)
      console.log('  Extraction complete!')
      
      // List extracted files
      const extractedFiles = fs.readdirSync(extractedDir)
      console.log(`  Found ${extractedFiles.length} files:`)
      extractedFiles.slice(0, 10).forEach(f => console.log(`    - ${f}`))
      if (extractedFiles.length > 10) {
        console.log(`    ... and ${extractedFiles.length - 10} more`)
      }
      
      // Step 3: Process types
      console.log('\nStep 3: Processing data files...')
      const types = await processTypes(extractedDir)
      
      // Step 4: Process groups
      const groups = await processGroups(extractedDir)
      
      // Step 5: Process blueprints
      const { blueprints, blueprintsByProduct, blueprintSearch } = await processBlueprints(extractedDir, types)
      
      // Step 6: Process solar systems
      const solarSystems = await processSolarSystems(extractedDir)
      
      // Step 7: Generate tradeable items
      const typesPath = path.join(extractedDir, 'types.jsonl')
      const rawTypes = await readJsonlFile<TypeData>(typesPath)
      const tradeableItems = generateTradeableItems(types, groups, rawTypes)
      
      // Step 8: Save all files
      console.log('\nStep 4: Saving output files...')
      
      // inv-types.json
      const typesOutPath = path.join(DATA_DIR, 'inv-types.json')
      fs.writeFileSync(typesOutPath, JSON.stringify(types, null, 2))
      console.log(`  Saved ${typesOutPath}`)
      
      // inv-groups.json
      const groupsOutPath = path.join(DATA_DIR, 'inv-groups.json')
      fs.writeFileSync(groupsOutPath, JSON.stringify(groups, null, 2))
      console.log(`  Saved ${groupsOutPath}`)
      
      // blueprints.json
      const blueprintsOutPath = path.join(DATA_DIR, 'blueprints.json')
      fs.writeFileSync(blueprintsOutPath, JSON.stringify(blueprints, null, 2))
      console.log(`  Saved ${blueprintsOutPath}`)
      
      // blueprints-by-product.json
      const bpByProductPath = path.join(DATA_DIR, 'blueprints-by-product.json')
      fs.writeFileSync(bpByProductPath, JSON.stringify(blueprintsByProduct, null, 2))
      console.log(`  Saved ${bpByProductPath}`)
      
      // blueprint-search.json
      const bpSearchPath = path.join(DATA_DIR, 'blueprint-search.json')
      fs.writeFileSync(bpSearchPath, JSON.stringify(blueprintSearch, null, 2))
      console.log(`  Saved ${bpSearchPath}`)
      
      // solar-systems.json
      const systemsOutPath = path.join(DATA_DIR, 'solar-systems.json')
      fs.writeFileSync(systemsOutPath, JSON.stringify(solarSystems))
      console.log(`  Saved ${systemsOutPath}`)
      
      // Also copy to public/ for client-side access
      const publicSystemsPath = path.join(PUBLIC_DIR, 'solar-systems.json')
      fs.writeFileSync(publicSystemsPath, JSON.stringify(solarSystems))
      console.log(`  Saved ${publicSystemsPath}`)
      
      // tradeable-items.jsonl
      const tradeableOutPath = path.join(DATA_DIR, 'tradeable-items.jsonl')
      const tradeableStream = fs.createWriteStream(tradeableOutPath, { encoding: 'utf-8' })
      for (const item of tradeableItems) {
        tradeableStream.write(JSON.stringify(item) + '\n')
      }
      tradeableStream.end()
      console.log(`  Saved ${tradeableOutPath}`)
      
      // Cleanup temp files
      console.log('\nCleaning up temporary files...')
      fs.rmSync(TEMP_DIR, { recursive: true })
      console.log('  Cleanup complete!')
      
  } catch (error) {
    console.error('\nError processing SDE:', error)
    process.exit(1)
  }
  
  console.log('\n=== Download and processing complete! ===')
  console.log(`\nOutput files are in: ${DATA_DIR}`)
}

main().catch(console.error)

