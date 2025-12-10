-- Migration 005: Add market_statistics function for efficient opportunity analysis
-- This function calculates statistics in PostgreSQL instead of fetching all rows
-- Updated to accept array of type_ids to avoid Supabase row limits

-- Drop old function if exists (with old signature)
DROP FUNCTION IF EXISTS get_market_statistics(BIGINT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_market_statistics(
  p_type_ids BIGINT[],                    -- Array of type_ids to analyze
  p_region_id BIGINT DEFAULT 10000002,    -- Region ID (default: The Forge/Jita)
  p_days_back INTEGER DEFAULT 365,        -- Use all available data by default
  p_min_data_points INTEGER DEFAULT 3     -- Lower threshold to include more items
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
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_from DATE;
BEGIN
  v_date_from := CURRENT_DATE - p_days_back;
  
  RETURN QUERY
  WITH ranked_prices AS (
    SELECT 
      mh.type_id,
      mh.date,
      mh.average,
      mh.volume,
      ROW_NUMBER() OVER (PARTITION BY mh.type_id ORDER BY mh.date ASC) as rn_asc,
      ROW_NUMBER() OVER (PARTITION BY mh.type_id ORDER BY mh.date DESC) as rn_desc
    FROM market_history mh
    WHERE mh.type_id = ANY(p_type_ids)  -- Filter by provided type_ids
      AND mh.region_id = p_region_id
      AND mh.date >= v_date_from
  ),
  aggregates AS (
    SELECT 
      rp.type_id,
      AVG(rp.average) as mean_price,
      STDDEV_POP(rp.average) as std_dev,
      AVG(rp.volume) as avg_volume,
      COUNT(*) as data_points
    FROM ranked_prices rp
    GROUP BY rp.type_id
    HAVING COUNT(*) >= p_min_data_points
  ),
  first_last AS (
    SELECT 
      rp.type_id,
      MAX(CASE WHEN rp.rn_asc = 1 THEN rp.average END) as first_price,
      MAX(CASE WHEN rp.rn_desc = 1 THEN rp.average END) as last_price
    FROM ranked_prices rp
    WHERE rp.rn_asc = 1 OR rp.rn_desc = 1
    GROUP BY rp.type_id
  )
  SELECT 
    a.type_id,
    ROUND(a.mean_price::NUMERIC, 2) as mean_price,
    ROUND(COALESCE(a.std_dev, 0)::NUMERIC, 4) as std_dev,
    ROUND(a.avg_volume::NUMERIC, 0) as avg_volume,
    a.data_points,
    CASE 
      WHEN a.mean_price > 0 THEN ROUND((COALESCE(a.std_dev, 0) / a.mean_price)::NUMERIC, 4)
      ELSE 0
    END as volatility,
    ROUND(fl.first_price::NUMERIC, 2) as first_price,
    ROUND(fl.last_price::NUMERIC, 2) as last_price,
    CASE 
      WHEN fl.first_price > 0 THEN ROUND(((fl.last_price - fl.first_price) / fl.first_price)::NUMERIC, 4)
      ELSE 0
    END as momentum
  FROM aggregates a
  JOIN first_last fl ON a.type_id = fl.type_id;
END;
$$;

-- Add a comment explaining the function
COMMENT ON FUNCTION get_market_statistics IS 
'Calculates market statistics (mean, stddev, volatility, momentum) for opportunity analysis.
Returns pre-aggregated data instead of raw rows for efficiency.
Parameters:
  - p_type_ids: Array of EVE type IDs to analyze (required)
  - p_region_id: EVE region ID (default 10000002 = The Forge/Jita)
  - p_days_back: Number of days of history to analyze (default 365)
  - p_min_data_points: Minimum days of data required (default 3)
Returns one row per type_id with statistics.';

-- Grant execute permission (adjust as needed for your Supabase setup)
-- GRANT EXECUTE ON FUNCTION get_market_statistics TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_market_statistics TO anon;
