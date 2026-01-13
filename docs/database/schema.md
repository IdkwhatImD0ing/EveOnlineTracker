# Database Schema

Complete database schema documentation for the EVE Online Industry Tracker.

## Overview

The application uses Supabase (PostgreSQL) for data storage. The schema includes tables for authentication, projects, and market data.

## Entity Relationship Diagram

### Authentication Tables

```
┌─────────────────────────────────────────────────────────────────┐
│                            users                                 │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid (PK)                                                   │
│ main_character_id: bigint                                       │
│ main_character_name: text                                       │
│ role: user_role (public|slyce|user|pro|admin)                   │
│ created_at: timestamptz                                         │
│ updated_at: timestamptz                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         characters                               │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid (PK)                                                   │
│ user_id: uuid (FK → users.id)                                   │
│ character_id: bigint (UNIQUE)                                   │
│ character_name: text                                            │
│ refresh_token: text                                             │
│ access_token: text                                              │
│ token_expires_at: timestamptz                                   │
│ is_main: boolean                                                │
│ created_at: timestamptz                                         │
│ updated_at: timestamptz                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Project Tables

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
```

### Market Tables

```
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

### users

Application users, identified by their main EVE character.

```sql
CREATE TYPE user_role AS ENUM ('public', 'slyce', 'user', 'pro', 'admin');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_character_id bigint NOT NULL,
  main_character_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'public',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_users_main_character_id ON users(main_character_id);
CREATE INDEX idx_users_role ON users(role);
```

| Column              | Type        | Constraints        | Description                     |
| ------------------- | ----------- | ------------------ | ------------------------------- |
| id                  | uuid        | PK, auto-generated | Unique identifier               |
| main_character_id   | bigint      | NOT NULL           | EVE character ID of main        |
| main_character_name | text        | NOT NULL           | Name of main character          |
| role                | user_role   | NOT NULL, DEFAULT 'public' | User role for access control |
| created_at          | timestamptz | DEFAULT now()      | Creation timestamp              |
| updated_at          | timestamptz | DEFAULT now()      | Last update timestamp           |

**User Roles:**

| Role | Description | Auto-assigned |
|------|-------------|---------------|
| `public` | Logged in, not in Slyce alliance, pending approval | Yes |
| `slyce` | Logged in, member of Slyce alliance, auto-approved | Yes |
| `user` | Manually granted access by admin | No |
| `pro` | Premium features granted by admin | No |
| `admin` | Full admin access | No |

**Access Control:** 
- New users are automatically assigned `public` or `slyce` role based on alliance membership
- Slyce alliance members are auto-approved on first login
- Administrators can change user roles via the Admin Dashboard (`/admin`)

---

### characters

EVE characters linked to users, stores OAuth tokens.

```sql
CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id bigint NOT NULL UNIQUE,
  character_name text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  token_expires_at timestamptz,
  is_main boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_character_id ON characters(character_id);
```

| Column           | Type        | Constraints            | Description               |
| ---------------- | ----------- | ---------------------- | ------------------------- |
| id               | uuid        | PK, auto-generated     | Unique identifier         |
| user_id          | uuid        | FK → users.id, CASCADE | Parent user               |
| character_id     | bigint      | NOT NULL, UNIQUE       | EVE character ID          |
| character_name   | text        | NOT NULL               | Character name            |
| refresh_token    | text        | NOT NULL               | EVE SSO refresh token     |
| access_token     | text        | nullable               | Cached access token       |
| token_expires_at | timestamptz | nullable               | When access token expires |
| is_main          | boolean     | DEFAULT false          | Is this the user's main   |
| created_at       | timestamptz | DEFAULT now()          | Creation timestamp        |
| updated_at       | timestamptz | DEFAULT now()          | Last update timestamp     |

**Token Management:**

- Access tokens are cached and refreshed automatically when expired
- Refresh tokens are stored securely and updated when refreshed
- Deleting a user cascades to delete all linked characters

---

### projects

Main table storing industry projects.

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed boolean NOT NULL DEFAULT false
);
```

| Column     | Type        | Constraints        | Description           |
| ---------- | ----------- | ------------------ | --------------------- |
| id         | uuid        | PK, auto-generated | Unique identifier     |
| name       | text        | NOT NULL           | Project name/title    |
| created_at | timestamptz | DEFAULT now()      | Creation timestamp    |
| updated_at | timestamptz | DEFAULT now()      | Last update timestamp |
| completed  | boolean     | NOT NULL, DEFAULT false | Whether project is marked as complete |

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

| Column      | Type    | Constraints               | Description                  |
| ----------- | ------- | ------------------------- | ---------------------------- |
| id          | uuid    | PK, auto-generated        | Unique identifier            |
| project_id  | uuid    | FK → projects.id, CASCADE | Parent project               |
| item_name   | text    | NOT NULL                  | EVE item name                |
| type_id     | bigint  | NOT NULL                  | EVE type ID                  |
| quantity    | bigint  | NOT NULL, DEFAULT 1       | Required quantity            |
| collected   | boolean | NOT NULL, DEFAULT false   | Whether collected            |
| buy_price   | numeric | nullable                  | Jita buy price per unit      |
| sell_price  | numeric | nullable                  | Jita sell price per unit     |
| split_price | numeric | nullable                  | Jita split price per unit    |
| volume      | numeric | nullable                  | Item volume per unit (m³)    |
| item_type   | text    | nullable                  | Group name (e.g., "Mineral") |

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

| Column              | Type    | Constraints               | Description                         |
| ------------------- | ------- | ------------------------- | ----------------------------------- |
| id                  | uuid    | PK, auto-generated        | Unique identifier                   |
| project_id          | uuid    | FK → projects.id, CASCADE | Parent project                      |
| item_name           | text    | NOT NULL                  | EVE item name                       |
| type_id             | bigint  | NOT NULL                  | EVE type ID                         |
| quantity            | bigint  | NOT NULL, DEFAULT 1       | Required quantity                   |
| collected           | boolean | NOT NULL, DEFAULT false   | Whether fully collected             |
| quantity_made       | bigint  | NOT NULL, DEFAULT 0       | Units completed so far              |
| buy_price           | numeric | nullable                  | Jita buy price per unit             |
| sell_price          | numeric | nullable                  | Jita sell price per unit            |
| split_price         | numeric | nullable                  | Jita split price per unit           |
| volume              | numeric | nullable                  | Item volume per unit (m³)           |
| item_type           | text    | nullable                  | Group name                          |
| materials_breakdown | jsonb   | nullable                  | Raw materials needed (for Buy Mode) |
| build_cost          | numeric | nullable                  | Total cost to build (for Buy Mode)  |

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

| Column     | Type        | Constraints               | Description             |
| ---------- | ----------- | ------------------------- | ----------------------- |
| id         | uuid        | PK, auto-generated        | Unique identifier       |
| project_id | uuid        | FK → projects.id, CASCADE | Parent project          |
| note       | text        | NOT NULL                  | Description of the cost |
| amount     | numeric     | NOT NULL                  | Cost amount in ISK      |
| created_at | timestamptz | DEFAULT now()             | Creation timestamp      |

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

| Column      | Type        | Constraints                      | Description                       |
| ----------- | ----------- | -------------------------------- | --------------------------------- |
| type_id     | bigint      | PK (composite)                   | EVE item type ID                  |
| date        | date        | PK (composite)                   | Date of the market statistics     |
| region_id   | bigint      | PK (composite), DEFAULT 10000002 | EVE region ID (The Forge = Jita)  |
| average     | numeric     | nullable                         | Average price for the day         |
| highest     | numeric     | nullable                         | Highest price for the day         |
| lowest      | numeric     | nullable                         | Lowest price for the day          |
| order_count | bigint      | nullable                         | Total number of orders that day   |
| volume      | bigint      | nullable                         | Total units traded that day       |
| updated_at  | timestamptz | DEFAULT now()                    | When this record was last updated |

**Data Source:** ESI `/markets/{region_id}/history` endpoint

**Update Frequency:** Weekly via Vercel cron (Sundays at 12:00 UTC)

**Data Retention:** Last 7 days of history per item

**Region IDs:**

| Region                | ID       |
| --------------------- | -------- |
| The Forge (Jita)      | 10000002 |
| Domain (Amarr)        | 10000043 |
| Sinq Laison (Dodixie) | 10000032 |
| Heimatar (Rens)       | 10000030 |

---

### watchlist_items

Stores items to monitor for stock levels in the alliance market structure.

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

CREATE INDEX idx_watchlist_items_type_id ON watchlist_items(type_id);
```

| Column        | Type        | Constraints        | Description                            |
| ------------- | ----------- | ------------------ | -------------------------------------- |
| id            | uuid        | PK, auto-generated | Unique identifier                      |
| type_id       | bigint      | NOT NULL, UNIQUE   | EVE item type ID                       |
| item_name     | text        | NOT NULL           | Display name of the item               |
| group_name    | text        | nullable           | Item group (e.g., "Damage Control")    |
| category_name | text        | nullable           | Item category (e.g., "Module", "Ship") |
| volume        | numeric     | nullable           | Volume per unit in m³                  |
| created_at    | timestamptz | DEFAULT now()      | When item was added to watchlist       |

**Purpose:** Allows users to track specific items and check if they need restocking in the alliance structure.

**Usage:** The Watchlist tab in Market Seeder uses this table to store tracked items. Stock levels are checked in real-time from ESI structure orders.

---

### essential_items

Stores pre-curated essential items for nullsec market seeding (admin-managed, shared across all users).

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

| Column        | Type        | Constraints        | Description                            |
| ------------- | ----------- | ------------------ | -------------------------------------- |
| id            | uuid        | PK, auto-generated | Unique identifier                      |
| type_id       | bigint      | NOT NULL, UNIQUE   | EVE item type ID                       |
| item_name     | text        | NOT NULL           | Display name of the item               |
| group_name    | text        | nullable           | Item group (e.g., "Combat Drone")      |
| category_name | text        | nullable           | Item category (e.g., "Drone", "Ship")  |
| volume        | numeric     | nullable           | Volume per unit in m³                  |
| created_at    | timestamptz | DEFAULT now()      | When item was added                    |

**Purpose:** Stores a curated list of ~2,700 items essential for nullsec living. Unlike `watchlist_items` (personal), this is shared across all users and admin-managed.

**Population:** Run `npx tsx scripts/add-deklein-nullsec-items.ts` to populate with items optimized for Guristas space.

---

### alliance_fits

Stores alliance ship fittings parsed from EFT format.

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

CREATE INDEX idx_alliance_fits_ship_type_id ON alliance_fits(ship_type_id);
CREATE INDEX idx_alliance_fits_created_by ON alliance_fits(created_by);
```

| Column        | Type        | Constraints                      | Description                              |
| ------------- | ----------- | -------------------------------- | ---------------------------------------- |
| id            | uuid        | PK, auto-generated               | Unique identifier                        |
| ship_type_id  | bigint      | NOT NULL                         | EVE ship type ID                         |
| ship_name     | text        | NOT NULL                         | Ship name (e.g., "Redeemer")             |
| fit_name      | text        | NOT NULL                         | Fitting name                             |
| raw_eft       | text        | NOT NULL                         | Original EFT-formatted text              |
| items         | jsonb       | NOT NULL                         | Parsed items array                       |
| created_by    | uuid        | FK → users.id, SET NULL          | User who created the fit                 |
| created_at    | timestamptz | DEFAULT now()                    | Creation timestamp                       |
| updated_at    | timestamptz | DEFAULT now()                    | Last update timestamp                    |

**Items JSONB Format:**

```json
[
  {"type_id": 2281, "name": "Heat Sink II", "quantity": 1, "slot": "low"},
  {"type_id": 2185, "name": "Warrior II", "quantity": 10, "slot": "drone"}
]
```

**Slot Types:** `high`, `mid`, `low`, `rig`, `subsystem`, `drone`, `cargo`

**Purpose:** Allows administrators to store and manage alliance ship fittings for sharing with members.

---

### market_history_import_logs

Tracks statistics from each market history batch import run for debugging.

```sql
CREATE TABLE market_history_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  
  -- Run configuration
  mode text NOT NULL,
  region_id bigint NOT NULL,
  chunk int,
  total_chunks int,
  target_date date,
  
  -- Item counts
  items_total int NOT NULL,
  items_success int NOT NULL,
  items_failed int NOT NULL,
  items_with_data int NOT NULL,
  
  -- Row counts
  rows_fetched int NOT NULL,
  rows_inserted int NOT NULL,
  
  -- Timing
  duration_ms int NOT NULL,
  esi_fetch_ms int,
  db_upsert_ms int,
  
  -- Errors
  error_breakdown jsonb,
  fatal_error text
);

CREATE INDEX idx_import_logs_run_at ON market_history_import_logs(run_at DESC);
CREATE INDEX idx_import_logs_region_date ON market_history_import_logs(region_id, target_date);
```

| Column          | Type        | Constraints        | Description                              |
| --------------- | ----------- | ------------------ | ---------------------------------------- |
| id              | uuid        | PK, auto-generated | Unique identifier                        |
| run_at          | timestamptz | NOT NULL, DEFAULT now() | When the import run started         |
| mode            | text        | NOT NULL           | Import mode (daily, initial, backfill)   |
| region_id       | bigint      | NOT NULL           | EVE region ID                            |
| chunk           | int         | nullable           | Which chunk (0 to total_chunks-1)        |
| total_chunks    | int         | nullable           | Total number of chunks                   |
| target_date     | date        | nullable           | The date being fetched (for daily mode)  |
| items_total     | int         | NOT NULL           | Total items in this chunk                |
| items_success   | int         | NOT NULL           | Successfully fetched from ESI            |
| items_failed    | int         | NOT NULL           | Failed to fetch from ESI                 |
| items_with_data | int         | NOT NULL           | Items that had market data               |
| rows_fetched    | int         | NOT NULL           | Total rows fetched from ESI              |
| rows_inserted   | int         | NOT NULL           | Rows written to database                 |
| duration_ms     | int         | NOT NULL           | Total run duration in milliseconds       |
| esi_fetch_ms    | int         | nullable           | ESI fetch time in milliseconds           |
| db_upsert_ms    | int         | nullable           | Database upsert time in milliseconds     |
| error_breakdown | jsonb       | nullable           | Error counts by type {"HTTP 400": 25}    |
| fatal_error     | text        | nullable           | Fatal error message if run failed        |

**Purpose:** Debug import issues by tracking success/failure rates for each batch run. Helps identify gaps like the December 2025 data issue.

**Example Queries:**

```sql
-- Find runs with high failure rates
SELECT * FROM market_history_import_logs 
WHERE items_failed > items_total * 0.5
ORDER BY run_at DESC;

-- Check specific date's imports
SELECT * FROM market_history_import_logs 
WHERE target_date = '2025-12-11'
ORDER BY run_at;

-- Daily summary
SELECT target_date, 
       SUM(items_success) as total_success, 
       SUM(items_failed) as total_failed,
       SUM(rows_inserted) as total_rows
FROM market_history_import_logs 
WHERE target_date IS NOT NULL
GROUP BY target_date
ORDER BY target_date DESC;
```

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

| Parent   | Child            | Relationship | On Delete |
| -------- | ---------------- | ------------ | --------- |
| projects | raw_materials    | 1:N          | CASCADE   |
| projects | components       | 1:N          | CASCADE   |
| projects | additional_costs | 1:N          | CASCADE   |
| users    | alliance_fits    | 1:N          | SET NULL  |

Deleting a project automatically deletes all related records.
Deleting a user sets `created_by` to NULL on their alliance fits.

---

## TypeScript Types

```typescript
// types/auth.ts

export type UserRole = 'public' | 'slyce' | 'user' | 'pro' | 'admin'

export interface User {
  id: string
  main_character_id: number
  main_character_name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Character {
  id: string
  user_id: string
  character_id: number
  character_name: string
  refresh_token: string
  access_token: string | null
  token_expires_at: string | null
  is_main: boolean
  created_at: string
  updated_at: string
}

export interface UserWithCharacters extends User {
  characters: Character[]
}

export interface Session {
  user_id: string
  user: User
  characters: Character[]
}

// types/database.ts

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
  completed: boolean
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

// Watchlist types
export interface WatchlistItem {
  id: string
  type_id: number
  item_name: string
  group_name: string | null
  category_name: string | null
  volume: number | null
  created_at: string
}

export interface WatchlistItemWithStock extends WatchlistItem {
  stock: number
  lowest_price: number | null
  needs_restock: boolean
}

// types/fits.ts

export type FitSlotType = 'high' | 'mid' | 'low' | 'rig' | 'subsystem' | 'drone' | 'cargo'

export interface FitItem {
  type_id: number | null
  name: string
  quantity: number
  slot: FitSlotType
}

export interface AllianceFit {
  id: string
  ship_type_id: number
  ship_name: string
  fit_name: string
  raw_eft: string
  items: FitItem[]
  created_by: string | null
  created_at: string
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

### Migration 009: Watchlist Items

```sql
-- migrations/009_watchlist.sql
-- Watchlist items table for Market Seeder watchlist feature

CREATE TABLE watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id bigint NOT NULL UNIQUE,
  item_name text NOT NULL,
  group_name text,
  category_name text,
  volume numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_watchlist_items_type_id ON watchlist_items(type_id);
```

### Migration 010: Users and Characters

```sql
-- migrations/010_users_and_characters.sql
-- Multi-account support with alt characters

-- Users table (one per person)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_character_id bigint NOT NULL,
  main_character_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'public',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Characters table (multiple per user)
CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id bigint NOT NULL UNIQUE,
  character_name text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  token_expires_at timestamptz,
  is_main boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_character_id ON characters(character_id);
CREATE INDEX idx_users_main_character_id ON users(main_character_id);
CREATE INDEX idx_users_role ON users(role);

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Migration 011: User Roles

```sql
-- migrations/011_user_roles.sql
-- Add role-based access control to users table

-- Create enum type for user roles
CREATE TYPE user_role AS ENUM ('public', 'slyce', 'user', 'pro', 'admin');

-- Add role column with default 'public'
ALTER TABLE users
ADD COLUMN role user_role DEFAULT 'public';

-- Migrate existing users based on 'allowed' status
UPDATE users SET role = 'user' WHERE allowed = true;
UPDATE users SET role = 'public' WHERE allowed = false;

-- Make role NOT NULL after migration
ALTER TABLE users
ALTER COLUMN role SET NOT NULL;

-- Drop the allowed column (no longer needed)
ALTER TABLE users
DROP COLUMN allowed;

-- Add index for role lookups
CREATE INDEX idx_users_role ON users(role);
```

### Migration 012: Alliance Fits

```sql
-- migrations/012_alliance_fits.sql
-- Alliance Fits table for storing parsed ship fittings

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

CREATE INDEX idx_alliance_fits_ship_type_id ON alliance_fits(ship_type_id);
CREATE INDEX idx_alliance_fits_created_by ON alliance_fits(created_by);

CREATE TRIGGER update_alliance_fits_updated_at
  BEFORE UPDATE ON alliance_fits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Migration 013: Add Project Completed Status

```sql
-- migrations/013_add_project_completed.sql
-- Add completed status to projects table

ALTER TABLE projects
ADD COLUMN completed boolean NOT NULL DEFAULT false;

CREATE INDEX idx_projects_completed ON projects(completed);
```

---

## Notes

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
