# EVE Online SDE Data Scripts

This directory contains scripts for downloading and processing EVE Online Static Data Export (SDE) data.

## Overview

The industry calculator uses data from the EVE SDE to look up blueprints, materials, item names, and solar systems. This data needs to be updated periodically when CCP releases new game patches.

## Data Source

Data is downloaded from [Fuzzwork's SDE dump](https://www.fuzzwork.co.uk/dump/), which provides MySQL/CSV conversions of the official EVE SDE.

## Scripts

### `download-sde.ts`

Downloads and processes the following data from Fuzzwork:

| CSV File | Output JSON | Description |
|----------|-------------|-------------|
| `invTypes.csv` | `inv-types.json` | Item type names and volumes (~50k types) |
| `invGroups.csv` | `inv-groups.json` | Item group categories |
| `industryActivityMaterials.csv` | `blueprints.json` | Blueprint material requirements |
| `industryActivityProducts.csv` | `blueprints-by-product.json` | Product to blueprint mapping |
| `industryActivity.csv` | (merged into blueprints) | Manufacturing/reaction times |
| `mapSolarSystems.csv` | `solar-systems.json` | All solar systems (~8400 systems) |

Also generates:
- `blueprint-search.json` - Lightweight blueprint data for search autocomplete

### `setup-cron-jobs.ts`

Creates cron jobs on [cron-job.org](https://cron-job.org) for automated market history updates.

**Usage:**
```bash
# Create all 48 cron jobs
npx tsx scripts/setup-cron-jobs.ts

# List existing jobs
npx tsx scripts/setup-cron-jobs.ts --list

# Delete all jobs and recreate
npx tsx scripts/setup-cron-jobs.ts --delete
```

**Required Environment Variables:**
- `CRONJOB_API_KEY` - Your cron-job.org API key
- `CRON_SECRET` - The secret used to authenticate cron requests
- `VERCEL_URL` - Your deployed Vercel app URL

**Jobs Created:**
| Region | Jobs | Schedule |
|--------|------|----------|
| The Forge (Jita) | 20 | :00 hourly (hours 0-19) |
| Vale of the Silent | 20 | :20 hourly (hours 0-19) |
| Deklein | 8 | :40 every 3h |

### `extract-item-types.ts`

Extracts tradeable item types from EVE Online JSONL static data files.

**Usage:**
```bash
# Using default input folder
npx tsx scripts/extract-item-types.ts

# With custom input folder
npx tsx scripts/extract-item-types.ts "C:\path\to\eve-static-data-jsonl"
```

**Input:** JSONL files from [EVE Online Static Data](https://data.everef.net/):
- `types.jsonl` - All item types
- `groups.jsonl` - Item group definitions

**Output:** `data/tradeable-items.jsonl` - Filtered items containing:
| Category | Filter |
|----------|--------|
| Ships | Category ID 6 |
| Modules | Category ID 7 |
| Charges (Ammo) | Category ID 8 |
| Drones | Category ID 18 |
| Implants & Boosters | Category ID 20 |
| Deployables | Category ID 22 |
| Subsystems | Category ID 32 |
| Fighters | Category ID 87 |

**Output format (JSONL):**
```json
{"typeId":587,"name":"Rifter","groupId":25,"groupName":"Frigate","categoryId":6,"categoryName":"Ship","volume":27289,"marketGroupId":64}
```

## Usage

### Update SDE Data

When a new EVE expansion or patch is released:

```bash
# From project root
pnpm run update-sde

# Or directly with tsx
npx tsx scripts/download-sde.ts
```

This will:
1. Download latest CSV files from Fuzzwork
2. Process and transform the data
3. Save JSON files to `/data/` directory

### When to Update

Update the SDE data when:
- New items or blueprints are added to EVE
- Blueprint requirements change
- New solar systems are added (rare)
- After major EVE expansions

Check the [Fuzzwork dump page](https://www.fuzzwork.co.uk/dump/) for the latest SDE version date.

## Output Files

### Server-side data (`/data/`)

| File | Size | Description |
|------|------|-------------|
| `blueprints.json` | ~3MB | Full blueprint data with materials |
| `blueprints-by-product.json` | ~86KB | Product ID → Blueprint ID mapping |
| `blueprint-search.json` | ~800KB | Simplified blueprint list for search |
| `inv-types.json` | ~1.3MB | All item types with names |
| `inv-groups.json` | ~120KB | Item group definitions |
| `solar-systems.json` | ~300KB | All solar systems with security status |
| `structures.json` | ~1KB | Structure/rig bonuses (manually maintained) |
| `tradeable-items.jsonl` | ~700KB | Ships, modules, ammo, boosters (JSONL) |

### Client-side data (`/public/`)

| File | Description |
|------|-------------|
| `solar-systems.json` | Copy of solar systems for browser-side search |

The script automatically copies `solar-systems.json` to `/public/` for client-side access.

## Structure Bonuses

The `structures.json` file is **manually maintained** and contains:
- Industry structure bonuses (Raitaru, Azbel, Sotiyo)
- Reaction structure bonuses (Athanor, Tatara)
- Rig bonuses (T1, T2)
- Security multipliers
- Default component ME/TE (10/20)

Update this file if CCP changes structure or rig bonuses.

## External APIs

The industry calculator also uses:

### eve-industry.org API
- System cost indices: `http://api.eve-industry.org/system-cost-index.xml?name=Jita`
- Job base costs: `http://api.eve-industry.org/job-base-cost.xml?ids=1234,5678`

### Janice API
- Item pricing (requires API key in `JANICE_API_KEY` env var)

### EVE ESI Market History API

The `/api/esi/market-history` endpoint fetches historical market data from ESI.

**Batch Endpoint (Production):**
```bash
# Fetch all 5,841 tradeable items
GET /api/esi/market-history

# With limit for testing
GET /api/esi/market-history?limit=100
```

**Test Endpoint (Single Item):**
```bash
# Default: Tritanium (type_id=34)
GET /api/esi/market-history-test

# Specific item
GET /api/esi/market-history-test?type_id=587
```

**Cron Schedule (via cron-job.org):**
- 48 jobs run daily across 3 regions
- Configured via `scripts/setup-cron-jobs.ts`
- See `docs/api/esi.md` for full schedule details

**Database Table:** `market_history`
- Stores last 7 days of price history per item
- Region: The Forge (10000002) - Jita
- Updated via upsert (ON CONFLICT replace)

## Troubleshooting

### Download fails with 403
Fuzzwork may block requests without a User-Agent header. The script includes a proper User-Agent.

### Missing item names
Some items may show as "Unknown" if they're not in the published types. The script includes all types (published and unpublished) to handle blueprint materials.

### Build fails after SDE update
If TypeScript types don't match the new JSON structure, check for schema changes in the SDE and update type definitions in `/lib/blueprints.ts`.

