# Janice API Integration

Integration with the Janice API for EVE Online market prices and item parsing.

## Overview

[Janice](https://janice.e-351.com/) is a third-party service that provides:

- Item parsing from EVE Online copy format
- Real-time Jita market prices
- Appraisal creation and retrieval

## API Information

| Property | Value |
|----------|-------|
| Base URL | `https://janice.e-351.com/api/rest/v2` |
| Documentation | https://janice.e-351.com/api/rest/docs/index.html |
| Swagger | https://janice.e-351.com/api/rest/v2/swagger.json |
| Authentication | API Key via `X-ApiKey` header |

## Authentication

Obtain an API key from [janice.e-351.com](https://janice.e-351.com/).

Configure in environment:

```env
JANICE_API_KEY=your_api_key
```

## Endpoints Used

### Create Appraisal

Parse item list and get current Jita prices.

**Request:**
```http
POST /api/rest/v2/appraisal?market=2&persist=false&compactize=true
Content-Type: text/plain
X-ApiKey: your_api_key

Tritanium 1000000
Pyerite 500000
Megacyte 10000
```

**Query Parameters:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| market | 2 | Jita market ID |
| persist | false | Don't save appraisal (default) |
| compactize | true | Combine duplicate items |

**Response:**
```json
{
  "id": 12345,
  "created": "2024-01-15T10:30:00Z",
  "expires": "2024-01-22T10:30:00Z",
  "datasetTime": "2024-01-15T10:25:00Z",
  "code": null,
  "designation": "appraisal",
  "pricing": "buy",
  "pricingVariant": "immediate",
  "pricePercentage": 100,
  "comment": null,
  "isCompactized": true,
  "input": null,
  "failures": null,
  "market": {
    "id": 2,
    "name": "Jita"
  },
  "totalVolume": 10010.0,
  "totalPackagedVolume": 10010.0,
  "effectivePrices": {
    "totalBuyPrice": 15500000,
    "totalSplitPrice": 15750000,
    "totalSellPrice": 16000000
  },
  "immediatePrices": {
    "totalBuyPrice": 15500000,
    "totalSplitPrice": 15750000,
    "totalSellPrice": 16000000
  },
  "top5AveragePrices": {
    "totalBuyPrice": 15400000,
    "totalSplitPrice": 15650000,
    "totalSellPrice": 15900000
  },
  "items": [
    {
      "id": 1,
      "amount": 1000000,
      "buyOrderCount": 1523,
      "buyVolume": 5000000000,
      "sellOrderCount": 892,
      "sellVolume": 3000000000,
      "effectivePrices": {
        "buyPrice": 5.5,
        "splitPrice": 5.75,
        "sellPrice": 6.0,
        "buyPriceTotal": 5500000,
        "splitPriceTotal": 5750000,
        "sellPriceTotal": 6000000
      },
      "immediatePrices": {
        "buyPrice": 5.5,
        "splitPrice": 5.75,
        "sellPrice": 6.0,
        "buyPriceTotal": 5500000,
        "splitPriceTotal": 5750000,
        "sellPriceTotal": 6000000
      },
      "top5AveragePrices": {
        "buyPrice": 5.45,
        "splitPrice": 5.7,
        "sellPrice": 5.95,
        "buyPriceTotal": 5450000,
        "splitPriceTotal": 5700000,
        "sellPriceTotal": 5950000
      },
      "totalVolume": 10000.0,
      "totalPackagedVolume": 10000.0,
      "itemType": {
        "eid": 34,
        "name": "Tritanium",
        "volume": 0.01,
        "packagedVolume": 0.01
      }
    }
  ]
}
```

## Implementation

### Client Function

```typescript
// lib/janice.ts

const JANICE_API_BASE = 'https://janice.e-351.com/api/rest/v2'
const JITA_MARKET_ID = 2

export async function createAppraisal(
  input: string,
  persist: boolean = false
): Promise<AppraisalResult> {
  const apiKey = process.env.JANICE_API_KEY
  if (!apiKey) {
    throw new Error('JANICE_API_KEY environment variable is required')
  }

  const params = new URLSearchParams({
    market: JITA_MARKET_ID.toString(),
    persist: persist.toString(),
    compactize: 'true',
  })

  const response = await fetch(`${JANICE_API_BASE}/appraisal?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'X-ApiKey': apiKey,
    },
    body: input,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Janice API error (${response.status}): ${errorText}`)
  }

  const appraisal = await response.json()
  
  // Transform to internal format
  return {
    items: (appraisal.items || []).map((item) => ({
      itemName: item.itemType.name,
      typeId: item.itemType.eid,
      quantity: item.amount,
      buyPrice: item.immediatePrices.buyPrice,
      sellPrice: item.immediatePrices.sellPrice,
      splitPrice: item.immediatePrices.splitPrice,
      volume: item.itemType.volume,
    })),
    totals: {
      buyPrice: appraisal.immediatePrices.totalBuyPrice,
      sellPrice: appraisal.immediatePrices.totalSellPrice,
      splitPrice: appraisal.immediatePrices.totalSplitPrice,
    },
    failures: appraisal.failures,
  }
}
```

### Types

```typescript
export interface ParsedItem {
  itemName: string
  typeId: number
  quantity: number
  buyPrice: number
  sellPrice: number
  splitPrice: number
  volume: number
}

export interface AppraisalResult {
  items: ParsedItem[]
  totals: {
    buyPrice: number
    sellPrice: number
    splitPrice: number
  }
  failures: string | null
}
```

## Input Formats

Janice accepts multiple EVE Online copy formats:

```
# Tab-separated (inventory export)
Tritanium    1000000    0.01 m3    Minerals

# Space-separated
Tritanium 1000000

# Item name only (quantity = 1)
Tritanium

# With "x" prefix
Tritanium x1000000

# Mixed formats work
Tritanium 1000000
Pyerite x500000
Megacyte
```

## Price Types

| Type | Description |
|------|-------------|
| `buyPrice` | Highest buy order price |
| `sellPrice` | Lowest sell order price |
| `splitPrice` | (buyPrice + sellPrice) / 2 |

The application uses `immediatePrices` (current market prices).

## Error Handling

```typescript
try {
  const result = await createAppraisal(itemList)
  // Check for partial failures
  if (result.failures) {
    console.warn('Some items failed to parse:', result.failures)
  }
} catch (error) {
  console.error('Janice API error:', error)
  // Fall back to empty prices
}
```

## Failure Handling

If some items fail to parse, they appear in `failures`:

```json
{
  "items": [...],
  "failures": "Unknown item: Invalid Item Name\nUnknown item: Typo Here"
}
```

The application returns these warnings to the user.

## Usage in Application

### Project Creation

```typescript
// POST /api/projects
const [rawMaterialsResult, componentsResult] = await Promise.all([
  rawMaterialsInput?.trim()
    ? createAppraisal(rawMaterialsInput)
    : Promise.resolve({ items: [], totals: {...}, failures: null }),
  componentsInput?.trim()
    ? createAppraisal(componentsInput)
    : Promise.resolve({ items: [], totals: {...}, failures: null }),
])
```

### Industry Calculator

```typescript
// POST /api/industry/calculate
const itemList = Array.from(itemsForPricing.values())
  .map(name => `${name} x1`)
  .join('\n')

const appraisal = await createAppraisal(itemList)
```

## Rate Limiting

Janice has fair use policies but no hard documented limits. The application:

- Batches items into single requests where possible
- Doesn't persist appraisals (reduces server load)
- Caches nothing (prices change frequently)

## Without API Key

If `JANICE_API_KEY` is not set:

- Project creation still works
- Items are not parsed (manual entry required)
- Prices show as 0
- Warning logged to console

## Related Files

- `lib/janice.ts` - API client implementation
- `app/api/projects/route.ts` - Uses for project creation
- `app/api/industry/calculate/route.ts` - Uses for price lookups
- `docs/janice_api.json` - Swagger specification (reference)

