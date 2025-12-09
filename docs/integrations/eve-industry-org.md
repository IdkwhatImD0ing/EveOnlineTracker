# eve-industry.org Integration

Integration with eve-industry.org API for cost indices and job base costs.

## Overview

[eve-industry.org](http://eve-industry.org/) provides industry-related data:

- System cost indices for all activities
- Job base costs for blueprints
- Ore compression calculations

This data is essential for accurate job cost calculations.

## API Information

| Property | Value |
|----------|-------|
| Base URL | `http://api.eve-industry.org` |
| Authentication | None required |
| Format | XML |

## Endpoints Used

### System Cost Index

Get cost indices for a system by name.

**Request:**
```http
GET /system-cost-index.xml?name=Jita
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<eve-industry-api version="1.0">
  <system id="30000142" name="Jita">
    <activity id="1" name="Manufacturing">0.057464877494819</activity>
    <activity id="3" name="Researching Time Efficiency">0.041234567891234</activity>
    <activity id="4" name="Researching Material Efficiency">0.038765432109876</activity>
    <activity id="5" name="Copying">0.035123456789012</activity>
    <activity id="7" name="Reverse Engineering">0.012345678901234</activity>
    <activity id="8" name="Invention">0.025678901234567</activity>
    <activity id="11" name="Reactions">0.015432109876543</activity>
  </system>
</eve-industry-api>
```

### Job Base Cost

Get base installation cost for blueprints.

**Request:**
```http
GET /job-base-cost.xml?ids=24690,24688,11478
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<eve-industry-api version="1.0">
  <job-base-cost id="24690" name="Chimera Blueprint">2145678901.23</job-base-cost>
  <job-base-cost id="11478" name="Capital Armor Plates Blueprint">45678901.23</job-base-cost>
</eve-industry-api>
```

### Ore Compression

Calculate optimal ore quantities for minerals.

**Request:**
```http
GET /highsec-compression.xml
  ?rate=72.4
  &tritanium=1000000
  &pyerite=500000
  &mexallon=250000
```

**Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<eve-industry-api version="1.0">
  <Kernite>12803511</Kernite>
  <Omber>5432109</Omber>
  <Scordite>8765432</Scordite>
</eve-industry-api>
```

## Implementation

### System Cost Index

```typescript
// lib/esi.ts

const EVE_INDUSTRY_API = 'http://api.eve-industry.org'

// Cache for 1 hour
const systemCostIndexCache: Map<string, { data: Map<number, number>; time: number }> = new Map()
const CACHE_DURATION = 60 * 60 * 1000

export async function getSystemCostIndex(
  systemName: string,
  activityId: number = 1
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
      console.warn(`eve-industry.org API error (${response.status})`)
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
```

### XML Parsing

Since we're in Node.js, we parse XML manually:

```typescript
function parseSystemCostIndexXML(xmlText: string): Map<number, number> {
  const result = new Map<number, number>()
  
  // Match: <activity id="1" name="Manufacturing">0.057464877494819</activity>
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

function parseJobBaseCostXML(xmlText: string): Map<number, number> {
  const result = new Map<number, number>()
  
  // Match: <job-base-cost id="24690" name="...">2145678901.23</job-base-cost>
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
```

### Job Base Costs

```typescript
// Cache indefinitely (base costs rarely change)
const jobBaseCostCache: Map<number, number> = new Map()

export async function getJobBaseCosts(blueprintTypeIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  const uncachedIds: number[] = []
  
  // Check cache
  for (const id of blueprintTypeIds) {
    if (jobBaseCostCache.has(id)) {
      result.set(id, jobBaseCostCache.get(id)!)
    } else {
      uncachedIds.push(id)
    }
  }
  
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
```

### Ore Compression

```typescript
export async function getOreCompression(
  minerals: Map<string, number>,
  reprocessRate: number = 72.4,
  securityLevel: 'highsec' | 'lowsec' | 'nullsec' = 'highsec'
): Promise<Map<string, number>> {
  const params = new URLSearchParams()
  params.set('rate', reprocessRate.toString())
  
  const mineralMapping: Record<string, string> = {
    'Tritanium': 'tritanium',
    'Pyerite': 'pyerite',
    'Mexallon': 'mexallon',
    'Isogen': 'isogen',
    'Nocxium': 'nocxium',
    'Zydrine': 'zydrine',
    'Megacyte': 'megacyte',
  }
  
  for (const [mineralName, quantity] of minerals) {
    const paramName = mineralMapping[mineralName]
    if (paramName && quantity > 0) {
      params.set(paramName, Math.ceil(quantity).toString())
    }
  }
  
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
    
    if (!response.ok) return new Map()
    
    const xmlText = await response.text()
    return parseCompressionXML(xmlText)
  } catch (error) {
    console.warn('Failed to fetch ore compression:', error)
    return new Map()
  }
}
```

## Activity IDs

| ID | Activity | Description |
|----|----------|-------------|
| 1 | Manufacturing | Building items from blueprints |
| 3 | TE Research | Researching time efficiency |
| 4 | ME Research | Researching material efficiency |
| 5 | Copying | Creating blueprint copies |
| 7 | Reverse Engineering | Creating T3 blueprints |
| 8 | Invention | Creating T2 blueprints |
| 11 | Reactions | Moon material processing |

## Caching Strategy

| Data | Cache Duration | Reason |
|------|----------------|--------|
| System cost indices | 1 hour | Changes daily |
| Job base costs | Indefinite | Rarely changes |
| Ore compression | None | Calculated per-request |

## Error Handling

If eve-industry.org is unavailable:

```typescript
// System cost index
return 0.0001  // Very small default

// Job base costs
// Return empty map, calculations proceed with 0 base cost
```

The application logs warnings but continues operation.

## Usage in Application

### Industry Calculator

```typescript
// POST /api/industry/calculate

// 1. Get system cost index
const systemCostIndex = await getSystemCostIndex(systemName, activityId)

// 2. Get job base costs for all blueprints
const blueprintIds = result.buildSteps.map(step => step.blueprintTypeId)
const jobBaseCosts = await getJobBaseCosts(blueprintIds)

// 3. Calculate job costs
for (const step of result.buildSteps) {
  const baseCost = jobBaseCosts.get(step.blueprintTypeId) || 0
  step.jobCost = baseCost * systemCostIndex * step.runs * 
                 (1 - structureBonus) * (1 + facilityTax)
}
```

## API Reliability

eve-industry.org is a community service:

- Generally reliable but not guaranteed
- No SLA or uptime guarantee
- Use fallbacks for critical features

## Related Files

- `lib/esi.ts` - API client implementation
- `app/api/industry/calculate/route.ts` - Uses for job cost calculation
- `app/api/industry/systems/route.ts` - Uses for cost index lookup

## See Also

- [Job Cost Calculations](../calculations/job-costs.md)
- [Industry Calculator](../pages/industry-calculator.md)

