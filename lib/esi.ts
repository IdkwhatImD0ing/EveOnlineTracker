/**
 * EVE Online Industry API client
 * Uses eve-industry.org API for cost indices and job base costs
 * Falls back to ESI for other data
 */

const EVE_INDUSTRY_API = 'http://api.eve-industry.org'
const ESI_BASE = 'https://esi.evetech.net/latest'

// Cache for system cost indices (refreshes every hour)
const systemCostIndexCache: Map<string, { data: Map<number, number>; time: number }> = new Map()
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

// Cache for job base costs
const jobBaseCostCache: Map<number, number> = new Map()

/**
 * Parse XML response from eve-industry.org API
 */
function parseXML(xmlText: string): Document {
  // Simple XML parsing for Node.js/browser
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(xmlText, 'text/xml')
  }
  // For server-side, we'll parse manually
  throw new Error('XML parsing not available on server')
}

/**
 * Parse system cost index XML manually (works on server)
 */
function parseSystemCostIndexXML(xmlText: string): Map<number, number> {
  const result = new Map<number, number>()
  
  // Match activity elements: <activity id="1" name="Manufacturing">0.057464877494819</activity>
  const activityRegex = /<activity\s+id="(\d+)"[^>]*>([^<]+)<\/activity>/g
  let match
  
  while ((match = activityRegex.exec(xmlText)) !== null) {
    const activityId = parseInt(match[1])
    const costIndex = parseFloat(match[2])
    if (!isNaN(activityId) && !isNaN(costIndex)) {
      result.set(activityId, costIndex)
    }
  }
  
  return result
}

/**
 * Parse job base cost XML manually (works on server)
 */
function parseJobBaseCostXML(xmlText: string): Map<number, number> {
  const result = new Map<number, number>()
  
  // Match job-base-cost elements: <job-base-cost id="1318" name="...">1540.3584</job-base-cost>
  const costRegex = /<job-base-cost\s+id="(\d+)"[^>]*>([^<]+)<\/job-base-cost>/g
  let match
  
  while ((match = costRegex.exec(xmlText)) !== null) {
    const typeId = parseInt(match[1])
    const cost = parseFloat(match[2])
    if (!isNaN(typeId) && !isNaN(cost)) {
      result.set(typeId, cost)
    }
  }
  
  return result
}

/**
 * Get system cost index from eve-industry.org API
 * Activity IDs: 1=Manufacturing, 3=TE Research, 4=ME Research, 5=Copying, 7=Reverse Engineering, 8=Invention, 11=Reactions
 */
export async function getSystemCostIndex(
  systemName: string,
  activityId: number = 1 // 1 = Manufacturing, 11 = Reactions
): Promise<number> {
  const cacheKey = systemName.toLowerCase()
  const now = Date.now()
  
  // Check cache
  const cached = systemCostIndexCache.get(cacheKey)
  if (cached && (now - cached.time) < CACHE_DURATION) {
    return cached.data.get(activityId) ?? 0.0001
  }
  
  try {
    const response = await fetch(
      `${EVE_INDUSTRY_API}/system-cost-index.xml?name=${encodeURIComponent(systemName)}`,
      {
        headers: {
          'User-Agent': 'EveIndustryTracker/1.0',
          'Accept': 'application/xml'
        }
      }
    )
    
    if (!response.ok) {
      console.warn(`eve-industry.org API error (${response.status}) for system ${systemName}`)
      return 0.0001
    }
    
    const xmlText = await response.text()
    const costIndices = parseSystemCostIndexXML(xmlText)
    
    // Cache the result
    systemCostIndexCache.set(cacheKey, { data: costIndices, time: now })
    
    return costIndices.get(activityId) ?? 0.0001
  } catch (error) {
    console.warn(`Failed to fetch cost index for ${systemName}:`, error)
    return 0.0001
  }
}

/**
 * Get base job installation cost from eve-industry.org API
 * @param blueprintTypeIds - Array of blueprint type IDs
 */
export async function getJobBaseCosts(blueprintTypeIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  const uncachedIds: number[] = []
  
  // Check cache first
  for (const id of blueprintTypeIds) {
    if (jobBaseCostCache.has(id)) {
      result.set(id, jobBaseCostCache.get(id)!)
    } else {
      uncachedIds.push(id)
    }
  }
  
  // Fetch uncached IDs
  if (uncachedIds.length > 0) {
    try {
      const idsParam = uncachedIds.join(',')
      const response = await fetch(
        `${EVE_INDUSTRY_API}/job-base-cost.xml?ids=${idsParam}`,
        {
          headers: {
            'User-Agent': 'EveIndustryTracker/1.0',
            'Accept': 'application/xml'
          }
        }
      )
      
      if (response.ok) {
        const xmlText = await response.text()
        const costs = parseJobBaseCostXML(xmlText)
        
        // Cache and add to result
        for (const [id, cost] of costs) {
          jobBaseCostCache.set(id, cost)
          result.set(id, cost)
        }
      }
    } catch (error) {
      console.warn('Failed to fetch job base costs:', error)
    }
  }
  
  return result
}

/**
 * Get single job base cost
 */
export async function getJobBaseCost(blueprintTypeId: number): Promise<number> {
  const costs = await getJobBaseCosts([blueprintTypeId])
  return costs.get(blueprintTypeId) ?? 0
}

/**
 * Get adjusted prices for items from ESI (used as fallback for job cost calculations)
 * These are CCP's "adjusted prices" used for industry calculations
 */
export async function getAdjustedPrices(): Promise<Map<number, number>> {
  const response = await fetch(`${ESI_BASE}/markets/prices/`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'EveIndustryTracker/1.0'
    }
  })

  if (!response.ok) {
    throw new Error(`ESI error (${response.status}): Failed to fetch market prices`)
  }

  const prices: { adjusted_price?: number; average_price?: number; type_id: number }[] = await response.json()
  
  const priceMap = new Map<number, number>()
  for (const item of prices) {
    // Use adjusted_price if available, otherwise average_price
    const price = item.adjusted_price ?? item.average_price ?? 0
    priceMap.set(item.type_id, price)
  }
  
  return priceMap
}

// Well-known system IDs for quick lookup
export const KNOWN_SYSTEMS = {
  JITA: 30000142,
  AMARR: 30002187,
  DODIXIE: 30002659,
  RENS: 30002510,
  HEK: 30002053,
  PERIMETER: 30000144,
} as const

// Security status classification
export function getSecurityClass(securityStatus: number): 'highsec' | 'lowsec' | 'nullsec' {
  if (securityStatus >= 0.5) return 'highsec'
  if (securityStatus > 0) return 'lowsec'
  return 'nullsec'
}

/**
 * Mineral type IDs for compression calculation
 */
export const MINERAL_TYPE_IDS = {
  TRITANIUM: 34,
  PYERITE: 35,
  MEXALLON: 36,
  ISOGEN: 37,
  NOCXIUM: 38,
  ZYDRINE: 39,
  MEGACYTE: 40,
  MORPHITE: 11399,
} as const

/**
 * Ore compression result from eve-industry.org API
 */
export interface CompressionResult {
  ores: Map<string, number>  // Ore name -> quantity
}

/**
 * Parse compression XML response
 */
function parseCompressionXML(xmlText: string): Map<string, number> {
  const result = new Map<string, number>()
  
  // Match ore elements like: <Kernite>12803511</Kernite>
  const oreRegex = /<(\w+)>(\d+)<\/\1>/g
  let match
  
  while ((match = oreRegex.exec(xmlText)) !== null) {
    const oreName = match[1]
    const quantity = parseInt(match[2])
    // Skip the API metadata elements
    if (oreName !== 'eve-industry-api' && !isNaN(quantity) && quantity > 0) {
      result.set(oreName, quantity)
    }
  }
  
  return result
}

/**
 * Get optimal ore compression from eve-industry.org API
 * @param minerals - Map of mineral name -> quantity needed
 * @param reprocessRate - Effective reprocessing rate as percentage (e.g., 72.4 for 72.4%)
 * @param securityLevel - 'highsec', 'lowsec', or 'nullsec'
 */
export async function getOreCompression(
  minerals: Map<string, number>,
  reprocessRate: number = 72.4,
  securityLevel: 'highsec' | 'lowsec' | 'nullsec' = 'highsec'
): Promise<Map<string, number>> {
  // Build the query parameters
  const params = new URLSearchParams()
  params.set('rate', reprocessRate.toString())
  
  // Map mineral names to parameter names (lowercase)
  const mineralMapping: Record<string, string> = {
    'Tritanium': 'tritanium',
    'Pyerite': 'pyerite',
    'Mexallon': 'mexallon',
    'Isogen': 'isogen',
    'Nocxium': 'nocxium',
    'Zydrine': 'zydrine',
    'Megacyte': 'megacyte',
    // Note: Morphite is not included in basic ore compression
  }
  
  for (const [mineralName, quantity] of minerals) {
    const paramName = mineralMapping[mineralName]
    if (paramName && quantity > 0) {
      params.set(paramName, Math.ceil(quantity).toString())
    }
  }
  
  // Choose the right endpoint based on security level
  const endpoint = securityLevel === 'highsec' 
    ? 'highsec-compression.xml'
    : securityLevel === 'lowsec'
    ? 'lowsec-compression.xml'
    : 'nullsec-compression.xml'
  
  try {
    const response = await fetch(
      `${EVE_INDUSTRY_API}/${endpoint}?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'EveIndustryTracker/1.0',
          'Accept': 'application/xml'
        }
      }
    )
    
    if (!response.ok) {
      console.warn(`eve-industry.org compression API error (${response.status})`)
      return new Map()
    }
    
    const xmlText = await response.text()
    return parseCompressionXML(xmlText)
  } catch (error) {
    console.warn('Failed to fetch ore compression:', error)
    return new Map()
  }
}

