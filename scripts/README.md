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

## Troubleshooting

### Download fails with 403
Fuzzwork may block requests without a User-Agent header. The script includes a proper User-Agent.

### Missing item names
Some items may show as "Unknown" if they're not in the published types. The script includes all types (published and unpublished) to handle blueprint materials.

### Build fails after SDE update
If TypeScript types don't match the new JSON structure, check for schema changes in the SDE and update type definitions in `/lib/blueprints.ts`.

