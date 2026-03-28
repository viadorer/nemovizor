-- ============================================================
-- Migration 032: Fast bulk billing — pre-aggregate counts
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
  -- ── Pre-compute listing counts per user+country ────────────
  CREATE TEMP TABLE _user_counts ON COMMIT DROP AS
  SELECT b.user_id, p.country, COUNT(*) AS cnt
  FROM properties p
  JOIN brokers b ON b.id = p.broker_id AND b.user_id IS NOT NULL
  WHERE p.active = true
  GROUP BY b.user_id, p.country;

  -- ── Build billing batch ────────────────────────────────────
  CREATE TEMP TABLE _billing_batch ON COMMIT DROP AS
  SELECT
    p.id AS property_id,
    w.id AS wallet_id,
    b.user_id,
    p.country,
    p.city,
    p.listing_type::TEXT AS listing_type,
    COALESCE(w.discount_pct, 0) AS wallet_discount,
    -- Price lookup: most specific match
    COALESCE((
      SELECT lp.credits_per_day
      FROM listing_pricing lp
      WHERE lp.country = p.country AND lp.active = true
        AND (lp.listing_type = p.listing_type::TEXT OR lp.listing_type IS NULL)
        AND (lp.city = p.city OR lp.city IS NULL)
      ORDER BY
        (CASE WHEN lp.city IS NOT NULL THEN 2 ELSE 0 END) +
        (CASE WHEN lp.listing_type IS NOT NULL THEN 1 ELSE 0 END) DESC
      LIMIT 1
    ), 0) AS base_credits,
    -- Volume discount from pre-computed counts
    COALESCE((
      SELECT vd.discount_pct FROM volume_discounts vd
      WHERE vd.country = p.country
        AND vd.min_listings <= uc.cnt
        AND (vd.max_listings IS NULL OR vd.max_listings > uc.cnt)
      ORDER BY vd.min_listings DESC LIMIT 1
    ), 0) AS volume_discount
  FROM properties p
  JOIN brokers b ON b.id = p.broker_id AND b.user_id IS NOT NULL
  JOIN wallets w ON w.user_id = b.user_id AND NOT w.frozen
  LEFT JOIN _user_counts uc ON uc.user_id = b.user_id AND uc.country = p.country
  WHERE p.active = true
    AND NOT EXISTS (
      SELECT 1 FROM billing_daily_log bdl
      WHERE bdl.property_id = p.id AND bdl.billing_date = p_date
    );

  -- ── Add final_credits column ───────────────────────────────
  ALTER TABLE _billing_batch ADD COLUMN final_credits INT;
  UPDATE _billing_batch SET final_credits = GREATEST(1,
    base_credits - (base_credits * volume_discount / 100) - (base_credits * wallet_discount / 100)
  ) WHERE base_credits > 0;
  -- Remove zero-price rows
  DELETE FROM _billing_batch WHERE base_credits = 0 OR final_credits IS NULL;

  -- ── Insert billing logs (bulk) ─────────────────────────────
  INSERT INTO billing_daily_log (property_id, wallet_id, billing_date, amount, currency, discount_pct)
  SELECT property_id, wallet_id, p_date, final_credits, 'credits', volume_discount + wallet_discount
  FROM _billing_batch;

  GET DIAGNOSTICS v_billed = ROW_COUNT;

  -- ── Deduct per wallet (one transaction per wallet) ─────────
  FOR v_rec IN
    SELECT wallet_id, user_id, SUM(final_credits) AS total_debit, COUNT(*) AS prop_count
    FROM _billing_batch
    GROUP BY wallet_id, user_id
  LOOP
    DECLARE
      v_wallet wallets%ROWTYPE;
      v_from_promo INT := 0;
      v_from_main INT;
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

      INSERT INTO wallet_transactions (
        wallet_id, type, amount, balance_before, balance_after, credits,
        category, description, reference_type, created_by
      ) VALUES (
        v_rec.wallet_id, 'debit',
        v_rec.total_debit::INT, v_wallet.credits, v_wallet.credits - v_from_main,
        v_rec.total_debit::INT, 'daily_billing',
        format('Denni inzerce %s — %s nemovitosti, celkem %s kr', p_date, v_rec.prop_count, v_rec.total_debit),
        'system', v_rec.user_id
      );

      v_total := v_total + v_rec.total_debit::INT;
    END;
  END LOOP;

  v_skipped := (SELECT COUNT(*) FROM properties WHERE active = true) - v_billed;

  RETURN QUERY SELECT v_billed, v_skipped, v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
