-- Migration 006: Add sell_statistics function for efficient sell opportunity analysis
-- This function aggregates ATH and mean price for given type_ids in a single query
-- avoiding the Supabase 1000 row limit issue

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
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mh.type_id,
    MAX(mh.highest) as all_time_high,
    ROUND(AVG(mh.average)::NUMERIC, 2) as mean_price,
    COUNT(*) as data_points
  FROM market_history mh
  WHERE mh.type_id = ANY(p_type_ids)
    AND mh.region_id = p_region_id
  GROUP BY mh.type_id;
END;
$$;

-- Add a comment explaining the function
COMMENT ON FUNCTION get_sell_statistics IS 
'Calculates all-time high and mean price for given type_ids in a single query.
Used by sell-opportunities to efficiently fetch market statistics.
Parameters:
  - p_type_ids: Array of EVE type IDs to look up
  - p_region_id: EVE region ID (default 10000002 = The Forge/Jita)
Returns one row per type_id with ATH, mean price, and data point count.';

-- Grant execute permission (adjust as needed for your Supabase setup)
-- GRANT EXECUTE ON FUNCTION get_sell_statistics TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_sell_statistics TO anon;

