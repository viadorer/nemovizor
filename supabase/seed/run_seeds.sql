-- ============================================================
-- Nemovizor – Run all seeds
-- Spustte v Supabase SQL Editor nebo pres CLI:
--   psql $DATABASE_URL -f supabase/seed/run_seeds.sql
-- ============================================================

-- Vymazat stavajici zkusebni data (poradi kvuli FK)
TRUNCATE reviews CASCADE;
TRUNCATE branches CASCADE;
TRUNCATE properties CASCADE;
TRUNCATE brokers CASCADE;
TRUNCATE agencies CASCADE;

-- Vlozit seed data (poradi kvuli FK)
\i 003_agencies.sql
\i 001_brokers.sql
\i 002_properties.sql
\i 004_branches.sql
\i 005_reviews.sql

-- Overit
SELECT 'Agencies:' AS info, count(*) FROM agencies
UNION ALL
SELECT 'Brokers:', count(*) FROM brokers
UNION ALL
SELECT 'Properties:', count(*) FROM properties
UNION ALL
SELECT 'Branches:', count(*) FROM branches
UNION ALL
SELECT 'Reviews:', count(*) FROM reviews;
