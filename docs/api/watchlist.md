# Watchlist API

API endpoints for managing the market watchlist - tracking specific items and checking their stock levels in the alliance structure.

## Overview

The Watchlist API allows you to:
1. Add items to a persistent watchlist
2. Remove items from the watchlist
3. Check current stock levels from a structure

## Endpoints

### GET /api/watchlist

Fetches all watchlist items, optionally with current stock levels from a structure.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| structure_id | string | No | Structure ID to check stock levels |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Conditional | Bearer token from EVE SSO. Required if structure_id is provided |

**Response (without structure_id):**

```json
{
  "success": true,
  "items": [
    {
      "id": "uuid",
      "type_id": 2048,
      "item_name": "Damage Control II",
      "group_name": "Damage Control",
      "category_name": "Module",
      "volume": 5,
      "created_at": "2025-12-10T12:00:00Z",
      "stock": 0,
      "lowest_price": null,
      "needs_restock": true
    }
  ],
  "structure_id": null,
  "checked_at": null
}
```

**Response (with structure_id):**

```json
{
  "success": true,
  "items": [
    {
      "id": "uuid",
      "type_id": 2048,
      "item_name": "Damage Control II",
      "group_name": "Damage Control",
      "category_name": "Module",
      "volume": 5,
      "created_at": "2025-12-10T12:00:00Z",
      "stock": 150,
      "lowest_price": 625000,
      "needs_restock": false
    },
    {
      "id": "uuid",
      "type_id": 3170,
      "item_name": "Medium Shield Extender II",
      "group_name": "Shield Extender",
      "category_name": "Module",
      "volume": 5,
      "created_at": "2025-12-10T12:00:00Z",
      "stock": 0,
      "lowest_price": null,
      "needs_restock": true
    }
  ],
  "structure_id": "1051567430261",
  "checked_at": "2025-12-10T12:00:00Z",
  "summary": {
    "total": 2,
    "needs_restock": 1,
    "in_stock": 1
  }
}
```

**Notes:**
- Items are sorted with `needs_restock: true` items first, then alphabetically
- `stock` represents total volume of all sell orders for that item
- `lowest_price` is the lowest sell order price for that item

---

### POST /api/watchlist

Adds an item to the watchlist.

**Request Body:**

```json
{
  "typeId": 2048,
  "itemName": "Damage Control II",
  "groupName": "Damage Control",
  "categoryName": "Module",
  "volume": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| typeId | number | Yes | EVE type ID |
| itemName | string | Yes | Display name |
| groupName | string | No | Item group |
| categoryName | string | No | Item category |
| volume | number | No | Volume per unit (m³) |

**Success Response (200):**

```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "type_id": 2048,
    "item_name": "Damage Control II",
    "group_name": "Damage Control",
    "category_name": "Module",
    "volume": 5,
    "created_at": "2025-12-10T12:00:00Z"
  }
}
```

**Error Response (409 - Already Exists):**

```json
{
  "error": "Item already in watchlist"
}
```

---

### DELETE /api/watchlist/[typeId]

Removes an item from the watchlist by type ID.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| typeId | number | EVE type ID of item to remove |

**Success Response (200):**

```json
{
  "success": true,
  "removed_type_id": 2048
}
```

---

## Item Search API

### GET /api/items/search

Searches tradeable items for the autocomplete feature.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query (minimum 2 characters) |
| limit | number | No | Max results (default: 20, max: 50) |

**Response:**

```json
[
  {
    "typeId": 2048,
    "name": "Damage Control II",
    "groupId": 60,
    "groupName": "Damage Control",
    "categoryId": 7,
    "categoryName": "Module",
    "volume": 5,
    "marketGroupId": 615
  }
]
```

---

## Database Schema

### watchlist_items Table

```sql
CREATE TABLE watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id bigint NOT NULL UNIQUE,
  item_name text NOT NULL,
  group_name text,
  category_name text,
  volume numeric,
  created_at timestamptz DEFAULT now()
);
```

See [Database Schema](../database/schema.md) for full documentation.

---

## Related Files

- `app/api/watchlist/route.ts` - GET/POST endpoints
- `app/api/watchlist/[typeId]/route.ts` - DELETE endpoint
- `app/api/items/search/route.ts` - Item search endpoint
- `components/market/item-search.tsx` - Autocomplete component
- `app/market-seeder/page.tsx` - Watchlist tab UI
- `migrations/009_watchlist.sql` - Database migration

---

## See Also

- [Market Seeder Page](../pages/market-seeder.md) - Full page documentation
- [ESI API](./esi.md) - Structure orders endpoint

