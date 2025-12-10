# ESI Proxy API

Proxy endpoints for EVE ESI (EVE Swagger Interface) that require authentication.

## Overview

These endpoints wrap EVE's official ESI API, handling authentication and providing processed responses. All endpoints require a valid EVE SSO access token.

## Authentication

All ESI proxy endpoints require the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Obtain access tokens via the [Authentication API](./auth.md).

---

## Endpoints

### GET /api/esi/keepstar-3t7

Searches for structures and returns the 3T7-M8 Keepstar structure details.

**Required Scopes:**
- `esi-search.search_structures.v1`
- `esi-universe.read_structures.v1`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| character_id | integer | Yes | - | Your character ID for the search |
| search | string | No | "3T7" | Search term (minimum 3 characters) |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token from EVE SSO |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/esi/keepstar-3t7?character_id=123456789&search=3T7-M8" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200) - Keepstar Found:**
```json
{
  "structure_id": 1051567430261,
  "name": "3T7-M8 - Goonswarm Keepstar",
  "type_id": 35834,
  "type_name": "Keepstar",
  "solar_system_id": 30002938,
  "solar_system_name": "3T7-M8",
  "owner_id": 1354830081
}
```

**Response - No Keepstar Found:**
```json
{
  "error": "No Keepstar found in 3T7-M8",
  "character_id_used": "123456789",
  "search_term": "3T7",
  "hint": "Showing all structures found matching \"3T7\". Looking for type_id=35834 and solar_system_id=30002938. HTTP 401 means no docking access.",
  "expected": {
    "type_id": 35834,
    "solar_system_id": 30002938
  },
  "structures_found": [
    {
      "structure_id": 1051567430261,
      "name": "Some Structure",
      "type_id": 35832,
      "solar_system_id": 30002938
    }
  ]
}
```

**Error Responses:**

*Missing character_id (400):*
```json
{
  "error": "character_id is required"
}
```

*Missing authorization (401):*
```json
{
  "error": "Authorization header required. Login with EVE SSO first (requires esi-search.search_structures.v1 scope)."
}
```

**Implementation Notes:**
- Searches for structures matching the search term
- Filters results for Keepstars (type_id: 35834) in 3T7-M8 (solar_system_id: 30002938)
- Returns all found structures if no Keepstar matches criteria

---

### GET /api/esi/structure-orders

Fetches market orders from a player-owned structure and returns the top 5 most expensive items.

**Required Scopes:**
- `esi-markets.structure_markets.v1`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| structure_id | integer | Yes | - | The structure ID to fetch orders from |
| buy_orders | boolean | No | false | Set to "true" for buy orders, otherwise returns sell orders |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token from EVE SSO |

**Example Request:**
```bash
# Get top 5 most expensive sell orders
curl -X GET "http://localhost:3000/api/esi/structure-orders?structure_id=1051567430261" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get top 5 most expensive buy orders
curl -X GET "http://localhost:3000/api/esi/structure-orders?structure_id=1051567430261&buy_orders=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200):**
```json
{
  "structure_id": "1051567430261",
  "order_type": "sell",
  "total_orders": 1523,
  "total_pages_fetched": 2,
  "top_5_most_expensive": [
    {
      "rank": 1,
      "order_id": 6741234567,
      "type_id": 23773,
      "type_name": "Molok",
      "price": 450000000000,
      "price_formatted": "450.00B ISK",
      "volume_remain": 1,
      "volume_total": 1,
      "total_value": 450000000000,
      "total_value_formatted": "450.00B ISK",
      "is_buy_order": false,
      "issued": "2024-01-15T10:30:00Z",
      "duration": 90,
      "min_volume": 1,
      "range": "station"
    },
    {
      "rank": 2,
      "order_id": 6741234568,
      "type_id": 42241,
      "type_name": "Vanquisher",
      "price": 380000000000,
      "price_formatted": "380.00B ISK",
      "volume_remain": 1,
      "volume_total": 1,
      "total_value": 380000000000,
      "total_value_formatted": "380.00B ISK",
      "is_buy_order": false,
      "issued": "2024-01-14T15:45:00Z",
      "duration": 90,
      "min_volume": 1,
      "range": "station"
    }
  ],
  "summary": {
    "highest_price": 450000000000,
    "highest_price_formatted": "450.00B ISK",
    "items": ["Molok", "Vanquisher", "Komodo", "Avatar", "Erebus"]
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| structure_id | string | The queried structure ID |
| order_type | string | "buy" or "sell" |
| total_orders | number | Total orders of this type in the structure |
| total_pages_fetched | number | Number of ESI pages retrieved |
| top_5_most_expensive | array | Top 5 orders by unit price |
| summary | object | Quick summary of results |

**Order Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| rank | number | Ranking (1-5) |
| order_id | number | Unique order ID |
| type_id | number | EVE type ID of the item |
| type_name | string | Human-readable item name |
| price | number | Price per unit in ISK |
| price_formatted | string | Human-readable price |
| volume_remain | number | Units remaining |
| volume_total | number | Original order quantity |
| total_value | number | price × volume_remain |
| total_value_formatted | string | Human-readable total value |
| is_buy_order | boolean | True for buy orders |
| issued | string | ISO timestamp when order was created |
| duration | number | Order duration in days |
| min_volume | number | Minimum fill quantity |
| range | string | Order range |

**Error Responses:**

*Missing structure_id (400):*
```json
{
  "error": "structure_id is required"
}
```

*Missing authorization (401):*
```json
{
  "error": "Authorization header required. Login with EVE SSO first (requires esi-markets.structure_markets.v1 scope)."
}
```

*ESI Error (various):*
```json
{
  "error": "ESI Error: 403",
  "details": "Forbidden - you don't have docking access to this structure"
}
```

**Implementation Notes:**
- Fetches all pages of market orders (handles ESI pagination)
- Filters by order type (buy/sell) based on query parameter
- Sorts by unit price descending
- Fetches type names from ESI for the top 5 items
- Formats ISK values with appropriate suffixes (K, M, B, T)

---

### GET /api/esi/character-assets

Fetches all assets for the authenticated character, aggregated by item type.

**Required Scopes:**
- `esi-assets.read_assets.v1`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| include_blueprints | boolean | No | false | Include blueprint copies in results |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token from EVE SSO |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/esi/character-assets" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200):**
```json
{
  "character_id": 123456789,
  "total_unique_types": 245,
  "total_items": 1523,
  "pages_fetched": 2,
  "assets": [
    {
      "type_id": 34,
      "type_name": "Tritanium",
      "total_quantity": 50000000,
      "locations": 3
    },
    {
      "type_id": 35,
      "type_name": "Pyerite",
      "total_quantity": 25000000,
      "locations": 2
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| character_id | number | The authenticated character's ID |
| total_unique_types | number | Number of unique item types |
| total_items | number | Total individual asset entries |
| pages_fetched | number | Number of ESI pages retrieved |
| assets | array | Aggregated assets by type |

**Asset Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| type_id | number | EVE type ID |
| type_name | string | Human-readable item name |
| total_quantity | number | Total quantity across all locations |
| locations | number | Number of unique locations |
| is_blueprint_copy | boolean | True if item is a blueprint copy (only if include_blueprints=true) |

**Error Responses:**

*Missing authorization (401):*
```json
{
  "error": "Authorization header required. Login with EVE SSO first (requires esi-assets.read_assets.v1 scope)."
}
```

*Invalid token (401):*
```json
{
  "error": "Invalid access token - could not extract character ID"
}
```

**Implementation Notes:**
- Fetches all pages of assets from ESI in parallel
- Aggregates assets by type_id, summing quantities
- Resolves type names from local `data/inv-types.json`
- Blueprint copies are excluded by default (set `include_blueprints=true` to include)
- Sorted by total quantity descending

---

## ISK Formatting

The API formats ISK values using these suffixes:

| Suffix | Value | Example |
|--------|-------|---------|
| T | Trillion | 450.00T ISK |
| B | Billion | 1.50B ISK |
| M | Million | 250.00M ISK |
| K | Thousand | 500.00K ISK |
| (none) | Below 1000 | 750.00 ISK |

---

### GET /api/esi/market-history

Fetches historical market statistics for all tradeable items (ships, modules, ammo, boosters) from ESI and stores in Supabase. Supports multiple modes for initial data population and daily updates.

**Authentication:** None required (ESI market history is public)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| mode | string | No | legacy | Fetch mode: `initial`, `daily`, or `legacy` |
| days | integer | No | 365 | Days to fetch for `initial` mode |
| region_id | integer | No | 10000002 | EVE region ID (The Forge = Jita) |
| limit | integer | No | - | Limit items to process (for testing) |

**Modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| `initial` | Fetch last N days (default 365) | One-time data population |
| `daily` | Fetch only yesterday's data | Daily cron job (efficient append) |
| `legacy` | Fetch last 7 days | Original behavior (backward compatibility) |

**Example Requests:**
```bash
# Initial population (365 days of history)
curl -X GET "http://localhost:3000/api/esi/market-history?mode=initial"

# Initial with custom days
curl -X GET "http://localhost:3000/api/esi/market-history?mode=initial&days=180"

# Daily update (yesterday only)
curl -X GET "http://localhost:3000/api/esi/market-history?mode=daily"

# Legacy mode (last 7 days)
curl -X GET "http://localhost:3000/api/esi/market-history?mode=legacy"

# Limited batch for testing
curl -X GET "http://localhost:3000/api/esi/market-history?mode=daily&limit=100"
```

**Success Response (200):**
```json
{
  "success": true,
  "mode": "daily",
  "mode_description": "daily (2025-12-09 only)",
  "summary": {
    "total_items": 5841,
    "successful_fetches": 2569,
    "failed_fetches": 3272,
    "items_with_market_data": 2157,
    "total_rows": 2157,
    "rows_inserted": 2157
  },
  "timing": {
    "esi_fetch_ms": 40987,
    "supabase_upsert_ms": 502,
    "total_ms": 41490
  },
  "config": {
    "region_id": 10000002,
    "concurrent_requests": 50,
    "date_from": "2025-12-09",
    "date_to": "2025-12-09"
  },
  "errors": {
    "esi_failures": [
      {"typeId": 22921, "success": false, "entries": 0, "error": "HTTP 400"}
    ],
    "supabase_errors": []
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| mode | string | The mode used for this fetch |
| mode_description | string | Human-readable mode description |
| summary.total_items | number | Total tradeable items processed |
| summary.successful_fetches | number | Items successfully fetched from ESI |
| summary.failed_fetches | number | Items that failed (usually no market data) |
| summary.items_with_market_data | number | Items with data in the date range |
| summary.total_rows | number | Total market history rows generated |
| summary.rows_inserted | number | Rows upserted to Supabase |
| timing.esi_fetch_ms | number | Time spent fetching from ESI |
| timing.supabase_upsert_ms | number | Time spent upserting to database |
| timing.total_ms | number | Total processing time |
| config.region_id | number | Region ID used |
| config.concurrent_requests | number | Parallel request count |
| config.date_from | string | Start date of fetch range |
| config.date_to | string | End date (or "today" for range modes) |
| errors.esi_failures | array | First 10 ESI failures (for debugging) |
| errors.supabase_errors | array | Database errors if any |

**Implementation Notes:**
- Reads items from `data/tradeable-items.jsonl` (ships, modules, ammo, boosters)
- Fetches ESI market history with 50 concurrent requests
- `initial` mode: Fetches last 365 days for full historical data
- `daily` mode: Fetches only yesterday (single day append - efficient)
- Upserts to Supabase `market_history` table (ON CONFLICT replace)
- Failed fetches are normal - many items have no regional market data

**Vercel Cron:**
```json
{
  "crons": [
    {
      "path": "/api/esi/market-history?mode=daily",
      "schedule": "0 12 * * *"
    }
  ]
}
```
Runs daily at 12:00 UTC to append yesterday's data.

**Setup Workflow:**
1. Run `?mode=initial` once to populate 365 days of history
2. Daily cron job runs `?mode=daily` to append new data
3. Historical data grows over time (no data is deleted)

---

### GET /api/esi/market-history-test

Test endpoint to fetch market history for a single item. Useful for validating the integration.

**Authentication:** None required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| type_id | integer | No | 34 | EVE type ID (34 = Tritanium) |
| region_id | integer | No | 10000002 | EVE region ID |

**Example Request:**
```bash
# Default: Tritanium
curl -X GET "http://localhost:3000/api/esi/market-history-test"

# Specific item: Rifter
curl -X GET "http://localhost:3000/api/esi/market-history-test?type_id=587"
```

**Success Response (200):**
```json
{
  "success": true,
  "type_id": 34,
  "region_id": 10000002,
  "entries_fetched": 403,
  "entries_stored": 7,
  "date_range": {
    "from": "2025-12-02",
    "to": "2025-12-08"
  },
  "data": [
    {
      "type_id": 34,
      "date": "2025-12-08",
      "average": 3.99,
      "highest": 4.01,
      "lowest": 3.94,
      "order_count": 2106,
      "volume": 7126308159,
      "region_id": 10000002,
      "updated_at": "2025-12-09T12:14:56.461+00:00"
    }
  ],
  "summary": {
    "avg_price": 3.99,
    "total_volume": 43106712580,
    "total_orders": 16878
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| type_id | number | The queried item type ID |
| region_id | number | The queried region ID |
| entries_fetched | number | Total history entries from ESI |
| entries_stored | number | Entries within last 7 days |
| date_range | object | Start and end dates of stored data |
| data | array | The actual market history entries |
| summary | object | Aggregated statistics |

**Error Response - No Market Data:**
```json
{
  "message": "No market history in the last 7 days for this item",
  "type_id": 12345,
  "region_id": 10000002,
  "total_history_entries": 50,
  "oldest_entry": "2024-01-01",
  "newest_entry": "2024-06-15"
}
```

---

---

### POST /api/sell-opportunities

Analyzes character assets against historical market data to identify optimal sell opportunities. Compares current Jita sell prices to all-time high prices.

**Authentication:** None required (but requires asset data from authenticated endpoint)

**Request Body:**
```json
{
  "assets": [
    { "type_id": 34, "type_name": "Tritanium", "quantity": 1000000 },
    { "type_id": 35, "type_name": "Pyerite", "quantity": 500000 }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assets | array | Yes | Array of assets to analyze |
| assets[].type_id | number | Yes | EVE type ID |
| assets[].type_name | string | Yes | Item name (used for Janice API lookup) |
| assets[].quantity | number | Yes | Quantity owned |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/sell-opportunities" \
  -H "Content-Type: application/json" \
  -d '{"assets":[{"type_id":34,"type_name":"Tritanium","quantity":1000000}]}'
```

**Success Response (200):**
```json
{
  "opportunities": [
    {
      "type_id": 34,
      "type_name": "Tritanium",
      "quantity": 1000000,
      "current_sell_price": 5.85,
      "all_time_high": 6.50,
      "percent_of_ath": 90,
      "total_value": 5850000,
      "recommendation": "sell",
      "recommendation_text": "Good time to sell - near all-time high"
    }
  ],
  "summary": {
    "total_items": 1,
    "sell_now_count": 1,
    "hold_count": 0,
    "wait_count": 0,
    "total_value": 5850000,
    "sell_now_value": 5850000,
    "items_with_ath_data": 1
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| opportunities | array | Analyzed items sorted by % of ATH (descending) |
| summary.total_items | number | Total items analyzed |
| summary.sell_now_count | number | Items with "sell" recommendation |
| summary.hold_count | number | Items with "hold" recommendation |
| summary.wait_count | number | Items with "wait" recommendation |
| summary.total_value | number | Total ISK value of all items |
| summary.sell_now_value | number | ISK value of items recommended to sell |
| summary.items_with_ath_data | number | Items with historical ATH data |

**Opportunity Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| type_id | number | EVE type ID |
| type_name | string | Item name |
| quantity | number | Quantity owned |
| current_sell_price | number | Current Jita sell price per unit |
| all_time_high | number | Highest historical price (from market_history) |
| percent_of_ath | number | Current price as percentage of ATH |
| total_value | number | current_sell_price × quantity |
| recommendation | string | "sell", "hold", or "wait" |
| recommendation_text | string | Human-readable recommendation |

**Recommendation Thresholds:**

| Recommendation | % of ATH | Color | Description |
|----------------|----------|-------|-------------|
| sell | >= 80% | Green | Good time to sell |
| hold | 60-79% | Orange | Consider holding |
| wait | < 60% | Red | Wait for better prices |

**Implementation Notes:**
- Queries `market_history` table for MAX(highest) per type_id
- Gets current Jita sell prices via Janice API
- Items without historical data show 100% if they have a current price
- Results sorted by percent_of_ath descending (best opportunities first)

---

### GET /api/esi/wallet

Fetches character wallet balance from ESI.

**Authentication:** Required (EVE SSO Bearer token)

**Required Scope:** `esi-wallet.read_character_wallet.v1`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| character_id | integer | Yes | Character ID |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token from EVE SSO |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/esi/wallet?character_id=12345678" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200):**
```json
{
  "character_id": "12345678",
  "balance": 1234567890.50,
  "balance_formatted": "1.23B ISK"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| character_id | string | The queried character ID |
| balance | number | Raw ISK balance |
| balance_formatted | string | Human-readable balance with suffix |

---

### GET /api/esi/character-orders

Fetches character market orders from ESI with aggregated statistics.

**Authentication:** Required (EVE SSO Bearer token)

**Required Scope:** `esi-markets.read_character_orders.v1`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| character_id | integer | Yes | Character ID |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token from EVE SSO |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/esi/character-orders?character_id=12345678" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200):**
```json
{
  "character_id": "12345678",
  "total_orders": 25,
  "sell_orders": {
    "count": 20,
    "total_value": 5000000000,
    "total_value_formatted": "5.00B ISK"
  },
  "buy_orders": {
    "count": 5,
    "total_escrow": 100000000,
    "total_escrow_formatted": "100.00M ISK"
  },
  "orders": [
    {
      "order_id": 123456,
      "type_id": 587,
      "is_buy_order": false,
      "price": 1500000,
      "price_formatted": "1.50M ISK",
      "volume_remain": 10,
      "volume_total": 50,
      "location_id": 60003760,
      "issued": "2025-12-01T12:00:00Z",
      "duration": 90
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| character_id | string | The queried character ID |
| total_orders | number | Total active market orders |
| sell_orders.count | number | Number of sell orders |
| sell_orders.total_value | number | Total value of items for sale |
| buy_orders.count | number | Number of buy orders |
| buy_orders.total_escrow | number | Total ISK in escrow |
| orders | array | Individual order details |

---

## Related Files

- `app/api/esi/keepstar-3t7/route.ts` - Keepstar search implementation
- `app/api/esi/structure-orders/route.ts` - Structure orders implementation
- `app/api/esi/character-assets/route.ts` - Character assets implementation
- `app/api/esi/wallet/route.ts` - Character wallet balance
- `app/api/esi/character-orders/route.ts` - Character market orders
- `app/api/sell-opportunities/route.ts` - Sell opportunities analysis
- `app/api/esi/market-history/route.ts` - Market history batch implementation
- `app/api/esi/market-history-test/route.ts` - Market history test implementation
- `data/tradeable-items.jsonl` - Source file for tradeable items
- `vercel.json` - Cron job configuration

## See Also

- [EVE ESI Documentation](https://esi.evetech.net/ui/)
- [EVE Developers Portal](https://developers.eveonline.com/)

