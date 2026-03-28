-- ============================================================
-- Migration 029: Unified credit system
-- One wallet per user, universal credits, exchange rates
-- ============================================================

-- ── 1. Credit exchange rates ─────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  currency TEXT NOT NULL UNIQUE,         -- czk, eur, chf, gbp, pln, huf...
  currency_label TEXT NOT NULL DEFAULT '',-- "Kč", "€", "CHF"...
  credits_per_unit NUMERIC(10,2) NOT NULL DEFAULT 1, -- how many credits for 1 unit of currency
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed exchange rates (1 CZK = 1 credit as base)
INSERT INTO credit_exchange_rates (currency, currency_label, credits_per_unit) VALUES
  ('czk', 'Kč',  1),
  ('eur', '€',   25),
  ('chf', 'CHF', 26),
  ('gbp', '£',   29),
  ('pln', 'zł',  6),
  ('huf', 'Ft',  0.065),
  ('bgn', 'лв',  13),
  ('ron', 'lei', 5),
  ('all', 'Lek', 0.25),
  ('try', '₺',   0.75)
ON CONFLICT (currency) DO NOTHING;

-- ── 2. Alter wallets: remove country constraint, add unified ──
-- Drop the unique constraint on (user_id, country) if exists
DO $$ BEGIN
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_country_key;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add credits column (integer, no decimals)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- ── 3. Convert listing_pricing to credits ─────────────────────
ALTER TABLE listing_pricing ADD COLUMN IF NOT EXISTS credits_per_day INTEGER DEFAULT 0;

-- Convert existing prices to credits based on exchange rates
-- CZK: price_per_day (in haléře/cents) / 100 * 1 credit/CZK
-- EUR: price_per_day (in cents) / 100 * 25 credits/EUR
-- etc.
UPDATE listing_pricing SET credits_per_day = CASE
  WHEN currency = 'czk' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 1))
  WHEN currency = 'eur' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 25))
  WHEN currency = 'chf' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 26))
  WHEN currency = 'gbp' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 29))
  WHEN currency = 'pln' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 6))
  WHEN currency = 'huf' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 0.065))
  WHEN currency = 'bgn' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 13))
  WHEN currency = 'ron' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 5))
  WHEN currency = 'all' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 0.25))
  WHEN currency = 'try' THEN GREATEST(1, ROUND(price_per_day::NUMERIC / 100 * 0.75))
  ELSE GREATEST(1, ROUND(price_per_day::NUMERIC / 100))
END;

-- ── 4. Wallet transactions: add credits column ───────────────
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;
