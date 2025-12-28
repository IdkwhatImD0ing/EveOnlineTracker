-- Migration 014: Essential Items Table
-- Creates a separate table for curated essential items (nullsec market essentials)
-- This is separate from watchlist_items which is for personal/custom watchlists

CREATE TABLE essential_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id bigint NOT NULL UNIQUE,
  item_name text NOT NULL,
  group_name text,
  category_name text,
  volume numeric,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient lookups by type_id
CREATE INDEX idx_essential_items_type_id ON essential_items(type_id);

-- Index for category filtering
CREATE INDEX idx_essential_items_category ON essential_items(category_name);

COMMENT ON TABLE essential_items IS 'Curated essential items for nullsec market seeding. Admin-managed, separate from personal watchlist.';
COMMENT ON COLUMN essential_items.type_id IS 'EVE Online type ID for the item';
COMMENT ON COLUMN essential_items.item_name IS 'Display name of the item';
COMMENT ON COLUMN essential_items.group_name IS 'Item group (e.g., Combat Drone, Shield Extender)';
COMMENT ON COLUMN essential_items.category_name IS 'Item category (e.g., Module, Ship, Drone)';
COMMENT ON COLUMN essential_items.volume IS 'Volume per unit in cubic meters';
