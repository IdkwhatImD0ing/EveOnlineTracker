# Supabase Database Schema

## Overview

This document describes the database schema for the Eve Online Industry Tracker. All tables use UUID primary keys with auto-generation.

## Tables

### projects

Main table storing industry projects.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | Unique identifier |
| name | text | NOT NULL | Project name/title |
| created_at | timestamptz | default now() | Creation timestamp |
| updated_at | timestamptz | default now() | Last update timestamp |

### raw_materials

Stores raw materials parsed from the first text input via Janice API.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | Unique identifier |
| project_id | uuid | FK -> projects.id, ON DELETE CASCADE | Parent project |
| item_name | text | NOT NULL | Eve item name |
| type_id | bigint | NOT NULL | Eve type ID (from Janice) |
| quantity | bigint | NOT NULL, default 1 | Required quantity |
| collected | boolean | NOT NULL, default false | Whether item has been collected |
| buy_price | numeric | | Jita buy price per unit |
| sell_price | numeric | | Jita sell price per unit |
| split_price | numeric | | Jita split price per unit |
| volume | numeric | | Item volume |

### components

Stores components parsed from the second text input via Janice API.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | Unique identifier |
| project_id | uuid | FK -> projects.id, ON DELETE CASCADE | Parent project |
| item_name | text | NOT NULL | Eve item name |
| type_id | bigint | NOT NULL | Eve type ID (from Janice) |
| quantity | bigint | NOT NULL, default 1 | Required quantity |
| collected | boolean | NOT NULL, default false | Whether item has been fully collected |
| quantity_made | bigint | NOT NULL, default 0 | Tracks partial progress (units completed so far) |
| buy_price | numeric | | Jita buy price per unit |
| sell_price | numeric | | Jita sell price per unit |
| split_price | numeric | | Jita split price per unit |
| volume | numeric | | Item volume |

### additional_costs

Stores additional costs added to projects (e.g., manufacturing fees, transport costs).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | Unique identifier |
| project_id | uuid | FK -> projects.id, ON DELETE CASCADE | Parent project |
| note | text | NOT NULL | Description of the cost |
| amount | numeric | NOT NULL | Cost amount in ISK |
| created_at | timestamptz | default now() | Creation timestamp |

## SQL Migration

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

-- Indexes for performance
CREATE INDEX idx_raw_materials_project_id ON raw_materials(project_id);
CREATE INDEX idx_components_project_id ON components(project_id);
CREATE INDEX idx_additional_costs_project_id ON additional_costs(project_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to projects table
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Relationships

```
projects
  │
  ├── raw_materials (1:N)
  │     └── project_id → projects.id
  │
  ├── components (1:N)
  │     └── project_id → projects.id
  │
  └── additional_costs (1:N)
        └── project_id → projects.id
```

## Notes

- All monetary values are stored as `numeric` to avoid floating-point precision issues with ISK amounts
- Prices are stored per-unit; total values are calculated at query time
- The `collected` boolean tracks whether an item has been fully obtained (for progress tracking)
- The `quantity_made` field on components tracks partial progress (e.g., 50 of 100 units completed)
- When `quantity_made` equals `quantity`, the item is automatically marked as `collected`
- Cascade deletes ensure all related data is removed when a project is deleted

