-- Server-side map clustering function
-- Returns pre-aggregated cluster centroids based on zoom level
-- so the frontend never needs more than ~500 rows even for 60K+ properties.
--
-- Precision by zoom:
--   zoom <= 7  → 0 decimal places (~111 km grid)
--   zoom 8-9   → 1 decimal place  (~11 km grid)
--   zoom 10-12 → 2 decimal places (~1 km grid)
--   zoom 13+   → raw pins via existing get_map_points / fallback query

CREATE OR REPLACE FUNCTION get_map_clusters(
  p_zoom        INT     DEFAULT 7,
  p_sw_lat      FLOAT   DEFAULT NULL,
  p_ne_lat      FLOAT   DEFAULT NULL,
  p_sw_lon      FLOAT   DEFAULT NULL,
  p_ne_lon      FLOAT   DEFAULT NULL,
  p_listing_type TEXT   DEFAULT NULL,
  p_category    TEXT    DEFAULT NULL,  -- comma-separated: 'apartment,house'
  p_price_min   FLOAT   DEFAULT NULL,
  p_price_max   FLOAT   DEFAULT NULL,
  p_area_min    FLOAT   DEFAULT NULL,
  p_area_max    FLOAT   DEFAULT NULL
)
RETURNS TABLE(
  lat           FLOAT,
  lon           FLOAT,
  cluster_count BIGINT,
  avg_price     FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  prec INT;
  cats TEXT[];
BEGIN
  prec := CASE
    WHEN p_zoom <= 7  THEN 0
    WHEN p_zoom <= 9  THEN 1
    WHEN p_zoom <= 12 THEN 2
    ELSE 3
  END;

  cats := CASE
    WHEN p_category IS NOT NULL THEN string_to_array(p_category, ',')
    ELSE NULL
  END;

  RETURN QUERY
  SELECT
    ROUND(p.latitude::numeric,  prec)::FLOAT AS lat,
    ROUND(p.longitude::numeric, prec)::FLOAT AS lon,
    COUNT(*)                                  AS cluster_count,
    AVG(p.price)::FLOAT                       AS avg_price
  FROM properties p
  WHERE p.active      = true
    AND p.latitude    IS NOT NULL
    AND p.longitude   IS NOT NULL
    AND (p_sw_lat      IS NULL OR p.latitude  >= p_sw_lat)
    AND (p_ne_lat      IS NULL OR p.latitude  <= p_ne_lat)
    AND (p_sw_lon      IS NULL OR p.longitude >= p_sw_lon)
    AND (p_ne_lon      IS NULL OR p.longitude <= p_ne_lon)
    AND (p_listing_type IS NULL OR p.listing_type::TEXT = p_listing_type)
    AND (cats          IS NULL OR p.category::TEXT = ANY(cats))
    AND (p_price_min   IS NULL OR p.price >= p_price_min)
    AND (p_price_max   IS NULL OR p.price <= p_price_max)
    AND (p_area_min    IS NULL OR p.area  >= p_area_min)
    AND (p_area_max    IS NULL OR p.area  <= p_area_max)
  GROUP BY
    ROUND(p.latitude::numeric,  prec),
    ROUND(p.longitude::numeric, prec);
END;
$$;
