-- Market History Cache Table
-- Stores historical market statistics from ESI for tradeable items
-- Data is refreshed weekly, keeping the last 7 days of history

CREATE TABLE market_history (
  type_id BIGINT NOT NULL,
  date DATE NOT NULL,
  average NUMERIC,
  highest NUMERIC,
  lowest NUMERIC,
  order_count BIGINT,
  volume BIGINT,
  region_id BIGINT DEFAULT 10000002,  -- The Forge (Jita) by default
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (type_id, date, region_id)
);

-- Index for fast lookups by type_id
CREATE INDEX idx_market_history_type_id ON market_history(type_id);

-- Index for finding stale data
CREATE INDEX idx_market_history_updated_at ON market_history(updated_at);

-- Comment on table
COMMENT ON TABLE market_history IS 'Cached market history from ESI, refreshed weekly with last 7 days of data';
COMMENT ON COLUMN market_history.region_id IS 'EVE region ID - 10000002 = The Forge (Jita)';

