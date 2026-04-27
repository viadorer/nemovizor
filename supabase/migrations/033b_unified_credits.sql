-- =============================================================
-- Migration 033: Unified credit system — one wallet per user
-- =============================================================

-- 1. billing_daily_summary — one row per user per day
CREATE TABLE IF NOT EXISTS billing_daily_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  user_id UUID NOT NULL,
  billing_date DATE NOT NULL,
  total_credits INT NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_credits INT NOT NULL DEFAULT 0,
  final_credits INT NOT NULL DEFAULT 0,
  listing_count INT NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}',
  transaction_id UUID REFERENCES wallet_transactions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, billing_date)
);

-- 2. credit_exchange_rates — how many credits per 1 unit of currency
CREATE TABLE IF NOT EXISTS credit_exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  currency TEXT NOT NULL UNIQUE,
  credits_per_unit NUMERIC(10,2) NOT NULL, -- e.g. 1 EUR = 25 credits, 1 CZK = 1 credit
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO credit_exchange_rates (currency, credits_per_unit) VALUES
  ('czk', 1),
  ('eur', 25),
  ('chf', 26),
  ('gbp', 29),
  ('pln', 6),
  ('huf', 0.07),
  ('bgn', 13),
  ('ron', 5),
  ('all', 0.25),
  ('try', 0.75)
ON CONFLICT (currency) DO NOTHING;

-- 3. Update service_catalog — add credits_price column
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS credits_price INT;

UPDATE service_catalog SET credits_price = CASE code
  WHEN 'tip_7d' THEN 50
  WHEN 'tip_30d' THEN 150
  WHEN 'top_listing_7d' THEN 100
  WHEN 'top_listing_30d' THEN 250
  WHEN 'listing_basic_30d' THEN 30
  WHEN 'listing_premium_30d' THEN 80
  WHEN 'broker_promo_30d' THEN 120
  WHEN 'agency_promo_30d' THEN 200
  WHEN 'project_page' THEN 500
  ELSE 0
END
WHERE credits_price IS NULL;

-- 4. New billing function: one summary per user per day
CREATE OR REPLACE FUNCTION run_daily_billing(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(user_id UUID, total_credits INT, listing_count INT) AS $$
DECLARE
  w RECORD;
  prop RECORD;
  day_total INT;
  day_count INT;
  day_breakdown JSONB;
  rate_row RECORD;
  discount NUMERIC;
  discount_cr INT;
  final_cr INT;
  tx_id UUID;
  group_key TEXT;
BEGIN
  -- For each wallet (one per user)
  FOR w IN
    SELECT wl.id AS wallet_id, wl.user_id, wl.credits, wl.discount_pct
    FROM wallets wl
    WHERE wl.frozen = false AND wl.credits > 0
  LOOP
    -- Skip if already billed today
    IF EXISTS (SELECT 1 FROM billing_daily_summary WHERE billing_daily_summary.user_id = w.user_id AND billing_date = p_date) THEN
      CONTINUE;
    END IF;

    -- Find broker(s) for this user
    day_total := 0;
    day_count := 0;
    day_breakdown := '{}'::JSONB;

    -- Count properties grouped by country + listing_type
    FOR prop IN
      SELECT p.country, p.listing_type::TEXT AS lt, COUNT(*) AS cnt
      FROM properties p
      JOIN brokers b ON b.id = p.broker_id
      WHERE b.user_id = w.user_id
        AND p.active = true
      GROUP BY p.country, p.listing_type
    LOOP
      -- Find best matching rate: city-specific first, then country fallback
      SELECT lp.credits_per_day INTO rate_row
      FROM listing_pricing lp
      WHERE lp.country = prop.country
        AND lp.listing_type::TEXT = prop.lt
        AND lp.active = true
        AND lp.city IS NULL
      LIMIT 1;

      IF rate_row IS NULL THEN
        -- Universal fallback: 1 credit/day
        rate_row := ROW(1);
      END IF;

      group_key := COALESCE(prop.country, '??') || '_' || COALESCE(prop.lt, 'sale');
      day_total := day_total + (prop.cnt * rate_row.credits_per_day);
      day_count := day_count + prop.cnt;
      day_breakdown := day_breakdown || jsonb_build_object(
        group_key, jsonb_build_object('count', prop.cnt, 'rate', rate_row.credits_per_day, 'subtotal', prop.cnt * rate_row.credits_per_day)
      );
    END LOOP;

    -- Skip if nothing to bill
    IF day_total = 0 THEN CONTINUE; END IF;

    -- Apply discount
    discount := COALESCE(w.discount_pct, 0);
    discount_cr := FLOOR(day_total * discount / 100);
    final_cr := day_total - discount_cr;

    -- Don't charge more than available
    IF final_cr > w.credits THEN
      final_cr := w.credits;
    END IF;

    -- Create wallet transaction
    INSERT INTO wallet_transactions (wallet_id, type, amount, balance_before, balance_after, credits, category, description, reference_type, created_by)
    VALUES (w.wallet_id, 'debit', final_cr, w.credits, w.credits - final_cr, final_cr, 'daily_billing',
            'Denní inzerce ' || p_date || ' — ' || day_count || ' inzerátů, ' || final_cr || ' kr',
            'system', w.user_id)
    RETURNING id INTO tx_id;

    -- Update wallet balance
    UPDATE wallets SET credits = credits - final_cr, updated_at = now() WHERE id = w.wallet_id;

    -- Insert summary
    INSERT INTO billing_daily_summary (wallet_id, user_id, billing_date, total_credits, discount_pct, discount_credits, final_credits, listing_count, breakdown, transaction_id)
    VALUES (w.wallet_id, w.user_id, p_date, day_total, discount, discount_cr, final_cr, day_count, day_breakdown, tx_id);

    user_id := w.user_id;
    total_credits := final_cr;
    listing_count := day_count;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update cron (if pg_cron available)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-billing');
  PERFORM cron.schedule('daily-billing', '0 2 * * *', 'SELECT * FROM run_daily_billing()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, skip cron setup';
END $$;
