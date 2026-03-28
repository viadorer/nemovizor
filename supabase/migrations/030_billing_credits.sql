-- ============================================================
-- Migration 030: Update billing to use unified credits
-- bill_listing_day now uses credits_per_day from listing_pricing
-- and deducts from wallets.credits (single wallet per user)
-- ============================================================

CREATE OR REPLACE FUNCTION bill_listing_day(
  p_property_id UUID,
  p_date        DATE DEFAULT CURRENT_DATE
) RETURNS UUID AS $$
DECLARE
  v_prop        RECORD;
  v_broker      RECORD;
  v_wallet      wallets%ROWTYPE;
  v_credits     INT;
  v_discount    INT := 0;
  v_wallet_disc INT := 0;
  v_listing_count INT;
  v_final_credits INT;
  v_tx_id       UUID;
BEGIN
  -- Already billed today?
  IF EXISTS (SELECT 1 FROM billing_daily_log WHERE property_id = p_property_id AND billing_date = p_date) THEN
    RETURN NULL;
  END IF;

  -- Get property
  SELECT id, broker_id, country, city, listing_type, active
  INTO v_prop FROM properties WHERE id = p_property_id;
  IF NOT FOUND OR NOT v_prop.active THEN RETURN NULL; END IF;

  -- Get broker user_id
  SELECT user_id INTO v_broker FROM brokers WHERE id = v_prop.broker_id;
  IF v_broker.user_id IS NULL THEN RETURN NULL; END IF;

  -- Find the single wallet for this user
  SELECT * INTO v_wallet FROM wallets
  WHERE user_id = v_broker.user_id
  FOR UPDATE
  LIMIT 1;
  IF NOT FOUND OR v_wallet.frozen THEN RETURN NULL; END IF;

  -- Find credits_per_day: most specific match (city > region > country)
  SELECT lp.credits_per_day INTO v_credits
  FROM listing_pricing lp
  WHERE lp.country = v_prop.country
    AND lp.active = true
    AND (lp.listing_type = v_prop.listing_type::TEXT OR lp.listing_type IS NULL)
    AND (lp.city = v_prop.city OR lp.city IS NULL)
  ORDER BY
    (CASE WHEN lp.city IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN lp.listing_type IS NOT NULL THEN 1 ELSE 0 END) DESC
  LIMIT 1;

  IF v_credits IS NULL OR v_credits = 0 THEN RETURN NULL; END IF;

  -- Volume discount
  SELECT COUNT(*) INTO v_listing_count
  FROM properties p JOIN brokers b ON b.id = p.broker_id
  WHERE b.user_id = v_wallet.user_id AND p.country = v_prop.country AND p.active = true;

  SELECT vd.discount_pct INTO v_discount
  FROM volume_discounts vd
  WHERE vd.country = v_prop.country
    AND vd.min_listings <= v_listing_count
    AND (vd.max_listings IS NULL OR vd.max_listings > v_listing_count)
  ORDER BY vd.min_listings DESC LIMIT 1;
  IF v_discount IS NULL THEN v_discount := 0; END IF;

  -- Wallet-level discount
  v_wallet_disc := COALESCE(v_wallet.discount_pct, 0);

  -- Apply both discounts (compound)
  v_final_credits := v_credits;
  IF v_discount > 0 THEN
    v_final_credits := GREATEST(1, v_final_credits - (v_final_credits * v_discount / 100));
  END IF;
  IF v_wallet_disc > 0 THEN
    v_final_credits := GREATEST(1, v_final_credits - (v_final_credits * v_wallet_disc / 100));
  END IF;

  -- Minimum 1 credit per listing
  IF v_final_credits < 1 THEN v_final_credits := 1; END IF;

  -- Check if wallet can afford (credits + promo_balance)
  IF (v_wallet.credits + COALESCE(v_wallet.promo_balance, 0)) < v_final_credits THEN
    RETURN NULL; -- insufficient credits
  END IF;

  -- Debit credits: first from promo, then from main
  DECLARE
    v_from_promo INT := 0;
    v_from_main  INT := v_final_credits;
  BEGIN
    IF COALESCE(v_wallet.promo_balance, 0) > 0 THEN
      v_from_promo := LEAST(v_wallet.promo_balance, v_final_credits);
      v_from_main := v_final_credits - v_from_promo;
    END IF;

    UPDATE wallets SET
      credits = credits - v_from_main,
      promo_balance = COALESCE(promo_balance, 0) - v_from_promo,
      updated_at = NOW()
    WHERE id = v_wallet.id;
  END;

  -- Record transaction
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, balance_before, balance_after, credits,
    category, description, reference_type, created_by
  ) VALUES (
    v_wallet.id, 'debit',
    v_final_credits, v_wallet.credits, v_wallet.credits - (v_final_credits - LEAST(COALESCE(v_wallet.promo_balance,0), v_final_credits)),
    v_final_credits,
    'daily_billing',
    format('Inzerce %s — %s, %s (%s kr, sleva %s%%+%s%%)',
      p_date, COALESCE(v_prop.city, v_prop.country), v_prop.listing_type,
      v_final_credits, v_discount, v_wallet_disc),
    'system', v_broker.user_id
  ) RETURNING id INTO v_tx_id;

  -- Log billing
  INSERT INTO billing_daily_log (property_id, wallet_id, billing_date, amount, currency, discount_pct, transaction_id)
  VALUES (p_property_id, v_wallet.id, p_date, v_final_credits, 'credits', v_discount + v_wallet_disc, v_tx_id);

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Updated nightly billing ──────────────────────────────────
CREATE OR REPLACE FUNCTION run_daily_billing(
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(billed INT, skipped INT, errors INT) AS $$
DECLARE
  v_billed  INT := 0;
  v_skipped INT := 0;
  v_errors  INT := 0;
  v_prop    RECORD;
  v_tx      UUID;
BEGIN
  FOR v_prop IN
    SELECT p.id
    FROM properties p
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1 FROM billing_daily_log bdl
        WHERE bdl.property_id = p.id AND bdl.billing_date = p_date
      )
    ORDER BY p.country, p.city
  LOOP
    BEGIN
      v_tx := bill_listing_day(v_prop.id, p_date);
      IF v_tx IS NOT NULL THEN v_billed := v_billed + 1;
      ELSE v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_billed, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
