-- ============================================================
-- Nemovizor – Run all seeds
-- Spustte v Supabase SQL Editor nebo pres CLI:
--   psql $DATABASE_URL -f supabase/seed/run_seeds.sql
-- ============================================================

-- Vymazat stavajici zkusebni data
TRUNCATE properties CASCADE;
TRUNCATE brokers CASCADE;

-- Vlozit seed data
\i 001_brokers.sql
\i 002_properties.sql

-- Overit
SELECT 'Brokers:' AS info, count(*) FROM brokers
UNION ALL
SELECT 'Properties:', count(*) FROM properties;
