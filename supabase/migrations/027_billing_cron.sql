-- ============================================================
-- 027_billing_cron.sql
-- Enable pg_cron and schedule nightly billing at 2:00 AM UTC
-- ============================================================

-- Enable pg_cron extension (must be done by superuser / dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily billing at 2:00 AM UTC
SELECT cron.schedule(
  'daily-listing-billing',
  '0 2 * * *',
  $$SELECT * FROM run_daily_billing()$$
);
