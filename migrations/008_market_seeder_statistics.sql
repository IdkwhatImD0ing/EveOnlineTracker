-- Migration 008: Add market_seeder_statistics function for efficient market seeder analysis
-- This function calculates demand metrics (volume, trend) in PostgreSQL instead of fetching all rows
-- Uses batched type_id arrays to avoid Supabase 1000-row limit

-- Drop existing function to ensure clean creation
DROP FUNCTION IF EXISTS get_market_seeder_statistics(BIGINT[], BIGINT, INTEGER);

CREATE OR REPLACE FUNCTION get_market_seeder_statistics(
  p_type_ids BIGINT[],                    -- Array of type_ids to analyze
  p_region_id BIGINT DEFAULT 10000002,    -- Region ID (default: The Forge/Jita)
  p_days_back INTEGER DEFAULT 30          -- Days of history to analyze
)
RETURNS TABLE (
  type_id BIGINT,
  total_volume NUMERIC,
  avg_daily_volume NUMERIC,
  avg_price NUMERIC,
  total_orders BIGINT,
  recent_avg_volume NUMERIC,   -- Last 7 days average
  older_avg_volume NUMERIC,    -- Days 8-30 average
  trend_direction TEXT         -- 'up', 'down', 'stable'
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_from DATE;
  v_seven_days_ago DATE;
BEGIN
  v_date_from := CURRENT_DATE - p_days_back;
  v_seven_days_ago := CURRENT_DATE - 7;
  
  RETURN QUERY
  WITH all_data AS (
    SELECT 
      mh.type_id,
      mh.date,
      mh.volume,
      mh.average,
      mh.order_count,
      CASE WHEN mh.date >= v_seven_days_ago THEN true ELSE false END as is_recent
    FROM market_history mh
    WHERE mh.type_id = ANY(p_type_ids)
      AND mh.region_id = p_region_id
      AND mh.date >= v_date_from
  ),
  aggregated AS (
    SELECT 
      ad.type_id,
      SUM(ad.volume) as total_volume,
      COUNT(*) as day_count,
      AVG(ad.average) as avg_price,
      SUM(ad.order_count) as total_orders,
      -- Recent period (last 7 days)
      SUM(CASE WHEN ad.is_recent THEN ad.volume ELSE 0 END) as recent_volume,
      COUNT(CASE WHEN ad.is_recent THEN 1 END) as recent_days,
      -- Older period (days 8-30)
      SUM(CASE WHEN NOT ad.is_recent THEN ad.volume ELSE 0 END) as older_volume,
      COUNT(CASE WHEN NOT ad.is_recent THEN 1 END) as older_days
    FROM all_data ad
    GROUP BY ad.type_id
  )
  SELECT 
    a.type_id,
    ROUND(a.total_volume::NUMERIC, 0),
    ROUND((a.total_volume / NULLIF(a.day_count, 0))::NUMERIC, 2),
    ROUND(a.avg_price::NUMERIC, 2),
    a.total_orders::BIGINT,  -- Cast to BIGINT to match return type
    ROUND((a.recent_volume / NULLIF(a.recent_days, 0))::NUMERIC, 2),
    ROUND((a.older_volume / NULLIF(a.older_days, 0))::NUMERIC, 2),
    CASE 
      WHEN a.older_days = 0 OR a.older_volume = 0 THEN 'stable'::TEXT
      WHEN (a.recent_volume / NULLIF(a.recent_days, 0)) / (a.older_volume / NULLIF(a.older_days, 0)) > 1.2 THEN 'up'::TEXT
      WHEN (a.recent_volume / NULLIF(a.recent_days, 0)) / (a.older_volume / NULLIF(a.older_days, 0)) < 0.8 THEN 'down'::TEXT
      ELSE 'stable'::TEXT
    END
  FROM aggregated a;
END;
$$;

-- Add a comment explaining the function
COMMENT ON FUNCTION get_market_seeder_statistics IS 
'Calculates market demand statistics for market seeder analysis.
Returns aggregated volume metrics and trend direction per type_id.
Parameters:
  - p_type_ids: Array of EVE type IDs to analyze (required)
  - p_region_id: EVE region ID (default 10000002 = The Forge/Jita)
  - p_days_back: Number of days of history to analyze (default 30)
Returns one row per type_id with:
  - total_volume: Sum of all volume in period
  - avg_daily_volume: Average volume per day
  - avg_price: Average price over period
  - total_orders: Sum of order counts
  - recent_avg_volume: Average daily volume for last 7 days
  - older_avg_volume: Average daily volume for days 8-30
  - trend_direction: up (>20% increase), down (>20% decrease), or stable';

-- Grant execute permission (adjust as needed for your Supabase setup)
-- GRANT EXECUTE ON FUNCTION get_market_seeder_statistics TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_market_seeder_statistics TO anon;
