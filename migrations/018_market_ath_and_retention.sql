-- Migration 018: market_ath table, retention prune, and index cleanup
--
-- Context: market_history had grown to ~3.7M rows (19 months x 3 regions),
-- blowing past the Supabase free-tier 500 MB quota. The fix:
--   1. Preserve all-time highs in a tiny market_ath table (seeded from the
--      full 19 months BEFORE pruning, kept current by the EVERef importer).
--   2. Redefine get_sell_statistics to read ATH from market_ath so
--      sell-opportunities keeps its full-depth all-time-high.
--   3. Prune market_history to a 100-day window. The primary analytics paths
--      query 90 days back; the market/opportunities 365-day FALLBACK path
--      (get_market_statistics, only used when get_market_history_arrays is
--      unavailable) will silently operate on the retained window instead.
--   4. Drop two redundant indexes and add a small date index for the daily
--      retention delete.
--
-- HOW TO RUN - IMPORTANT:
-- The Supabase SQL editor caps each run at 60 seconds, so run each SECTION
-- below as a SEPARATE execution, in order. If the project has entered
-- read-only mode (free-tier quota breach), start each run with:
--     SET default_transaction_read_only = 'off';
-- (Supabase's documented escape hatch for reducing data while over quota.)

-- ============================================================================
-- SECTION A: market_ath table + functions + seed  (run as one execution)
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_ath (
  type_id bigint NOT NULL,
  region_id bigint NOT NULL,
  all_time_high numeric NOT NULL,
  ath_date date,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (type_id, region_id)
);

COMMENT ON TABLE market_ath IS
'Highest daily price ever observed per item per region. Seeded from the full market_history (back to Dec 2024) and folded forward by the daily EVERef import, so it keeps growing even though market_history only retains ~100 days.';

-- Seed from the full history - MUST run before the SECTION C prune.
-- (The EVERef importer refuses to prune until this table exists.)
INSERT INTO market_ath (type_id, region_id, all_time_high, ath_date)
SELECT
  type_id,
  region_id,
  MAX(highest) AS all_time_high,
  (ARRAY_AGG(date ORDER BY highest DESC NULLS LAST))[1] AS ath_date
FROM market_history
WHERE highest IS NOT NULL
GROUP BY type_id, region_id
ON CONFLICT (type_id, region_id) DO UPDATE
  SET all_time_high = GREATEST(market_ath.all_time_high, EXCLUDED.all_time_high),
      ath_date = CASE
        WHEN EXCLUDED.all_time_high > market_ath.all_time_high THEN EXCLUDED.ath_date
        ELSE market_ath.ath_date
      END,
      updated_at = now();

-- Upsert function used by the EVERef importer after each daily import.
-- DISTINCT ON guards against duplicate (type, region) pairs within a batch.
CREATE OR REPLACE FUNCTION record_market_ath(p_entries jsonb)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO market_ath (type_id, region_id, all_time_high, ath_date)
  SELECT DISTINCT ON (t.type_id, t.region_id)
    t.type_id, t.region_id, t.highest, t.ath_date
  FROM (
    SELECT
      (e->>'type_id')::bigint AS type_id,
      (e->>'region_id')::bigint AS region_id,
      (e->>'highest')::numeric AS highest,
      (e->>'date')::date AS ath_date
    FROM jsonb_array_elements(p_entries) e
    WHERE (e->>'highest') IS NOT NULL
  ) t
  ORDER BY t.type_id, t.region_id, t.highest DESC
  ON CONFLICT (type_id, region_id) DO UPDATE
    SET all_time_high = GREATEST(market_ath.all_time_high, EXCLUDED.all_time_high),
        ath_date = CASE
          WHEN EXCLUDED.all_time_high > market_ath.all_time_high THEN EXCLUDED.ath_date
          ELSE market_ath.ath_date
        END,
        updated_at = now();
$$;

COMMENT ON FUNCTION record_market_ath IS
'Folds a batch of daily highs into market_ath. Called by /api/cron/market-history-import with entries [{type_id, region_id, highest, date}, ...].';

-- Redefine get_sell_statistics: ATH from market_ath (full depth), mean price
-- from the retained market_history window. FULL JOIN so items present on only
-- one side still return a row (e.g. history rows whose ATH fold failed, or
-- ATH-only items that stopped trading). Same signature and return shape as
-- migration 006, so no code changes.
CREATE OR REPLACE FUNCTION get_sell_statistics(
  p_type_ids BIGINT[],
  p_region_id BIGINT DEFAULT 10000002
)
RETURNS TABLE (
  type_id BIGINT,
  all_time_high NUMERIC,
  mean_price NUMERIC,
  data_points BIGINT
)
LANGUAGE sql
AS $$
  SELECT
    COALESCE(a.type_id, m.type_id) AS type_id,
    COALESCE(a.all_time_high, m.max_highest) AS all_time_high,
    COALESCE(m.mean_price, 0) AS mean_price,
    COALESCE(m.data_points, 0) AS data_points
  FROM (
    SELECT
      mh.type_id,
      ROUND(AVG(mh.average)::NUMERIC, 2) AS mean_price,
      MAX(mh.highest) AS max_highest,
      COUNT(*) AS data_points
    FROM market_history mh
    WHERE mh.type_id = ANY(p_type_ids)
      AND mh.region_id = p_region_id
    GROUP BY mh.type_id
  ) m
  FULL JOIN (
    SELECT ath.type_id, ath.all_time_high
    FROM market_ath ath
    WHERE ath.type_id = ANY(p_type_ids)
      AND ath.region_id = p_region_id
  ) a ON a.type_id = m.type_id;
$$;

COMMENT ON FUNCTION get_sell_statistics IS
'All-time high (from market_ath, full depth since Dec 2024) plus mean price over the retained market_history window. Used by sell-opportunities.';

-- ============================================================================
-- SECTION B: date index  (run as its own execution - index build on 3.7M
-- rows takes a while on free-tier compute; it makes the SECTION C deletes
-- and the importer's daily retention delete index scans instead of full scans)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_market_history_date ON market_history(date);

-- ============================================================================
-- SECTION C: prune to the retention window  (run EACH statement separately
-- if a combined run hits the 60s editor cap - each is an independent,
-- idempotent range delete)
-- ============================================================================

DELETE FROM market_history WHERE date < '2025-04-01';
DELETE FROM market_history WHERE date >= '2025-04-01' AND date < '2025-08-01';
DELETE FROM market_history WHERE date >= '2025-08-01' AND date < '2025-12-01';
DELETE FROM market_history WHERE date >= '2025-12-01' AND date < CURRENT_DATE - 100;

-- ============================================================================
-- SECTION D: drop redundant indexes  (run as one execution)
--   - idx_market_history_type_id duplicates the (type_id, date, region_id)
--     primary key's leading column.
--   - idx_market_history_updated_at is never queried by the app.
-- ============================================================================

DROP INDEX IF EXISTS idx_market_history_type_id;
DROP INDEX IF EXISTS idx_market_history_updated_at;

-- ============================================================================
-- SECTION E: reclaim disk  (run alone; Postgres does not shrink files on
-- DELETE - the space is only reused, not returned, until the table is
-- rewritten)
--
-- Option 1 (preferred): VACUUM FULL rewrites the table (exclusive lock for
-- a minute or two). It may exceed the SQL editor's 60s cap on free-tier
-- compute - if it times out, use Option 2 or run it via a direct psql
-- connection (Supavisor session mode), which has a longer timeout.
--
--   VACUUM FULL market_history;
--
-- Option 2 (editor-friendly): rebuild the table in steps, each under the cap.
-- Nothing references market_history by FK, and the RPC functions bind by
-- name at execution time, so the swap is safe. Run each statement separately:
--
--   CREATE TABLE market_history_new (LIKE market_history INCLUDING ALL);
--   INSERT INTO market_history_new SELECT * FROM market_history;
--   DROP TABLE market_history;
--   ALTER TABLE market_history_new RENAME TO market_history;
--   ALTER INDEX market_history_new_pkey RENAME TO market_history_pkey;
-- ============================================================================
