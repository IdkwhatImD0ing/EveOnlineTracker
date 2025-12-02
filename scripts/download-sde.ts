/**
 * SDE Download and Processing Script
 * Downloads EVE Online Static Data Export from Fuzzwork and processes blueprint data
 * 
 * Usage: npx tsx scripts/download-sde.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as zlib from 'zlib'

const FUZZWORK_BASE = 'https://www.fuzzwork.co.uk/dump/latest'
const DATA_DIR = path.join(__dirname, '..', 'data')

// Activity IDs in EVE
const ACTIVITY_MANUFACTURING = 1
const ACTIVITY_REACTION = 11

interface InvType {
  typeID: number
  typeName: string
  groupID: number
  volume: number
  published: boolean
}

interface InvGroup {
  groupID: number
  groupName: string
  categoryID: number
}

interface IndustryActivityMaterial {
  typeID: number      // Blueprint typeID
  activityID: number  // 1 = manufacturing, 11 = reaction
  materialTypeID: number
  quantity: number
}

interface IndustryActivityProduct {
  typeID: number      // Blueprint typeID
  activityID: number
  productTypeID: number
  quantity: number
}

interface IndustryActivity {
  typeID: number
  activityID: number
  time: number
}

interface BlueprintData {
  blueprintTypeId: number
  blueprintName: string
  productTypeId: number
  productName: string
  activityId: number
  time: number
  materials: { typeId: number; quantity: number }[]
  producedQuantity: number
}

interface ProcessedData {
  blueprints: Record<number, BlueprintData>        // by blueprintTypeId
  blueprintsByProduct: Record<number, number>      // productTypeId -> blueprintTypeId
  types: Record<number, { name: string; groupId: number | null; volume: number }>
  groups: Record<number, { name: string; categoryId: number }>
}

function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`)
    
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'EveIndustryTracker/1.0 (https://github.com/eve-tracker)',
        'Accept': 'text/csv,text/plain,*/*',
        'Accept-Encoding': 'identity'
      }
    }
    
    const handleResponse = (response: import('http').IncomingMessage) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadFile(redirectUrl).then(resolve).catch(reject)
          return
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`))
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        
        // Check if it's bz2 compressed
        if (url.endsWith('.bz2')) {
          // For bz2, we'd need a separate library - skip for now
          reject(new Error('BZ2 decompression not supported, use uncompressed files'))
        } else if (url.endsWith('.gz')) {
          zlib.gunzip(buffer, (err, result) => {
            if (err) reject(err)
            else resolve(result.toString('utf-8'))
          })
        } else {
          resolve(buffer.toString('utf-8'))
        }
      })
      response.on('error', reject)
    }
    
    https.request(options, handleResponse).on('error', reject).end()
  })
}

function parseCSV(content: string): Record<string, string>[] {
  const headers = parseCSVLine(content.split('\n')[0])
  const rows: Record<string, string>[] = []
  
  // Parse entire content handling multi-line quoted fields
  let currentLine = ''
  let inQuotes = false
  let lineStart = content.indexOf('\n') + 1 // Skip header line
  
  for (let i = lineStart; i < content.length; i++) {
    const char = content[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
      currentLine += char
    } else if (char === '\n' && !inQuotes) {
      // End of record
      if (currentLine.trim()) {
        const values = parseCSVLine(currentLine)
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx] || ''
        })
        rows.push(row)
      }
      currentLine = ''
    } else {
      currentLine += char
    }
  }
  
  // Handle last line
  if (currentLine.trim()) {
    const values = parseCSVLine(currentLine)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push(row)
  }
  
  return rows
}

// Parse a CSV line handling quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

async function downloadAndParseCSV(filename: string): Promise<Record<string, string>[]> {
  const url = `${FUZZWORK_BASE}/${filename}`
  const content = await downloadFile(url)
  return parseCSV(content)
}

async function main() {
  console.log('=== EVE SDE Download Script ===\n')
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  try {
    // Download all required CSV files
    console.log('Downloading invTypes...')
    const invTypesRaw = await downloadAndParseCSV('invTypes.csv')
    
    console.log('Downloading invGroups...')
    const invGroupsRaw = await downloadAndParseCSV('invGroups.csv')
    
    console.log('Downloading industryActivityMaterials...')
    const materialsRaw = await downloadAndParseCSV('industryActivityMaterials.csv')
    
    console.log('Downloading industryActivityProducts...')
    const productsRaw = await downloadAndParseCSV('industryActivityProducts.csv')
    
    console.log('Downloading industryActivity...')
    const activitiesRaw = await downloadAndParseCSV('industryActivity.csv')
    
    console.log('Downloading mapSolarSystems...')
    const solarSystemsRaw = await downloadAndParseCSV('mapSolarSystems.csv')

    console.log('\nProcessing data...')

    // Process invTypes (include all types, not just published, for blueprint materials)
    const types: Record<number, { name: string; groupId: number | null; volume: number }> = {}
    for (const row of invTypesRaw) {
      const typeID = parseInt(row.typeID)
      if (!isNaN(typeID)) {
        types[typeID] = {
          name: row.typeName,
          groupId: row.groupID ? parseInt(row.groupID) : null,
          volume: parseFloat(row.volume) || 0
        }
      }
    }
    console.log(`  Processed ${Object.keys(types).length} types`)

    // Process invGroups
    const groups: Record<number, { name: string; categoryId: number }> = {}
    for (const row of invGroupsRaw) {
      const groupID = parseInt(row.groupID)
      if (!isNaN(groupID)) {
        groups[groupID] = {
          name: row.groupName,
          categoryId: parseInt(row.categoryID)
        }
      }
    }
    console.log(`  Processed ${Object.keys(groups).length} groups`)

    // Process industry activities (for time data)
    const activityTimes: Record<string, number> = {} // key: `${typeID}-${activityID}`
    for (const row of activitiesRaw) {
      const typeID = parseInt(row.typeID)
      const activityID = parseInt(row.activityID)
      const time = parseInt(row.time)
      if (!isNaN(typeID) && !isNaN(activityID) && !isNaN(time)) {
        activityTimes[`${typeID}-${activityID}`] = time
      }
    }

    // Process industry activity materials
    const blueprintMaterials: Record<string, { typeId: number; quantity: number }[]> = {}
    for (const row of materialsRaw) {
      const typeID = parseInt(row.typeID)
      const activityID = parseInt(row.activityID)
      const materialTypeID = parseInt(row.materialTypeID)
      const quantity = parseInt(row.quantity)
      
      // Only manufacturing and reactions
      if ((activityID === ACTIVITY_MANUFACTURING || activityID === ACTIVITY_REACTION) && 
          !isNaN(typeID) && !isNaN(materialTypeID) && !isNaN(quantity)) {
        const key = `${typeID}-${activityID}`
        if (!blueprintMaterials[key]) {
          blueprintMaterials[key] = []
        }
        blueprintMaterials[key].push({ typeId: materialTypeID, quantity })
      }
    }

    // Process industry activity products
    const blueprintProducts: Record<string, { productTypeId: number; quantity: number }> = {}
    for (const row of productsRaw) {
      const typeID = parseInt(row.typeID)
      const activityID = parseInt(row.activityID)
      const productTypeID = parseInt(row.productTypeID)
      const quantity = parseInt(row.quantity)
      
      if ((activityID === ACTIVITY_MANUFACTURING || activityID === ACTIVITY_REACTION) &&
          !isNaN(typeID) && !isNaN(productTypeID)) {
        const key = `${typeID}-${activityID}`
        blueprintProducts[key] = { productTypeId: productTypeID, quantity: quantity || 1 }
      }
    }

    // Build final blueprint data
    const blueprints: Record<number, BlueprintData> = {}
    const blueprintsByProduct: Record<number, number> = {}
    
    for (const key of Object.keys(blueprintProducts)) {
      const [typeIDStr, activityIDStr] = key.split('-')
      const blueprintTypeId = parseInt(typeIDStr)
      const activityId = parseInt(activityIDStr)
      
      const product = blueprintProducts[key]
      const materials = blueprintMaterials[key] || []
      const time = activityTimes[key] || 0
      
      const blueprintName = types[blueprintTypeId]?.name || `Unknown Blueprint ${blueprintTypeId}`
      const productName = types[product.productTypeId]?.name || `Unknown Product ${product.productTypeId}`
      
      // Only include blueprints that produce something and have materials
      if (product.productTypeId && materials.length > 0) {
        blueprints[blueprintTypeId] = {
          blueprintTypeId,
          blueprintName,
          productTypeId: product.productTypeId,
          productName,
          activityId,
          time,
          materials,
          producedQuantity: product.quantity
        }
        
        // Map product to blueprint (prefer manufacturing over reaction if both exist)
        if (!blueprintsByProduct[product.productTypeId] || activityId === ACTIVITY_MANUFACTURING) {
          blueprintsByProduct[product.productTypeId] = blueprintTypeId
        }
      }
    }
    
    console.log(`  Processed ${Object.keys(blueprints).length} blueprints`)

    // Process solar systems
    const solarSystems: { id: number; name: string; security: number }[] = []
    for (const row of solarSystemsRaw) {
      const systemID = parseInt(row.solarSystemID)
      const security = parseFloat(row.security)
      if (!isNaN(systemID) && row.solarSystemName) {
        solarSystems.push({
          id: systemID,
          name: row.solarSystemName,
          security: Math.round(security * 10) / 10 // Round to 1 decimal
        })
      }
    }
    // Sort by name for easier searching
    solarSystems.sort((a, b) => a.name.localeCompare(b.name))
    console.log(`  Processed ${solarSystems.length} solar systems`)

    // Save processed data
    const processedData: ProcessedData = {
      blueprints,
      blueprintsByProduct,
      types,
      groups
    }

    // Save as separate files for better loading performance
    const blueprintsPath = path.join(DATA_DIR, 'blueprints.json')
    const blueprintsByProductPath = path.join(DATA_DIR, 'blueprints-by-product.json')
    const typesPath = path.join(DATA_DIR, 'inv-types.json')
    const groupsPath = path.join(DATA_DIR, 'inv-groups.json')

    fs.writeFileSync(blueprintsPath, JSON.stringify(blueprints, null, 2))
    console.log(`  Saved ${blueprintsPath}`)

    fs.writeFileSync(blueprintsByProductPath, JSON.stringify(blueprintsByProduct, null, 2))
    console.log(`  Saved ${blueprintsByProductPath}`)

    fs.writeFileSync(typesPath, JSON.stringify(types, null, 2))
    console.log(`  Saved ${typesPath}`)

    fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2))
    console.log(`  Saved ${groupsPath}`)

    // Save solar systems (to both data and public for client-side loading)
    const solarSystemsPath = path.join(DATA_DIR, 'solar-systems.json')
    fs.writeFileSync(solarSystemsPath, JSON.stringify(solarSystems))
    console.log(`  Saved ${solarSystemsPath}`)
    
    // Also save to public folder for client-side access
    const publicDir = path.join(__dirname, '..', 'public')
    const publicSolarSystemsPath = path.join(publicDir, 'solar-systems.json')
    fs.writeFileSync(publicSolarSystemsPath, JSON.stringify(solarSystems))
    console.log(`  Saved ${publicSolarSystemsPath}`)

    // Also save a combined smaller file with just blueprint search data
    const blueprintSearchData = Object.values(blueprints).map(bp => ({
      id: bp.blueprintTypeId,
      name: bp.blueprintName,
      productId: bp.productTypeId,
      productName: bp.productName,
      isReaction: bp.activityId === ACTIVITY_REACTION
    }))
    
    const searchPath = path.join(DATA_DIR, 'blueprint-search.json')
    fs.writeFileSync(searchPath, JSON.stringify(blueprintSearchData, null, 2))
    console.log(`  Saved ${searchPath}`)

    console.log('\n=== Download complete! ===')
    
  } catch (error) {
    console.error('Error downloading SDE:', error)
    process.exit(1)
  }
}

main()

