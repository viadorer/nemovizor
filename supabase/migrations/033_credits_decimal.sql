-- ============================================================
-- 033: Change credits to NUMERIC(12,2) for decimal precision
-- Supports values like 1.34 kr for discounts
-- ============================================================

-- Wallet balance
ALTER TABLE wallets ALTER COLUMN credits TYPE NUMERIC(12,2);
ALTER TABLE wallets ALTER COLUMN promo_balance TYPE NUMERIC(12,2);

-- Transactions
ALTER TABLE wallet_transactions ALTER COLUMN credits TYPE NUMERIC(12,2);
ALTER TABLE wallet_transactions ALTER COLUMN balance_before TYPE NUMERIC(12,2);
ALTER TABLE wallet_transactions ALTER COLUMN balance_after TYPE NUMERIC(12,2);

-- Listing pricing
ALTER TABLE listing_pricing ALTER COLUMN credits_per_day TYPE NUMERIC(10,2);

-- Volume discounts — discount_pct is already numeric

-- Billing daily summary
ALTER TABLE billing_daily_summary ALTER COLUMN total_credits TYPE NUMERIC(12,2);

-- Exchange rates
ALTER TABLE credit_exchange_rates ALTER COLUMN credits_per_unit TYPE NUMERIC(10,2);

-- Recreate billing functions with NUMERIC types
DROP FUNCTION IF EXISTS bill_listing_day(uuid, date);
DROP FUNCTION IF EXISTS run_daily_billing(date);

CREATE OR REPLACE FUNCTION run_daily_billing(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(user_id UUID, total_credits NUMERIC, listings_count INT) AS $$
DECLARE
  r RECORD;
  v_wallet_id UUID;
  v_credits NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_discount NUMERIC(5,2);
  v_breakdown JSONB;
  v_count INT;
BEGIN
  FOR r IN
    SELECT DISTINCT w.id AS wallet_id, w.user_id, w.discount_pct
    FROM wallets w
    WHERE w.credits > 0 AND w.frozen = FALSE
  LOOP
    v_wallet_id := r.wallet_id;
    v_discount := COALESCE(r.discount_pct, 0);
    v_total := 0;
    v_count := 0;
    v_breakdown := '{}'::JSONB;

    -- Find all active properties for this user's brokers
    FOR v_credits IN
      SELECT
        COALESCE(lp.credits_per_day, 1) * (1 - v_discount / 100.0) AS cost
      FROM properties p
      JOIN brokers b ON b.id = p.broker_id
      LEFT JOIN listing_pricing lp ON
        lp.country = COALESCE(p.country, 'cz')
        AND lp.listing_type = p.listing_type::TEXT
        AND lp.active = TRUE
        AND (lp.city IS NULL OR LOWER(lp.city) = LOWER(p.city))
      WHERE b.user_id = r.user_id
        AND p.active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM billing_daily_log bdl
          WHERE bdl.property_id = p.id AND bdl.billing_date = p_date
        )
    LOOP
      v_total := v_total + GREATEST(v_credits, 0);
      v_count := v_count + 1;
    END LOOP;

    IF v_total > 0 THEN
      -- Deduct from wallet
      UPDATE wallets SET credits = credits - v_total WHERE id = v_wallet_id;

      -- Record transaction
      INSERT INTO wallet_transactions (wallet_id, type, amount, credits, balance_before, balance_after, category, description, reference_type)
      SELECT v_wallet_id, 'debit', v_total, v_total,
        credits + v_total, credits,
        'daily_billing',
        format('Denní inzerce %s — %s inzerátů, %s kr', p_date, v_count, ROUND(v_total, 2)),
        'system'
      FROM wallets WHERE id = v_wallet_id;

      -- Record summary
      INSERT INTO billing_daily_summary (wallet_id, user_id, billing_date, total_credits, listings_billed, discount_applied, breakdown)
      VALUES (v_wallet_id, r.user_id, p_date, v_total, v_count, v_discount, v_breakdown)
      ON CONFLICT (wallet_id, billing_date) DO NOTHING;

      user_id := r.user_id;
      total_credits := v_total;
      listings_count := v_count;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
