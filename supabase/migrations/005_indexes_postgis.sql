-- ============================================================
-- 005: Performance indexes + PostGIS for 130k+ properties
-- ============================================================

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column for spatial queries
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Populate geom from lat/lon
UPDATE properties SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Trigger to auto-update geom on insert/update
CREATE OR REPLACE FUNCTION update_property_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_geom ON properties;
CREATE TRIGGER trg_property_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties
  FOR EACH ROW EXECUTE FUNCTION update_property_geom();

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_props_geom ON properties USING GIST (geom);

-- Composite filter indexes (most common query patterns)
CREATE INDEX IF NOT EXISTS idx_props_active_type_cat ON properties(active, listing_type, category);
CREATE INDEX IF NOT EXISTS idx_props_active_city ON properties(active, city);
CREATE INDEX IF NOT EXISTS idx_props_active_price ON properties(active, listing_type, price);
CREATE INDEX IF NOT EXISTS idx_props_active_area ON properties(active, listing_type, area);
CREATE INDEX IF NOT EXISTS idx_props_featured ON properties(active, featured DESC, created_at DESC);

-- Partial index for active properties only (most queries filter by active=true)
CREATE INDEX IF NOT EXISTS idx_props_active_slug ON properties(slug) WHERE active = true;

-- Broker/Agency lookup
CREATE INDEX IF NOT EXISTS idx_brokers_agency_id ON brokers(agency_id);
CREATE INDEX IF NOT EXISTS idx_props_broker ON properties(broker_id) WHERE broker_id IS NOT NULL;

-- ===== Materialized view for filter option counts =====
CREATE MATERIALIZED VIEW IF NOT EXISTS property_filter_counts AS
SELECT
  listing_type,
  category,
  subtype,
  city,
  condition,
  ownership,
  furnishing,
  energy_rating,
  building_material,
  COUNT(*) as cnt,
  MIN(price) as price_min,
  MAX(price) as price_max,
  MIN(area) as area_min,
  MAX(area) as area_max
FROM properties
WHERE active = true
GROUP BY GROUPING SETS (
  (listing_type),
  (listing_type, category),
  (listing_type, category, subtype),
  (listing_type, city),
  (category),
  (city),
  (condition),
  (ownership),
  (furnishing),
  (energy_rating),
  (building_material)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pfc_unique ON property_filter_counts(
  COALESCE(listing_type, ''), COALESCE(category, ''), COALESCE(subtype, ''),
  COALESCE(city, ''), COALESCE(condition, ''), COALESCE(ownership, ''),
  COALESCE(furnishing, ''), COALESCE(energy_rating, ''), COALESCE(building_material, '')
);

-- Function to refresh the materialized view (call periodically or after bulk imports)
CREATE OR REPLACE FUNCTION refresh_filter_counts()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY property_filter_counts;
END;
$$ LANGUAGE plpgsql;

-- ===== RPC function for map points (fast geo query) =====
CREATE OR REPLACE FUNCTION get_map_points(
  p_listing_type TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_bounds_sw_lat DOUBLE PRECISION DEFAULT NULL,
  p_bounds_sw_lon DOUBLE PRECISION DEFAULT NULL,
  p_bounds_ne_lat DOUBLE PRECISION DEFAULT NULL,
  p_bounds_ne_lon DOUBLE PRECISION DEFAULT NULL,
  p_limit INTEGER DEFAULT 5000
)
RETURNS TABLE(
  id UUID,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  price NUMERIC,
  category TEXT,
  listing_type TEXT,
  title TEXT,
  slug TEXT,
  rooms_label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.latitude AS lat,
    p.longitude AS lon,
    p.price,
    p.category::TEXT,
    p.listing_type::TEXT,
    p.title,
    p.slug,
    p.rooms_label
  FROM properties p
  WHERE p.active = true
    AND (p_listing_type IS NULL OR p.listing_type::TEXT = p_listing_type)
    AND (p_category IS NULL OR p.category::TEXT = p_category)
    AND (p_city IS NULL OR p.city = p_city)
    AND (p_price_min IS NULL OR p.price >= p_price_min)
    AND (p_price_max IS NULL OR p.price <= p_price_max)
    AND (
      p_bounds_sw_lat IS NULL
      OR p.geom && ST_MakeEnvelope(p_bounds_sw_lon, p_bounds_sw_lat, p_bounds_ne_lon, p_bounds_ne_lat, 4326)
    )
  ORDER BY p.featured DESC, p.price DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
