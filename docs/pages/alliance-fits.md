# Alliance Fits

Admin-only interface for managing alliance ship fittings.

## Overview

The Alliance Fits feature allows administrators to store and manage ship fittings in EFT (EVE Fitting Tool) format. Fits are parsed to resolve item names to EVE type IDs for integration with ESI/market data.

## Access

- **URL:** `/admin/fits`
- **Required Role:** `admin`
- **Navigation:** Admin Dashboard → Alliance Fits

## Features

### Fit Management

- **Add Fit:** Paste an EFT-formatted fit, automatically parsed and stored
- **View Fits:** Table showing all stored fittings with ship type, name, and slot breakdown
- **View Fit Details:** Click on any fit row to open a detail modal showing:
  - Ship icon and fit name header
  - Full EFT text with copy button
  - Items breakdown organized by slot type (High, Mid, Low, Rig, Drone, Cargo)
  - Item icons and quantities
- **Copy EFT:** Copy the original EFT text to clipboard
- **Delete Fit:** Remove a fitting from the database

### EFT Parsing

The parser extracts:

| Field | Description |
|-------|-------------|
| Ship Name | Ship type from header line |
| Fit Name | Fitting name from header line |
| Items | All modules, rigs, drones, cargo with quantities |
| Slot Types | Categorized as high/mid/low/rig/drone/cargo |

### Slot Display

Fits show a slot breakdown with color-coded badges:

- **H** (Red) - High slots
- **M** (Blue) - Mid slots
- **L** (Amber) - Low slots
- **R** (Purple) - Rig slots
- **D** (Green) - Drones

## EFT Format

Standard EFT format is supported:

```
[Ship Name, Fit Name]

Module Name
Module Name
Damage Control II

500MN Microwarpdrive II
Tracking Computer II

Mega Pulse Laser II
Mega Pulse Laser II

Large Trimark Armor Pump I

Warrior II x10
Hobgoblin II x5

Conflagration L x6
Mobile Depot x1
```

### Format Rules

1. First line must be `[Ship Name, Fit Name]`
2. Empty lines separate slot groups
3. Items with quantity use format `Item Name x5`
4. `[Empty * Slot]` lines are ignored

## API Endpoints

### GET /api/admin/fits

Returns all alliance fits.

**Response:**
```json
{
  "fits": [
    {
      "id": "uuid",
      "ship_type_id": 17736,
      "ship_name": "Redeemer",
      "fit_name": "SLYCE Defender BOFF 2023",
      "raw_eft": "[Redeemer, SLYCE Defender...]",
      "items": [...],
      "created_by": "uuid",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/admin/fits

Creates a new alliance fit from EFT text.

**Request Body:**
```json
{
  "raw_eft": "[Redeemer, Fit Name]\n\nHeat Sink II\n..."
}
```

**Response:**
```json
{
  "fit": {
    "id": "uuid",
    "ship_type_id": 17736,
    "ship_name": "Redeemer",
    "fit_name": "Fit Name",
    "raw_eft": "...",
    "items": [
      {"type_id": 2281, "name": "Heat Sink II", "quantity": 1, "slot": "low"}
    ],
    "created_by": "uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "unresolved_items": []
}
```

### DELETE /api/admin/fits?id={uuid}

Deletes an alliance fit.

**Response:**
```json
{
  "success": true
}
```

## Database Schema

```sql
CREATE TABLE alliance_fits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_type_id bigint NOT NULL,
  ship_name text NOT NULL,
  fit_name text NOT NULL,
  raw_eft text NOT NULL,
  items jsonb NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Items JSONB Structure

```json
[
  {
    "type_id": 2281,
    "name": "Heat Sink II",
    "quantity": 1,
    "slot": "low"
  },
  {
    "type_id": 2185,
    "name": "Warrior II",
    "quantity": 10,
    "slot": "drone"
  }
]
```

## Related Files

- `app/(authenticated)/admin/fits/page.tsx` - Fits management UI
- `app/api/admin/fits/route.ts` - CRUD API endpoints
- `lib/eft-parser.ts` - EFT format parser with type resolution
- `types/fits.ts` - TypeScript type definitions
- `migrations/012_alliance_fits.sql` - Database migration

## Type Resolution

The parser uses `data/inv-types.json` (EVE SDE) to resolve item names to type IDs. If an item cannot be resolved:

1. The fit is still created
2. The item is stored with `type_id: null`
3. A warning is shown listing unresolved items

This allows fits with custom/renamed items to still be stored.

