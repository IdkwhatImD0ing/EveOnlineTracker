# Public Market Seeding (Fit Availability)

Check alliance fit availability at the 3T7-M8 Keepstar market.

## Overview

**Path:** `/public-market-seeding`

**Purpose:** Display how many complete alliance fits can be purchased from the 3T7 market, helping members identify which doctrine ships are available. The minimum requirement is **5 fits** on market for each doctrine.

## Access

- **Required Role:** `slyce` or higher (slyce, user, pro, admin)
- **Navigation:** Sidebar → Fit Availability

## Features

### Fit Availability Display

Each stored alliance fit is checked against 3T7 market sell orders to calculate how many complete fits can be purchased.

**Status Indicators:**

| Status | Available Fits | Color | Meaning |
|--------|---------------|-------|---------|
| Well Stocked | ≥ 10 | Green | Healthy stock levels |
| Low Stock | 5-9 | Orange | Minimum met, needs restocking |
| Critical | < 5 | Red | Below minimum requirement |

### Summary Cards

The page header shows clickable summary statistics:

- **Total Fits**: Number of alliance fits configured
- **Well Stocked**: Fits with ≥ 10 available (click to filter)
- **Low Stock**: Fits with 5-9 available (click to filter)
- **Critical**: Fits with < 5 available (click to filter)

Clicking a status card filters the list to show only fits with that status.

### Filtering

The page provides multiple filtering options:

| Filter | Description |
|--------|-------------|
| **Search** | Text search by ship name or fit name |
| **Status** | Filter by availability status (Critical/Low Stock/Well Stocked) |
| **Ship Type** | Filter by specific ship type |

A "Clear filters" button appears when any filter is active.

### Sorting

Sort the fits list by:

| Sort Option | Description |
|-------------|-------------|
| Availability (Low → High) | Default - shows critical fits first |
| Availability (High → Low) | Shows well-stocked fits first |
| Ship Name (A → Z) | Alphabetical by ship |
| Ship Name (Z → A) | Reverse alphabetical by ship |
| Fit Name (A → Z) | Alphabetical by fit name |
| Stock Percentage | By percentage of items in stock |

### Fit Cards

Each fit displays:

- Ship icon with ring border
- Ship name and fit name
- **Progress bar** showing items in stock percentage
- Items in stock vs total items count
- Availability badge with count (pulses for critical items)

### Expandable Details

Click a fit to reveal limiting factors:

- **Limiting Items**: Top 5 items with lowest availability
- Per-item breakdown showing:
  - Item icon and name
  - Progress bar for item availability
  - Quantity required per fit
  - Current market stock (formatted with locale)
  - Maximum fits possible from that item (color-coded badge)

## Calculation Logic

For each fit, the system calculates:

```
fitAvailability = MIN(floor(marketStock[item.type_id] / item.quantity)) 
                  for each item in fit (including ship hull)
```

**Example:**
- A fit requires 4x Heat Sink II (100 in stock) → 25 fits
- A fit requires 1x Redeemer (8 in stock) → 8 fits
- **Result:** 8 fits available (limited by hull)

### Item Aggregation

Items appearing multiple times in a fit (e.g., same module in multiple slots) are aggregated:

- 4x Heat Sink II in low slots → requires 4 per fit
- Market has 100 → can make 25 fits from this item

The ship hull is automatically included with quantity 1.

## API Endpoint

### GET /api/fits-availability

Returns all alliance fits with their market availability.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| structure_id | string | 1051567430261 | Structure to check orders from |

**Response:**

```json
{
  "fits": [
    {
      "id": "uuid",
      "ship_type_id": 17736,
      "ship_name": "Redeemer",
      "fit_name": "SLYCE Defender BOFF 2023",
      "available_count": 8,
      "status": "orange",
      "limiting_items": [
        {
          "type_id": 17736,
          "name": "Redeemer",
          "required": 1,
          "available": 8,
          "max_fits": 8
        }
      ],
      "total_items": 25,
      "items_in_stock": 22
    }
  ],
  "structure_id": "1051567430261",
  "structure_name": "3T7-M8 Keepstar",
  "total_fits": 5,
  "updated_at": "2025-01-15T12:00:00.000Z"
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| fits | Array of fit availability objects |
| structure_id | Market structure ID checked |
| structure_name | Human-readable structure name |
| total_fits | Total number of alliance fits |
| updated_at | Timestamp of the analysis |

**Per-Fit Fields:**

| Field | Description |
|-------|-------------|
| id | Fit UUID |
| ship_type_id | EVE type ID of the ship |
| ship_name | Ship name |
| fit_name | Fitting name |
| available_count | How many complete fits can be bought |
| status | green/orange/red based on availability |
| limiting_items | Top 5 items limiting fit availability |
| total_items | Total unique items in fit (including hull) |
| items_in_stock | How many items have > 0 stock |

**Status Thresholds:**

| Status | Condition |
|--------|-----------|
| green | available_count ≥ 10 |
| orange | available_count ≥ 5 and < 10 |
| red | available_count < 5 |

## Data Sources

1. **Alliance Fits**: From `alliance_fits` table (managed by admins)
2. **Market Orders**: Real-time from ESI structure markets endpoint

## Requirements

**ESI Scope:** `esi-markets.structure_markets.v1`

The endpoint requires at least one linked character with structure market access.

## Related Pages

- [Alliance Fits](alliance-fits.md) - Admin page for managing fits
- [Market Seeder](market-seeder.md) - Advanced market seeding tools

## Related Files

- `app/(authenticated)/public-market-seeding/page.tsx` - Page component
- `app/api/fits-availability/route.ts` - API endpoint
- `lib/permissions.ts` - Access control configuration
