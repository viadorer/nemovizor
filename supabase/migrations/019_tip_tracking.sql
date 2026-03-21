-- ===== TIP (featured) product: expiration + tracking =====

-- 1. Add featured_until to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_properties_featured_until ON properties(featured_until) WHERE featured_until IS NOT NULL;

-- 2. Add view_type to property_views to distinguish impression types
ALTER TABLE property_views ADD COLUMN IF NOT EXISTS view_type TEXT NOT NULL DEFAULT 'detail'
  CHECK (view_type IN ('tip_impression', 'listing_impression', 'detail', 'detail_click'));

-- Index for view_type queries
CREATE INDEX IF NOT EXISTS idx_property_views_type ON property_views(property_id, view_type);

-- 3. Update 7-day view to include view_type breakdown
CREATE OR REPLACE VIEW property_views_7d AS
SELECT
  property_id,
  COUNT(*) AS view_count,
  COUNT(*) FILTER (WHERE view_type = 'tip_impression') AS tip_impressions,
  COUNT(*) FILTER (WHERE view_type = 'detail_click') AS detail_clicks,
  COUNT(*) FILTER (WHERE view_type = 'detail') AS detail_views
FROM property_views
WHERE viewed_at > now() - INTERVAL '7 days'
GROUP BY property_id;

-- 4. View for TIP stats per property (all time)
CREATE OR REPLACE VIEW property_tip_stats AS
SELECT
  property_id,
  COUNT(*) FILTER (WHERE view_type = 'tip_impression') AS tip_impressions,
  COUNT(*) FILTER (WHERE view_type = 'detail_click') AS tip_clicks,
  MIN(viewed_at) FILTER (WHERE view_type = 'tip_impression') AS first_tip_impression,
  MAX(viewed_at) FILTER (WHERE view_type = 'tip_impression') AS last_tip_impression
FROM property_views
GROUP BY property_id;
