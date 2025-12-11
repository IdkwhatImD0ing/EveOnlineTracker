# Market Seeder API

Analyzes market data to identify the most profitable items to import from Jita to an alliance market hub.

## Overview

The Market Seeder algorithm combines three data sources to calculate profitability:

1. **Jita Market History** (Supabase via RPC) - Up to 365 days of trade volume and pricing
2. **Alliance Structure Orders** (ESI) - Current sell orders at your hub
3. **Real-time Jita Prices** (ESI Regional Orders) - Current acquisition costs

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Market History │    │ Structure Orders │    │  Jita Prices    │
│   (Supabase)    │    │     (ESI)        │    │    (ESI)        │
└────────┬────────┘    └────────┬─────────┘    └────────┬────────┘
         │                      │                       │
         │  Batched RPC         │  Authenticated        │  Public API
         │  (200 IDs/call)      │  (all orders)         │  (20 concurrent)
         ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Market Seeder Algorithm                       │
│  • Calculate costs (Jita price + transport)                      │
│  • Determine target price (competition vs tiered markup)         │
│  • Compute profit metrics and composite score                    │
│  • Apply filters and rank items                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication

Requires EVE SSO with the following scope:
- `esi-markets.structure_markets.v1`

```
Authorization: Bearer <access_token>
```

---

## Endpoints

### GET /api/market-seeder/analyze

Runs full profitability analysis and returns ranked item recommendations.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| structure_id | string | Yes | - | Target structure ID (alliance market hub) |
| limit | integer | No | 50 | Max items per ranked list (max: 200) |
| minMargin | number | No | 10 | Minimum profit margin % |
| minProfit | number | No | 100000 | Minimum profit per unit (ISK) |
| minVolume | number | No | 10 | Minimum daily volume (units/day) |
| noCompetitionOnly | boolean | No | false | Only return items with no existing competition |
| transportCost | number | No | 450 | Transport cost per m³ (ISK) |
| days | integer | No | 30 | Days of market history to analyze |
| stream | boolean | No | false | Enable Server-Sent Events for progress updates |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token from EVE SSO |

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/market-seeder/analyze?structure_id=1051567430261&minMargin=15&transportCost=450" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200):**

```json
{
  "success": true,
  "generatedAt": "2025-12-10T12:00:00Z",
  
  "config": {
    "structureId": "1051567430261",
    "transportCostPerM3": 450,
    "minMarginPct": 15,
    "minProfitIsk": 100000,
    "daysAnalyzed": 30
  },
  
  "summary": {
    "totalItemsAnalyzed": 5841,
    "itemsPassingFilters": 847,
    "itemsWithCompetition": 312,
    "itemsNoCompetition": 535,
    "avgProfitMargin": 28.5,
    "avgProfitPerM3": 45000
  },
  
  "topByCompositeScore": [
    {
      "typeId": 2048,
      "name": "Damage Control II",
      "categoryName": "Module",
      "groupName": "Damage Control",
      "volumePerUnit": 5,
      
      "jitaSellPrice": 450000,
      "jitaSellPriceFormatted": "450.00K ISK",
      "transportCostPerUnit": 2250,
      "transportCostFormatted": "2.25K ISK",
      "totalCostPerUnit": 452250,
      "totalCostFormatted": "452.25K ISK",
      
      "hasCompetition": false,
      "competitorLowestPrice": null,
      "targetSellPrice": 630000,
      "targetSellPriceFormatted": "630.00K ISK",
      
      "profitPerUnit": 177750,
      "profitPerUnitFormatted": "177.75K ISK",
      "profitMarginPct": 39.3,
      "profitMarginPctFormatted": "39.3%",
      "profitPerM3": 35550,
      "profitPerM3Formatted": "35.55K ISK",
      
      "avgDailyVolume": 2500,
      "totalVolume30d": 75000,
      "trendDirection": "stable",
      
      "compositeScore": 78.5,
      "compositeScoreFormatted": "78.5"
    }
  ],
  
  "noCompetitionOpportunities": [...],
  "bestIskPerM3": [...],
  "trendingUp": [...],
  
  "byCategory": {
    "Module": [...],
    "Ship": [...],
    "Charge": [...],
    "Booster": [...]
  },
  
  "timing": {
    "marketHistoryQueryMs": 2500,
    "structureOrdersFetchMs": 3500,
    "jitaPriceFetchMs": 8000,
    "analysisMs": 150,
    "totalMs": 14150
  }
}
```

---

## Ranked Lists

The API returns multiple ranked lists optimized for different strategies:

### topByCompositeScore
Best overall items considering all factors. Use this for general market seeding.

### noCompetitionOpportunities
Items with **no existing sell orders** in the structure. These allow tiered markup pricing (40-300% based on item value).

### bestIskPerM3
Items with highest profit per cargo volume. Best for maximizing Jump Freighter efficiency.

### trendingUp
Items with increasing Jita demand (last 7 days > previous 23 days by 20%+). Potential growth opportunities.

### byCategory
Top items broken down by category (Module, Ship, Charge, Booster).

---

## Pricing Logic

### No Competition (Empty Market)
When there are no existing sell orders for an item in your structure, a **tiered markup** is applied based on Jita price. Cheaper items can sustain higher markups since absolute profit is lower:

| Jita Price | Multiplier | Effective Margin |
|------------|------------|------------------|
| < 500K ISK | 4.0x | ~300% |
| < 2M ISK | 3.0x | ~200% |
| < 10M ISK | 2.0x | ~100% |
| < 50M ISK | 1.7x | ~70% |
| >= 50M ISK | 1.4x | ~40% |

```
Target Price = Jita Sell Price × Tiered Multiplier
```

**Example:**
- 100K ISK item → 400K ISK target (4x)
- 1M ISK item → 3M ISK target (3x)
- 5M ISK item → 10M ISK target (2x)
- 30M ISK item → 51M ISK target (1.7x)
- 100M ISK item → 140M ISK target (1.4x)

### With Competition
When competitors have sell orders:
```
Target Price = Competitor's Lowest Price
```

### Profit Calculation
```
Transport Cost = Volume (m³) × Transport Rate (ISK/m³)
Total Cost = Jita Sell Price + Transport Cost
Profit = Target Price - Total Cost
Margin % = (Profit / Total Cost) × 100
```

---

## Composite Score

Items are ranked using a weighted composite score, multiplied by volume to prioritize sellable items:

### Base Score Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Profit Margin % | 25% | Higher margins = better capital efficiency |
| Profit per m³ | 30% | Transport efficiency (ISK per cargo space) |
| Jita Demand | 25% | Higher Jita volume = more potential buyers |
| Absolute Profit | 20% | Raw ISK profit per unit |
| No Competition Bonus | +15 | Bonus for items with no existing orders |

### Volume Multiplier

The base score is multiplied by `sqrt(avgDailyVolume)` to heavily favor high-volume items:

```
finalScore = baseScore × sqrt(avgDailyVolume)
```

| Daily Volume | Multiplier | Effect |
|--------------|------------|--------|
| 10 units/day | 3.2x | Minimum threshold |
| 100 units/day | 10x | Popular modules |
| 1,000 units/day | 31.6x | High-demand items |
| 10,000 units/day | 100x | Very high volume (ammo, etc.) |

This ensures that rare, expensive items with 1-2 trades/day don't outrank common items that will actually sell in your market hub.

---

## Minimum Filters

Items must pass these thresholds to appear in results (all configurable via query params except Jita Price):

| Filter | Default | Query Param | Description |
|--------|---------|-------------|-------------|
| Profit Margin | ≥ 10% | `minMargin` | Below this isn't worth the effort |
| Profit per Unit | ≥ 100,000 ISK | `minProfit` | Minimum absolute profit |
| Jita Daily Volume | ≥ 10 units/day | `minVolume` | Must have meaningful demand to sell in your hub |
| Jita Price | ≥ 10,000 ISK | - | Fixed threshold, very cheap items have low margin potential |
| No Competition Only | false | `noCompetitionOnly` | When true, only show items with no existing sell orders |

---

## Error Responses

**Missing structure_id (400):**
```json
{
  "success": false,
  "error": "structure_id is required",
  "details": "Provide the structure ID of your alliance market hub"
}
```

**Missing authorization (401):**
```json
{
  "success": false,
  "error": "Authorization header required",
  "details": "Login with EVE SSO first (requires esi-markets.structure_markets.v1 scope)"
}
```

**ESI/Processing Error (500):**
```json
{
  "success": false,
  "error": "Failed to fetch structure orders: ...",
  "timing": { "totalMs": 5000 }
}
```

---

## Caching

The algorithm uses Next.js `"use cache"` directive with `cacheLife` profiles for performance:

| Data Source | Cache Method | TTL | Notes |
|-------------|--------------|-----|-------|
| Market History | `"use cache"` + `cacheLife('hours')` | 1 hour revalidate | Supabase RPC, updated daily via cron |
| Jita Prices | `"use cache"` + `cacheLife('minutes')` | 5 min stale, 1 min revalidate | ESI regional orders |
| Structure Orders | In-memory | 5 minutes | Requires auth token, cached per-request |

### How Caching Works

The cached data functions in `lib/cached-data.ts` use Next.js 16's `"use cache"` directive:

```ts
export async function getCachedJitaPrices(typeIds: number[]) {
  'use cache'
  cacheLife('minutes')
  // ... fetch from ESI
}
```

- **Cache keys** are generated from function arguments (type IDs are sorted for consistency)
- **Revalidation** happens in the background after TTL expires
- **Serverless note**: On Vercel, cache is in-memory per instance; data refetches on cold starts

See [Caching Strategy](../caching.md) for full documentation.

---

## Performance

Typical response times:
- **Cold cache**: 1-2 minutes (first request, fetching all Jita prices from ESI)
- **Warm cache**: 5-10 seconds (subsequent requests within cache TTL)
- **Repeated requests**: Near-instant (served from cache)

The analysis processes ~5,800 tradeable items.

---

## Streaming Mode (SSE)

Add `stream=true` to enable Server-Sent Events for real-time progress updates.

**Example Request:**
```bash
curl -N "http://localhost:3000/api/market-seeder/analyze?structure_id=1051567430261&stream=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**SSE Events:**

| Event | Description |
|-------|-------------|
| `progress` | Progress update with stage, message, and percent |
| `complete` | Final results (same format as JSON response) |
| `error` | Error message if analysis fails |

**Progress Event Example:**
```
event: progress
data: {"stage":"jita_prices","message":"Fetching Jita prices... 150/292 batches","percent":75}
```

**Progress Stages:**

| Stage | Percent Range | Description |
|-------|---------------|-------------|
| loading | 0-5% | Loading tradeable items from file |
| market_history | 10-35% | Fetching market stats via RPC batches |
| structure_orders | 40-45% | Fetching structure orders from ESI |
| jita_prices | 50-85% | Fetching current Jita prices from ESI |
| analyzing | 88-90% | Analyzing profit opportunities |
| filtering | 90-92% | Applying minimum filters |
| scoring | 92-95% | Calculating composite scores |
| ranking | 95-100% | Generating ranked lists |

**Frontend Usage:**
```typescript
const response = await fetch(`/api/market-seeder/analyze?stream=true&...`, {
  headers: { Authorization: `Bearer ${token}` }
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  // Parse SSE events from chunk
  const text = decoder.decode(value)
  // Process event: and data: lines
}
```

---

## GET /api/market-seeder/market-data

Lightweight endpoint to fetch Jita market data for specific type IDs. Used by the Stock Depletion Predictor.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type_ids | string | Yes | Comma-separated list of type IDs (max 500) |

**Example Request:**

```bash
curl "http://localhost:3000/api/market-seeder/market-data?type_ids=2048,3170,11269"
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "2048": {
      "avgDailyVolume": 2500,
      "totalVolume30d": 75000,
      "avgPrice": 450000,
      "jitaSellPrice": 425000
    },
    "3170": {
      "avgDailyVolume": 1200,
      "totalVolume30d": 36000,
      "avgPrice": 320000,
      "jitaSellPrice": 315000
    }
  },
  "typeCount": 2,
  "fetchedAt": "2025-12-11T12:00:00Z"
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| avgDailyVolume | Average units traded per day in Jita (30-day) |
| totalVolume30d | Total units traded in last 30 days |
| avgPrice | Average transaction price (30-day) |
| jitaSellPrice | Current lowest sell price in Jita (null if no orders) |

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Missing or invalid type_ids parameter |
| 500 | Server error fetching market data |

---

## Related Files

- `app/api/market-seeder/analyze/route.ts` - API endpoint with SSE streaming support
- `app/api/market-seeder/market-data/route.ts` - Lightweight market data endpoint for depletion predictor
- `lib/market-seeder.ts` - Core algorithm with progress callbacks
- `types/market-seeder.ts` - TypeScript interfaces
- `data/tradeable-items.jsonl` - Item catalog (~5,800 items)
- `migrations/008_market_seeder_statistics.sql` - RPC function for efficient market history queries
- `app/market-seeder/page.tsx` - Frontend UI with progress bar

## Data Sources

### Market History (RPC-based)

Uses the `get_market_seeder_statistics` PostgreSQL function to efficiently query market history.
Processes ~5,800 items in batches of 200 to avoid Supabase's 1000-row limit.

**Vale of the Silent** (region 10000015) is used for demand estimation with a **20% hub factor**.

```sql
-- Example RPC call for Vale demand data
SELECT * FROM get_market_seeder_statistics(
  ARRAY[34, 35, 36]::BIGINT[],  -- type_ids
  10000015,                       -- region_id (Vale of the Silent)
  30                              -- days_back
);
```

### Jita Prices (ESI Regional Orders)

Fetches lowest sell prices from ESI's public market orders endpoint:
```
GET /markets/{region_id}/orders/?type_id={type_id}&order_type=sell
```

Processes items with 20 concurrent requests to respect ESI rate limits.

---

## See Also

- [ESI Proxy API](./esi.md) - Structure orders and market history endpoints
- [Database Schema](../database/schema.md) - `market_history` table

