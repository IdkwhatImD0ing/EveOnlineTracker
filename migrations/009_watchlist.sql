-- migrations/009_watchlist.sql
-- Watchlist items table for Market Seeder watchlist feature
-- Stores items to monitor for stock levels in alliance structure

CREATE TABLE watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id bigint NOT NULL UNIQUE,
  item_name text NOT NULL,
  group_name text,
  category_name text,
  volume numeric,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by type_id
CREATE INDEX idx_watchlist_items_type_id ON watchlist_items(type_id);

COMMENT ON TABLE watchlist_items IS 'Items to monitor for stock levels in alliance market structure';
COMMENT ON COLUMN watchlist_items.type_id IS 'EVE type ID of the item';
COMMENT ON COLUMN watchlist_items.item_name IS 'Display name of the item';
COMMENT ON COLUMN watchlist_items.group_name IS 'Item group (e.g., Armor Plate, Mining Upgrade)';
COMMENT ON COLUMN watchlist_items.category_name IS 'Item category (e.g., Module, Ship, Charge)';
COMMENT ON COLUMN watchlist_items.volume IS 'Volume per unit in m³';

