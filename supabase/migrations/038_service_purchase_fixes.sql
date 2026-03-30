-- ============================================================
-- 038: Service purchase fixes — missing columns + expiration
-- ============================================================

-- Agency promo support
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT FALSE;

-- TOP position for properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS top_position BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS top_until TIMESTAMPTZ;

-- Premium listing flag
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Ensure credits_price exists on service_catalog (may already exist from 033)
DO $$ BEGIN
  ALTER TABLE service_catalog ADD COLUMN credits_price NUMERIC(10,2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update credits_price for all services (if not already set)
UPDATE service_catalog SET credits_price = 50 WHERE code = 'tip_7d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 150 WHERE code = 'tip_30d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 100 WHERE code = 'top_listing_7d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 250 WHERE code = 'top_listing_30d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 30 WHERE code = 'listing_basic_30d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 80 WHERE code = 'listing_premium_30d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 120 WHERE code = 'broker_promo_30d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 200 WHERE code = 'agency_promo_30d' AND (credits_price IS NULL OR credits_price = 0);
UPDATE service_catalog SET credits_price = 500 WHERE code = 'project_page' AND (credits_price IS NULL OR credits_price = 0);

-- Add expiration cleanup to existing daily cron (or create new)
-- Run this manually if pg_cron is available:
-- SELECT cron.schedule('expire-services', '5 2 * * *', $$
--   UPDATE properties SET featured = false WHERE featured_until < NOW() AND featured = true;
--   UPDATE properties SET top_position = false WHERE top_until < NOW() AND top_position = true;
--   UPDATE brokers SET is_promoted = false WHERE is_promoted = true
--     AND NOT EXISTS (SELECT 1 FROM purchases WHERE broker_id = brokers.id AND status = 'active' AND expires_at > NOW());
--   UPDATE agencies SET is_promoted = false WHERE is_promoted = true
--     AND NOT EXISTS (SELECT 1 FROM purchases WHERE agency_id = agencies.id AND status = 'active' AND expires_at > NOW());
--   UPDATE purchases SET status = 'expired' WHERE status = 'active' AND expires_at < NOW();
-- $$);
