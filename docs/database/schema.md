# Database Schema

Complete database schema documentation for the EVE Online Industry Tracker.

## Overview

The application uses Supabase (PostgreSQL) for data storage. The schema consists of four main tables with foreign key relationships.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           projects                               │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid (PK)                                                   │
│ name: text                                                      │
│ created_at: timestamptz                                         │
│ updated_at: timestamptz                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  raw_materials  │  │   components    │  │additional_costs │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ id: uuid (PK)   │  │ id: uuid (PK)   │  │ id: uuid (PK)   │
│ project_id (FK) │  │ project_id (FK) │  │ project_id (FK) │
│ item_name       │  │ item_name       │  │ note            │
│ type_id         │  │ type_id         │  │ amount          │
│ quantity        │  │ quantity        │  │ created_at      │
│ collected       │  │ collected       │  └─────────────────┘
│ buy_price       │  │ quantity_made   │
│ sell_price      │  │ buy_price       │
│ split_price     │  │ sell_price      │
│ volume          │  │ split_price     │
│ item_type       │  │ volume          │
└─────────────────┘  │ item_type       │
                     │ materials_      │
                     │   breakdown     │
                     │ build_cost      │
                     └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       market_history                             │
├─────────────────────────────────────────────────────────────────┤
│ type_id: bigint (PK)                                            │
│ date: date (PK)                                                 │
│ region_id: bigint (PK)                                          │
│ average: numeric                                                │
│ highest: numeric                                                │
│ lowest: numeric                                                 │
│ order_count: bigint                                             │
│ volume: bigint                                                  │
│ updated_at: timestamptz                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Tables

### projects

Main table storing industry projects.

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, auto-generated | Unique identifier |
| name | text | NOT NULL | Project name/title |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Trigger:** `updated_at` is automatically updated on row modification.

---

### raw_materials

Stores raw materials (base resources that cannot be built).

```sql
CREATE TABLE raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  type_id bigint NOT NULL,
  quantity bigint NOT NULL DEFAULT 1,
  collected boolean NOT NULL DEFAULT false,
  buy_price numeric,
  sell_price numeric,
  split_price numeric,
  volume numeric,
  item_type text
);

CREATE INDEX idx_raw_materials_project_id ON raw_materials(project_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, auto-generated | Unique identifier |
| project_id | uuid | FK → projects.id, CASCADE | Parent project |
| item_name | text | NOT NULL | EVE item name |
| type_id | bigint | NOT NULL | EVE type ID |
| quantity | bigint | NOT NULL, DEFAULT 1 | Required quantity |
| collected | boolean | NOT NULL, DEFAULT false | Whether collected |
| buy_price | numeric | nullable | Jita buy price per unit |
| sell_price | numeric | nullable | Jita sell price per unit |
| split_price | numeric | nullable | Jita split price per unit |
| volume | numeric | nullable | Item volume per unit (m³) |
| item_type | text | nullable | Group name (e.g., "Mineral") |

---

### components

Stores intermediate components that need to be manufactured.

```sql
CREATE TABLE components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  type_id bigint NOT NULL,
  quantity bigint NOT NULL DEFAULT 1,
  collected boolean NOT NULL DEFAULT false,
  quantity_made bigint NOT NULL DEFAULT 0,
  buy_price numeric,
  sell_price numeric,
  split_price numeric,
  volume numeric,
  item_type text,
  materials_breakdown jsonb,
  build_cost numeric
);

CREATE INDEX idx_components_project_id ON components(project_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, auto-generated | Unique identifier |
| project_id | uuid | FK → projects.id, CASCADE | Parent project |
| item_name | text | NOT NULL | EVE item name |
| type_id | bigint | NOT NULL | EVE type ID |
| quantity | bigint | NOT NULL, DEFAULT 1 | Required quantity |
| collected | boolean | NOT NULL, DEFAULT false | Whether fully collected |
| quantity_made | bigint | NOT NULL, DEFAULT 0 | Units completed so far |
| buy_price | numeric | nullable | Jita buy price per unit |
| sell_price | numeric | nullable | Jita sell price per unit |
| split_price | numeric | nullable | Jita split price per unit |
| volume | numeric | nullable | Item volume per unit (m³) |
| item_type | text | nullable | Group name |
| materials_breakdown | jsonb | nullable | Raw materials needed (for Buy Mode) |
| build_cost | numeric | nullable | Total cost to build (for Buy Mode) |

**`materials_breakdown` Format:**
```json
[
  {"typeId": 34, "name": "Tritanium", "quantity": 50000000},
  {"typeId": 35, "name": "Pyerite", "quantity": 12500000}
]
```

---

### additional_costs

Stores additional costs added to projects.

```sql
CREATE TABLE additional_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_additional_costs_project_id ON additional_costs(project_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, auto-generated | Unique identifier |
| project_id | uuid | FK → projects.id, CASCADE | Parent project |
| note | text | NOT NULL | Description of the cost |
| amount | numeric | NOT NULL | Cost amount in ISK |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |

---

### market_history

Cached market history data from ESI. Updated weekly via cron job.

```sql
CREATE TABLE market_history (
  type_id BIGINT NOT NULL,
  date DATE NOT NULL,
  average NUMERIC,
  highest NUMERIC,
  lowest NUMERIC,
  order_count BIGINT,
  volume BIGINT,
  region_id BIGINT DEFAULT 10000002,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (type_id, date, region_id)
);

CREATE INDEX idx_market_history_type_id ON market_history(type_id);
CREATE INDEX idx_market_history_updated_at ON market_history(updated_at);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| type_id | bigint | PK (composite) | EVE item type ID |
| date | date | PK (composite) | Date of the market statistics |
| region_id | bigint | PK (composite), DEFAULT 10000002 | EVE region ID (The Forge = Jita) |
| average | numeric | nullable | Average price for the day |
| highest | numeric | nullable | Highest price for the day |
| lowest | numeric | nullable | Lowest price for the day |
| order_count | bigint | nullable | Total number of orders that day |
| volume | bigint | nullable | Total units traded that day |
| updated_at | timestamptz | DEFAULT now() | When this record was last updated |

**Data Source:** ESI `/markets/{region_id}/history` endpoint

**Update Frequency:** Weekly via Vercel cron (Sundays at 12:00 UTC)

**Data Retention:** Last 7 days of history per item

**Region IDs:**

| Region | ID |
|--------|-----|
| The Forge (Jita) | 10000002 |
| Domain (Amarr) | 10000043 |
| Sinq Laison (Dodixie) | 10000032 |
| Heimatar (Rens) | 10000030 |

---

## Triggers

### update_updated_at_column

Automatically updates `updated_at` timestamp on projects table modifications.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Relationships

| Parent | Child | Relationship | On Delete |
|--------|-------|--------------|-----------|
| projects | raw_materials | 1:N | CASCADE |
| projects | components | 1:N | CASCADE |
| projects | additional_costs | 1:N | CASCADE |

Deleting a project automatically deletes all related records.

---

## TypeScript Types

```typescript
// types/database.ts

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface RawMaterial {
  id: string
  project_id: string
  item_name: string
  type_id: number
  quantity: number
  collected: boolean
  buy_price: number | null
  sell_price: number | null
  split_price: number | null
  volume: number | null
  item_type: string | null
}

export interface ComponentMaterialBreakdown {
  typeId: number
  name: string
  quantity: number
}

export interface Component {
  id: string
  project_id: string
  item_name: string
  type_id: number
  quantity: number
  collected: boolean
  quantity_made: number
  buy_price: number | null
  sell_price: number | null
  split_price: number | null
  volume: number | null
  item_type: string | null
  materials_breakdown: ComponentMaterialBreakdown[] | null
  build_cost: number | null
}

export interface AdditionalCost {
  id: string
  project_id: string
  note: string
  amount: number
  created_at: string
}

export interface ProjectWithDetails extends Project {
  raw_materials: RawMaterial[]
  components: Component[]
  additional_costs: AdditionalCost[]
}

// Market History types
export interface MarketHistoryEntry {
  type_id: number
  date: string
  average: number
  highest: number
  lowest: number
  order_count: number
  volume: number
  region_id: number
  updated_at: string
}
```

---

## Migrations

### Initial Schema

Run in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Raw materials table
CREATE TABLE raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  type_id bigint NOT NULL,
  quantity bigint NOT NULL DEFAULT 1,
  collected boolean NOT NULL DEFAULT false,
  buy_price numeric,
  sell_price numeric,
  split_price numeric,
  volume numeric
);

-- Components table
CREATE TABLE components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  type_id bigint NOT NULL,
  quantity bigint NOT NULL DEFAULT 1,
  collected boolean NOT NULL DEFAULT false,
  quantity_made bigint NOT NULL DEFAULT 0,
  buy_price numeric,
  sell_price numeric,
  split_price numeric,
  volume numeric
);

-- Additional costs table
CREATE TABLE additional_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_raw_materials_project_id ON raw_materials(project_id);
CREATE INDEX idx_components_project_id ON components(project_id);
CREATE INDEX idx_additional_costs_project_id ON additional_costs(project_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Migration 001: Add quantity_made

```sql
-- migrations/001_add_quantity_made.sql
ALTER TABLE components 
ADD COLUMN IF NOT EXISTS quantity_made bigint NOT NULL DEFAULT 0;
```

### Migration 002: Fix volume values

```sql
-- migrations/002_fix_volume_values.sql
-- Ensure volume is stored per-unit, not total
```

### Migration 003: Add materials_breakdown

```sql
-- migrations/003_add_materials_breakdown.sql
ALTER TABLE raw_materials 
ADD COLUMN IF NOT EXISTS item_type text;

ALTER TABLE components 
ADD COLUMN IF NOT EXISTS item_type text;

ALTER TABLE components 
ADD COLUMN IF NOT EXISTS materials_breakdown jsonb;

ALTER TABLE components 
ADD COLUMN IF NOT EXISTS build_cost numeric;
```

### Migration 004: Add market_history

```sql
-- migrations/004_market_history.sql
CREATE TABLE market_history (
  type_id BIGINT NOT NULL,
  date DATE NOT NULL,
  average NUMERIC,
  highest NUMERIC,
  lowest NUMERIC,
  order_count BIGINT,
  volume BIGINT,
  region_id BIGINT DEFAULT 10000002,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (type_id, date, region_id)
);

CREATE INDEX idx_market_history_type_id ON market_history(type_id);
CREATE INDEX idx_market_history_updated_at ON market_history(updated_at);

COMMENT ON TABLE market_history IS 'Cached market history from ESI, refreshed weekly with last 7 days of data';
COMMENT ON COLUMN market_history.region_id IS 'EVE region ID - 10000002 = The Forge (Jita)';
```

### Migration 005: Market Statistics Function

```sql
-- migrations/005_market_statistics_function.sql
-- Creates a function for efficient market opportunity analysis
-- Calculates statistics server-side instead of fetching all rows

CREATE OR REPLACE FUNCTION get_market_statistics(
  p_region_id BIGINT DEFAULT 10000002,
  p_days_back INTEGER DEFAULT 30,
  p_min_data_points INTEGER DEFAULT 7
)
RETURNS TABLE (
  type_id BIGINT,
  mean_price NUMERIC,
  std_dev NUMERIC,
  avg_volume NUMERIC,
  data_points BIGINT,
  volatility NUMERIC,
  first_price NUMERIC,
  last_price NUMERIC,
  momentum NUMERIC
);
```

**Usage:**
```sql
SELECT * FROM get_market_statistics(
  ARRAY[34, 35, 36]::BIGINT[],  -- type_ids to analyze
  10000002,                       -- region_id
  365,                            -- days_back
  3                               -- min_data_points
);
```

Returns pre-aggregated statistics per item instead of raw rows (~5k rows vs ~800k).

### get_sell_statistics

```sql
-- migrations/006_sell_statistics_function.sql
-- Aggregates ATH and mean price for sell opportunity analysis

CREATE OR REPLACE FUNCTION get_sell_statistics(
  p_type_ids BIGINT[],
  p_region_id BIGINT DEFAULT 10000002
)
RETURNS TABLE (
  type_id BIGINT,
  all_time_high NUMERIC,
  mean_price NUMERIC,
  data_points BIGINT
);
```

### get_market_seeder_statistics

```sql
-- migrations/008_market_seeder_statistics.sql
-- Calculates demand metrics for market seeder analysis

CREATE OR REPLACE FUNCTION get_market_seeder_statistics(
  p_type_ids BIGINT[],
  p_region_id BIGINT DEFAULT 10000002,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  type_id BIGINT,
  total_volume NUMERIC,
  avg_daily_volume NUMERIC,
  avg_price NUMERIC,
  total_orders BIGINT,
  recent_avg_volume NUMERIC,   -- Last 7 days
  older_avg_volume NUMERIC,    -- Days 8-30
  trend_direction TEXT         -- 'up', 'down', 'stable'
);
```

**Usage:**
```sql
SELECT * FROM get_market_seeder_statistics(
  ARRAY[34, 35, 36]::BIGINT[],
  10000002,
  30
);
```

Returns volume and trend metrics for market seeder profit analysis.

---

## Notes

### Numeric Type

Using `numeric` instead of `float` for monetary values avoids floating-point precision issues with ISK amounts.

### Volume Storage

Volume is stored per-unit. Total volume is calculated: `volume * quantity`.

### Progress Tracking

- `collected` = fully obtained (checkbox checked)
- `quantity_made` = partial progress (e.g., 50 of 100 built)
- When `quantity_made >= quantity`, item can be auto-marked as `collected`

### Buy Mode Data

Projects created from Industry Calculator include:
- `materials_breakdown`: Raw materials for each component
- `build_cost`: Cost to manufacture each component

This enables the Buy Mode feature in project detail pages.

---

## Supabase Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Row Level Security (RLS)

The application uses service role key (bypasses RLS). For public deployment, configure RLS policies.

---

## Related Files

- `types/database.ts` - TypeScript definitions
- `utils/supabase/server.ts` - Supabase client
- `migrations/*.sql` - Migration files

