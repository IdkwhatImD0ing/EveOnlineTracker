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

## Related Files

- `app/api/esi/keepstar-3t7/route.ts` - Keepstar search implementation
- `app/api/esi/structure-orders/route.ts` - Structure orders implementation

## See Also

- [EVE ESI Documentation](https://esi.evetech.net/ui/)
- [EVE Developers Portal](https://developers.eveonline.com/)

