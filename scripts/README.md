# EVE Online SDE Data Scripts

This directory contains scripts for downloading and processing EVE Online Static Data Export (SDE) data.

## Overview

The industry calculator uses data from the EVE SDE to look up blueprints, materials, item names, and solar systems. This data needs to be updated periodically when CCP releases new game patches.

## Data Sources

There are two options for downloading SDE data:

1. **Official CCP SDE** (recommended) - Direct from CCP via `download-official-sde.ts`
2. **Fuzzwork SDE dump** (legacy) - Third-party MySQL/CSV conversion via `download-sde.ts`

## Scripts

### `download-official-sde.ts` (Recommended)

Downloads and processes the official EVE SDE directly from CCP's developer portal.

**Data Source:** [developers.eveonline.com/static-data](https://developers.eveonline.com/static-data/)

**Usage:**
```bash
# Download and process directly to data/
npx tsx scripts/download-official-sde.ts

# Or using npm script
pnpm run update-sde-official
```

**Output:** Files are written directly to `data/` and `public/` (production directories).

| JSONL File | Output JSON | Description |
|------------|-------------|-------------|
| `types.jsonl` | `inv-types.json` | Item type names and volumes (~51k types) |
| `groups.jsonl` | `inv-groups.json` | Item group categories (~1,578 groups) |
| `blueprints.jsonl` | `blueprints.json` | Blueprint material requirements (~4,928 blueprints) |
| `blueprints.jsonl` | `blueprints-by-product.json` | Product to blueprint mapping |
| `blueprints.jsonl` | `blueprint-search.json` | Lightweight blueprint data for search |
| `mapSolarSystems.jsonl` | `solar-systems.json` | All solar systems (~8,437 systems) |
| `types.jsonl` + `groups.jsonl` | `tradeable-items.jsonl` | Ships, modules, ammo, drones, etc. (~7,000 items) |

**Features:**
- Downloads from official CCP source (no third-party dependency)
- Handles JSONL format with `_key` fields for integer keys
- Streams large files for memory efficiency
- Automatically copies `solar-systems.json` to `public/` for client-side access
- Automatic cleanup of temp files

---

### `download-sde.ts` (Legacy - Fuzzwork)

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
# Create all 52 cron jobs
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
| Deklein | 12 | :40 every 2h |

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

### `add-t2-drones-to-watchlist.ts`

Adds all T2 drones to the market watchlist. Reads from `data/tradeable-items.jsonl` and inserts items where `categoryId === 18` (Drone) and name ends with " II".

**Usage:**
```bash
npx tsx scripts/add-t2-drones-to-watchlist.ts
```

**Required Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**Drones Added:**
| Group | Examples |
|-------|----------|
| Combat Drone | Hobgoblin II, Hammerhead II, Ogre II, Warrior II, etc. |
| Logistic Drone | Light/Medium/Heavy Armor/Shield/Hull Maintenance Bot II |
| Mining Drone | Mining Drone II, Ice Harvesting Drone II |
| Salvage Drone | Salvage Drone II |

The script uses upsert to handle existing items - running it multiple times is safe.

### `add-deklein-nullsec-items.ts`

Adds comprehensive nullsec items to the **essential_items** table (Essentials tab), optimized for Deklein (Guristas space). This includes mining equipment, ratting ships, exploration gear, and utility items.

**Target Table:** `essential_items` (not `watchlist_items`)

**Usage:**
```bash
npx tsx scripts/add-deklein-nullsec-items.ts
```

**Required Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**Items Included (~2,700 items):**

| Category | Count | Description |
|----------|-------|-------------|
| Module | ~1,500 | Shield/armor tank, mining upgrades, prop mods, damage mods, cap modules |
| Implant | ~400 | Attribute implants, skill hardwirings |
| Charge | ~375 | Kinetic (Scourge) missiles, mining crystals, hybrid charges |
| Ship | ~180 | Mining barges, exhumers, ratting subcapitals, exploration ships |
| Drone | ~125 | Combat, mining, salvage, ECM, logistics drones |
| Fighter | ~50 | Light, heavy, and support fighters |
| Subsystem | 48 | All T3 cruiser subsystems |
| Deployable | ~20 | MTUs, Mobile Depots, scan inhibitors |

**Key Features:**
- **Kinetic Focus**: Scourge missiles, hybrid charges (optimal vs Guristas)
- **No Capitals**: Excludes Rorqual, carriers, dreadnoughts, capital modules
- **Mining Complete**: All barges, exhumers, strip miners, crystals, mining drones
- **Exploration Ready**: Covert ops, probes, analyzers, cloaking devices

**Excluded Items:**
- Capital ships (Rorqual, Carriers, Dreadnoughts, Titans)
- Capital modules (Siege, Triage, Capital armor/shield)
- Excavator mining drones (Rorqual-only)
- Non-kinetic ammunition (thermal, EM, explosive missiles)

The script uses upsert - running it multiple times is safe and will update existing items.

### `clear-watchlist-essentials.ts`

Clears all items from the `watchlist_items` table. Used for cleanup before migrating to the separate essentials system.

**Usage:**
```bash
npx tsx scripts/clear-watchlist-essentials.ts
```

**Note:** This is a destructive operation - it removes ALL items from the personal watchlist.

### `remove-logistic-salvage-drones.ts`

Removes logistic drones and salvage drones from the market watchlist.

**Usage:**
```bash
npx tsx scripts/remove-logistic-salvage-drones.ts
```

**Required Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**Drones Removed:**
| Group | Examples |
|-------|----------|
| Logistic Drone | Light/Medium/Heavy Armor/Shield/Hull Maintenance Bot II |
| Salvage Drone | Salvage Drone II |

## Usage

### Update SDE Data

When a new EVE expansion or patch is released:

```bash
# Recommended: Use official CCP SDE
pnpm run update-sde-official

# Or directly with tsx
npx tsx scripts/download-official-sde.ts
```

**Alternative (Legacy - Fuzzwork):**
```bash
pnpm run update-sde

# Or directly with tsx
npx tsx scripts/download-sde.ts
```

This will:
1. Download latest files from CCP (or Fuzzwork for legacy script)
2. Process and transform the data
3. Save JSON files to `/data/` directory
4. Copy `solar-systems.json` to `/public/` for client-side access

### When to Update

Update the SDE data when:
- New items or blueprints are added to EVE
- Blueprint requirements change
- New solar systems are added (rare)
- After major EVE expansions

Check the [CCP SDE page](https://developers.eveonline.com/static-data/) or [Fuzzwork dump page](https://www.fuzzwork.co.uk/dump/) for the latest version.

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
- 2 jobs run daily (12:10 and 22:10 UTC) hitting `/api/cron/market-history-import`
- The importer ingests EVERef bulk dumps (all 3 regions in one file) instead of per-item ESI calls
- Configured via `scripts/setup-cron-jobs.ts`
- See `docs/api/esi.md` for full schedule details

**Database Table:** `market_history`
- Stores ~100 days of price history per item (retention enforced by the importer)
- Regions: The Forge (10000002), Vale of the Silent (10000003), Deklein (10000035)
- Updated via upsert (ON CONFLICT replace); all-time highs preserved in `market_ath`

## Troubleshooting

### Download fails with 403
Fuzzwork may block requests without a User-Agent header. The script includes a proper User-Agent.

### Missing item names
Some items may show as "Unknown" if they're not in the published types. The script includes all types (published and unpublished) to handle blueprint materials.

### Build fails after SDE update
If TypeScript types don't match the new JSON structure, check for schema changes in the SDE and update type definitions in `/lib/blueprints.ts`.

