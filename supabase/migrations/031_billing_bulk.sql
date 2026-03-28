-- ============================================================
-- Migration 031: Bulk daily billing (replaces row-by-row)
-- Single pass: computes per-user daily totals, deducts in bulk
-- ============================================================

DROP FUNCTION IF EXISTS run_daily_billing(date);

CREATE OR REPLACE FUNCTION run_daily_billing(
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(billed INT, skipped INT, total_credits INT) AS $$
DECLARE
  v_billed  INT := 0;
  v_skipped INT := 0;
  v_total   INT := 0;
  v_rec     RECORD;
BEGIN
  -- ── Step 1: Insert billing_daily_log for all active properties
  --            that have a broker → user → wallet chain
  --            and haven't been billed today yet ────────────────

  CREATE TEMP TABLE _billing_batch ON COMMIT DROP AS
  WITH billable AS (
    SELECT
      p.id AS property_id,
      p.country,
      p.city,
      p.listing_type::TEXT AS listing_type,
      b.user_id,
      w.id AS wallet_id,
      w.credits AS wallet_credits,
      COALESCE(w.promo_balance, 0) AS wallet_promo,
      COALESCE(w.discount_pct, 0) AS wallet_discount
    FROM properties p
    JOIN brokers b ON b.id = p.broker_id AND b.user_id IS NOT NULL
    JOIN wallets w ON w.user_id = b.user_id AND NOT w.frozen
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1 FROM billing_daily_log bdl
        WHERE bdl.property_id = p.id AND bdl.billing_date = p_date
      )
  ),
  with_price AS (
    SELECT
      bl.*,
      COALESCE((
        SELECT lp.credits_per_day
        FROM listing_pricing lp
        WHERE lp.country = bl.country
          AND lp.active = true
          AND (lp.listing_type = bl.listing_type OR lp.listing_type IS NULL)
          AND (lp.city = bl.city OR lp.city IS NULL)
        ORDER BY
          (CASE WHEN lp.city IS NOT NULL THEN 2 ELSE 0 END) +
          (CASE WHEN lp.listing_type IS NOT NULL THEN 1 ELSE 0 END) DESC
        LIMIT 1
      ), 0) AS base_credits
    FROM billable bl
  ),
  with_volume AS (
    SELECT
      wp.*,
      -- Count active listings per user+country for volume discount
      (SELECT COUNT(*) FROM properties p2
       JOIN brokers b2 ON b2.id = p2.broker_id
       WHERE b2.user_id = wp.user_id AND p2.country = wp.country AND p2.active = true
      ) AS listing_count
    FROM with_price wp
    WHERE wp.base_credits > 0
  ),
  with_discount AS (
    SELECT
      wv.*,
      COALESCE((
        SELECT vd.discount_pct FROM volume_discounts vd
        WHERE vd.country = wv.country
          AND vd.min_listings <= wv.listing_count
          AND (vd.max_listings IS NULL OR vd.max_listings > wv.listing_count)
        ORDER BY vd.min_listings DESC LIMIT 1
      ), 0) AS volume_discount
    FROM with_volume wv
  )
  SELECT
    wd.property_id,
    wd.wallet_id,
    wd.user_id,
    wd.country,
    wd.city,
    wd.listing_type,
    wd.base_credits,
    wd.volume_discount,
    wd.wallet_discount,
    -- Calculate final credits with compound discount, min 1
    GREATEST(1,
      wd.base_credits
      - (wd.base_credits * wd.volume_discount / 100)
      - (wd.base_credits * wd.wallet_discount / 100)
    ) AS final_credits
  FROM with_discount wd;

  -- ── Step 2: Insert billing logs ────────────────────────────
  INSERT INTO billing_daily_log (property_id, wallet_id, billing_date, amount, currency, discount_pct)
  SELECT
    bb.property_id, bb.wallet_id, p_date, bb.final_credits, 'credits',
    bb.volume_discount + bb.wallet_discount
  FROM _billing_batch bb;

  GET DIAGNOSTICS v_billed = ROW_COUNT;

  -- ── Step 3: Aggregate per wallet and deduct credits ────────
  FOR v_rec IN
    SELECT
      bb.wallet_id,
      bb.user_id,
      SUM(bb.final_credits) AS total_debit
    FROM _billing_batch bb
    GROUP BY bb.wallet_id, bb.user_id
  LOOP
    -- Deduct from wallet (promo first, then main)
    DECLARE
      v_wallet  wallets%ROWTYPE;
      v_from_promo INT := 0;
      v_from_main  INT;
    BEGIN
      SELECT * INTO v_wallet FROM wallets WHERE id = v_rec.wallet_id FOR UPDATE;

      IF COALESCE(v_wallet.promo_balance, 0) > 0 THEN
        v_from_promo := LEAST(v_wallet.promo_balance, v_rec.total_debit::INT);
      END IF;
      v_from_main := v_rec.total_debit::INT - v_from_promo;

      UPDATE wallets SET
        credits = credits - v_from_main,
        promo_balance = COALESCE(promo_balance, 0) - v_from_promo,
        updated_at = NOW()
      WHERE id = v_rec.wallet_id;

      -- Single transaction per wallet per day (summary)
      INSERT INTO wallet_transactions (
        wallet_id, type, amount, balance_before, balance_after, credits,
        category, description, reference_type, created_by
      ) VALUES (
        v_rec.wallet_id, 'debit',
        v_rec.total_debit::INT,
        v_wallet.credits,
        v_wallet.credits - v_from_main,
        v_rec.total_debit::INT,
        'daily_billing',
        format('Denní inzerce %s — %s nemovitostí, celkem %s kr', p_date, v_billed, v_rec.total_debit),
        'system', v_rec.user_id
      );

      v_total := v_total + v_rec.total_debit::INT;
    END;
  END LOOP;

  v_skipped := (SELECT COUNT(*) FROM properties WHERE active = true) - v_billed;

  RETURN QUERY SELECT v_billed, v_skipped, v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
