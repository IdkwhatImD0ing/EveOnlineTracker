-- Migration 007: Add function to return price/volume arrays for signal analysis
-- This provides the raw data needed for cyclical, trend, support, and volume analysis
-- Much more efficient than fetching all rows individually

-- Drop old function if exists
DROP FUNCTION IF EXISTS get_market_history_arrays(BIGINT[], BIGINT, INTEGER);

CREATE OR REPLACE FUNCTION get_market_history_arrays(
  p_type_ids BIGINT[],                    -- Array of type_ids to fetch
  p_region_id BIGINT DEFAULT 10000002,    -- Region ID (default: The Forge/Jita)
  p_days_back INTEGER DEFAULT 90          -- Get last 90 days (enough for signal analysis)
)
RETURNS TABLE (
  type_id BIGINT,
  item_name TEXT,
  dates DATE[],
  prices NUMERIC[],
  volumes BIGINT[],
  highs NUMERIC[],
  lows NUMERIC[],
  data_points INTEGER,
  -- Pre-calculated basics to avoid re-querying
  mean_price NUMERIC,
  std_dev NUMERIC,
  avg_volume NUMERIC,
  volatility NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_from DATE;
BEGIN
  v_date_from := CURRENT_DATE - p_days_back;
  
  RETURN QUERY
  WITH ordered_history AS (
    SELECT 
      mh.type_id,
      mh.date,
      mh.average,
      mh.volume,
      mh.highest,
      mh.lowest
    FROM market_history mh
    WHERE mh.type_id = ANY(p_type_ids)
      AND mh.region_id = p_region_id
      AND mh.date >= v_date_from
    ORDER BY mh.type_id, mh.date ASC
  ),
  aggregated AS (
    SELECT
      oh.type_id,
      ARRAY_AGG(oh.date ORDER BY oh.date) as dates,
      ARRAY_AGG(oh.average ORDER BY oh.date) as prices,
      ARRAY_AGG(oh.volume ORDER BY oh.date) as volumes,
      ARRAY_AGG(oh.highest ORDER BY oh.date) as highs,
      ARRAY_AGG(oh.lowest ORDER BY oh.date) as lows,
      COUNT(*)::INTEGER as data_points,
      AVG(oh.average) as mean_price,
      STDDEV_POP(oh.average) as std_dev,
      AVG(oh.volume) as avg_volume
    FROM ordered_history oh
    GROUP BY oh.type_id
    HAVING COUNT(*) >= 30  -- Minimum 30 days for meaningful signal analysis
  )
  SELECT 
    a.type_id,
    ''::TEXT as item_name,  -- Item names loaded from file, not DB
    a.dates,
    a.prices,
    a.volumes,
    a.highs,
    a.lows,
    a.data_points,
    ROUND(a.mean_price::NUMERIC, 2),
    ROUND(COALESCE(a.std_dev, 0)::NUMERIC, 4),
    ROUND(a.avg_volume::NUMERIC, 0),
    CASE 
      WHEN a.mean_price > 0 THEN ROUND((COALESCE(a.std_dev, 0) / a.mean_price)::NUMERIC, 4)
      ELSE 0::NUMERIC
    END as volatility
  FROM aggregated a;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION get_market_history_arrays IS 
'Returns market history as arrays for multi-signal analysis.
Each row contains arrays of prices, volumes, highs, lows for one item.
This is much more efficient than fetching individual rows.

Parameters:
  - p_type_ids: Array of EVE type IDs to fetch (required)
  - p_region_id: EVE region ID (default 10000002 = The Forge/Jita)
  - p_days_back: Number of days of history (default 90, enough for signal analysis)

Returns one row per type_id with arrays of historical data.';

-- Grant execute permission
-- GRANT EXECUTE ON FUNCTION get_market_history_arrays TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_market_history_arrays TO anon;

