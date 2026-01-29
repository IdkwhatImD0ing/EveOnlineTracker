# Essentials API

API endpoints for managing the nullsec essentials list - pre-curated items for market seeding in Guristas space.

## Overview

The Essentials API manages a hand-curated list of ~140 essential items for nullsec living in Deklein (Guristas space). Unlike the personal Watchlist, this list is admin-managed and visible to all users.

## Endpoints

### GET /api/essentials

Fetches all essential items, optionally with current stock levels from a structure.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| structure_id | string | No | Structure ID to check stock levels |
| volume_region_id | number | No | Region ID for volume data (default: Vale) |
| hub_factor | number | No | Hub factor for demand estimation (default: 0.05) |

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
      "type_id": 17476,
      "item_name": "Ishtar",
      "group_name": "Heavy Assault Cruiser",
      "category_name": "Ship",
      "volume": 118000,
      "created_at": "2025-12-26T12:00:00Z",
      "stock": 0,
      "lowest_price": null,
      "needs_restock": true,
      "estimatedDailySales": 0,
      "daysUntilStockout": null,
      "jitaPrice": null,
      "profitPerUnit": 0,
      "dailyProfit": 0,
      "hasSellOrder": false
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
  "items": [...],
  "structure_id": "1051567430261",
  "checked_at": "2025-12-26T12:00:00Z",
  "summary": {
    "total": 130,
    "needs_restock": 80,
    "in_stock": 50,
    "criticalCount": 50,
    "warningCount": 30,
    "okCount": 50,
    "noDataCount": 0,
    "totalDailyProfit": 500000000
  }
}
```

---

### POST /api/essentials

Adds an item to the essentials list (admin only).

**Required Role:** `admin`

**Request Body:**

```json
{
  "typeId": 17476,
  "itemName": "Ishtar",
  "groupName": "Heavy Assault Cruiser",
  "categoryName": "Ship",
  "volume": 118000
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
    "type_id": 17476,
    "item_name": "Ishtar",
    "group_name": "Heavy Assault Cruiser",
    "category_name": "Ship",
    "volume": 118000,
    "created_at": "2025-12-26T12:00:00Z"
  }
}
```

**Error Response (403 - Not Admin):**

```json
{
  "error": "Admin access required"
}
```

**Error Response (409 - Already Exists):**

```json
{
  "error": "Item already in essentials"
}
```

---

### DELETE /api/essentials/[typeId]

Removes an item from the essentials list by type ID (admin only).

**Required Role:** `admin`

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| typeId | number | EVE type ID of item to remove |

**Success Response (200):**

```json
{
  "success": true,
  "removed_type_id": 17476
}
```

**Error Response (403 - Not Admin):**

```json
{
  "error": "Admin access required"
}
```

---

## Database Schema

### essential_items Table

```sql
CREATE TABLE essential_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id bigint NOT NULL UNIQUE,
  item_name text NOT NULL,
  group_name text,
  category_name text,
  volume numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_essential_items_type_id ON essential_items(type_id);
CREATE INDEX idx_essential_items_category ON essential_items(category_name);
```

See [Database Schema](../database/schema.md) for full documentation.

---

## Populating Essentials

Use the provided script to populate the essentials list:

```bash
npx tsx scripts/add-deklein-nullsec-items.ts
```

This script:
1. Contains a hardcoded list of ~140 essential type IDs
2. Looks up item details from `data/tradeable-items.jsonl`
3. Upserts into the `essential_items` table

The script can be run multiple times safely - it uses upsert to avoid duplicates.

**Curated Items Include:**
- 33 ships (ratting, ALL mining barges/exhumers, T3 cruisers, T2 haulers, utility, PvP)
- 48 T3 subsystems (all Tengu, Legion, Proteus, Loki subsystems)
- 12 drones (kinetic, thermal, mining, salvage)
- ~40 modules (drone mods, T1/T2 mining equipment, shields, propulsion)
- Exploration gear, kinetic ammo, and essential rigs

---

## Related Files

- `app/api/essentials/route.ts` - GET/POST endpoints
- `app/api/essentials/[typeId]/route.ts` - DELETE endpoint
- `components/market-seeder/essentials-tab.tsx` - UI component
- `scripts/add-deklein-nullsec-items.ts` - Population script
- `migrations/014_essential_items.sql` - Database migration

---

## See Also

- [Market Seeder Page](../pages/market-seeder.md) - Full page documentation
- [Watchlist API](./watchlist.md) - Personal watchlist API
- [ESI API](./esi.md) - Structure orders endpoint

