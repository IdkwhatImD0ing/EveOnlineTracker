-- Migration 017: Market History Import Logs
-- Tracks statistics from each market history batch import run for debugging

CREATE TABLE market_history_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  
  -- Run configuration
  mode text NOT NULL,                    -- daily, initial, backfill, etc.
  region_id bigint NOT NULL,
  chunk int,                             -- Which chunk (0-N)
  total_chunks int,                      -- Total chunks
  target_date date,                      -- The date being fetched (for daily mode)
  
  -- Item counts
  items_total int NOT NULL,              -- Total items in this chunk
  items_success int NOT NULL,            -- Successfully fetched
  items_failed int NOT NULL,             -- Failed to fetch
  items_with_data int NOT NULL,          -- Had market data
  
  -- Row counts
  rows_fetched int NOT NULL,             -- Rows from ESI
  rows_inserted int NOT NULL,            -- Rows written to DB
  
  -- Timing
  duration_ms int NOT NULL,              -- Total run duration
  esi_fetch_ms int,                      -- ESI fetch time
  db_upsert_ms int,                      -- Supabase upsert time
  
  -- Errors
  error_breakdown jsonb,                 -- {"HTTP 400": 25, "timeout": 3}
  fatal_error text                       -- If the whole run failed
);

-- Index for querying recent runs
CREATE INDEX idx_import_logs_run_at ON market_history_import_logs(run_at DESC);

-- Index for finding runs by region and date
CREATE INDEX idx_import_logs_region_date ON market_history_import_logs(region_id, target_date);

-- Comment explaining the table
COMMENT ON TABLE market_history_import_logs IS 
'Tracks statistics from each market history batch import run.
Used to debug import issues like missing data gaps.

Example queries:
- Find failed runs: SELECT * FROM market_history_import_logs WHERE items_failed > items_total * 0.5
- Check specific date: SELECT * FROM market_history_import_logs WHERE target_date = ''2025-12-11''
- Daily summary: SELECT target_date, SUM(items_success), SUM(items_failed) FROM market_history_import_logs GROUP BY target_date';

