-- ============================================================
-- 028_wallet_discount_promo.sql
-- 1) Individual account-level discount on wallets
-- 2) Update bill_listing_day to apply wallet discount ON TOP of volume discount
-- 3) Label amounts as "credits" (1 credit = 1 smallest unit)
-- ============================================================

-- ─── Add discount_pct to wallets ────────────────────────────
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS discount_pct INT NOT NULL DEFAULT 0
  CHECK (discount_pct >= 0 AND discount_pct <= 100);

COMMENT ON COLUMN wallets.discount_pct IS 'Individual flat discount for this account, e.g. 5 = 5%, 40 = 40%. Applied on top of volume discounts.';

-- ─── Add promo_balance to wallets (bonus credits, spent first) ──
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS promo_balance BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN wallets.promo_balance IS 'Bonus/promotional credits. Used before main balance. Cannot be withdrawn.';

-- ─── Update bill_listing_day to use wallet.discount_pct ─────

CREATE OR REPLACE FUNCTION bill_listing_day(
  p_property_id UUID,
  p_date        DATE DEFAULT CURRENT_DATE
) RETURNS UUID AS $$
DECLARE
  v_prop          RECORD;
  v_broker        RECORD;
  v_wallet        wallets%ROWTYPE;
  v_price         BIGINT;
  v_currency      TEXT;
  v_vol_discount  INT := 0;
  v_acct_discount INT := 0;
  v_total_discount INT := 0;
  v_listing_count INT;
  v_final_price   BIGINT;
  v_promo_used    BIGINT := 0;
  v_main_used     BIGINT := 0;
  v_tx_id         UUID;
  v_min_price     BIGINT;
BEGIN
  -- Check if already billed today
  IF EXISTS (SELECT 1 FROM billing_daily_log WHERE property_id = p_property_id AND billing_date = p_date) THEN
    RETURN NULL;
  END IF;

  -- Get property details
  SELECT id, broker_id, country, city, listing_type, active
  INTO v_prop
  FROM properties WHERE id = p_property_id;

  IF NOT FOUND OR NOT v_prop.active THEN
    RETURN NULL;
  END IF;

  -- Get broker → user_id
  SELECT user_id INTO v_broker FROM brokers WHERE id = v_prop.broker_id;
  IF v_broker.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find wallet for this user + country
  SELECT * INTO v_wallet FROM wallets
  WHERE user_id = v_broker.user_id AND country = v_prop.country
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_wallet.frozen THEN RETURN NULL; END IF;

  -- Find price
  SELECT lp.price_per_day, lp.currency INTO v_price, v_currency
  FROM listing_pricing lp
  WHERE lp.country = v_prop.country
    AND lp.active = true
    AND (lp.listing_type = v_prop.listing_type::TEXT OR lp.listing_type IS NULL)
    AND (lp.city = v_prop.city OR lp.city IS NULL)
  ORDER BY
    (CASE WHEN lp.city IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN lp.listing_type IS NOT NULL THEN 1 ELSE 0 END) DESC
  LIMIT 1;

  IF v_price IS NULL THEN RETURN NULL; END IF;

  -- Count active listings for volume discount
  SELECT COUNT(*) INTO v_listing_count
  FROM properties p
  JOIN brokers b ON b.id = p.broker_id
  WHERE b.user_id = v_wallet.user_id
    AND p.country = v_prop.country
    AND p.active = true;

  -- Volume discount
  SELECT vd.discount_pct INTO v_vol_discount
  FROM volume_discounts vd
  WHERE vd.country = v_prop.country
    AND vd.min_listings <= v_listing_count
    AND (vd.max_listings IS NULL OR vd.max_listings > v_listing_count)
  ORDER BY vd.min_listings DESC
  LIMIT 1;

  IF v_vol_discount IS NULL THEN v_vol_discount := 0; END IF;

  -- Account-level discount from wallet
  v_acct_discount := COALESCE(v_wallet.discount_pct, 0);

  -- Combined discount: volume + individual (capped at 80%)
  v_total_discount := LEAST(v_vol_discount + v_acct_discount, 80);

  -- Apply discount
  v_final_price := v_price - (v_price * v_total_discount / 100);

  -- Per-listing minimum
  v_min_price := CASE v_currency
    WHEN 'czk' THEN 50     -- 0.50 Kč
    WHEN 'eur' THEN 5      -- 0.05 €
    WHEN 'chf' THEN 5      -- 0.05 CHF
    WHEN 'gbp' THEN 5      -- 0.05 GBP
    ELSE 50
  END;

  IF v_final_price < v_min_price THEN
    v_final_price := v_min_price;
  END IF;

  -- Check total available (promo + main + credit_limit)
  IF (v_wallet.promo_balance + v_wallet.balance + v_wallet.credit_limit) < v_final_price THEN
    RETURN NULL;  -- insufficient funds
  END IF;

  -- Spend promo credits first, then main balance
  IF v_wallet.promo_balance > 0 THEN
    v_promo_used := LEAST(v_wallet.promo_balance, v_final_price);
    v_main_used := v_final_price - v_promo_used;
  ELSE
    v_promo_used := 0;
    v_main_used := v_final_price;
  END IF;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, balance_before, balance_after,
    category, description, reference_type, reference_id, created_by, metadata
  ) VALUES (
    v_wallet.id, 'debit', v_final_price,
    v_wallet.balance,
    v_wallet.balance - v_main_used,
    'listing_fee',
    format('Inzerce %s — %s (sleva %s%%: obj. %s%% + ind. %s%%)',
      p_date, v_prop.city, v_total_discount, v_vol_discount, v_acct_discount),
    'system',
    NULL,
    v_broker.user_id,
    jsonb_build_object(
      'property_id', p_property_id,
      'base_price', v_price,
      'volume_discount', v_vol_discount,
      'account_discount', v_acct_discount,
      'total_discount', v_total_discount,
      'promo_used', v_promo_used,
      'main_used', v_main_used
    )
  ) RETURNING id INTO v_tx_id;

  -- Update balances
  UPDATE wallets SET
    balance = balance - v_main_used,
    promo_balance = promo_balance - v_promo_used,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Log billing
  INSERT INTO billing_daily_log (property_id, wallet_id, billing_date, amount, currency, discount_pct, transaction_id)
  VALUES (p_property_id, v_wallet.id, p_date, v_final_price, v_currency, v_total_discount, v_tx_id);

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── PROMO credit function ──────────────────────────────────
-- Admin can give promotional credits (used before main balance)

CREATE OR REPLACE FUNCTION wallet_promo_credit(
  p_wallet_id   UUID,
  p_amount      BIGINT,
  p_description TEXT DEFAULT 'Promo kredit',
  p_created_by  UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_tx_id  UUID;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  INSERT INTO wallet_transactions (
    wallet_id, type, amount, balance_before, balance_after,
    category, description, reference_type, created_by, metadata
  ) VALUES (
    p_wallet_id, 'credit', p_amount,
    v_wallet.promo_balance,
    v_wallet.promo_balance + p_amount,
    'promo',
    p_description,
    'manual',
    COALESCE(p_created_by, auth.uid()),
    jsonb_build_object('is_promo', true)
  ) RETURNING id INTO v_tx_id;

  UPDATE wallets SET
    promo_balance = promo_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION wallet_promo_credit TO authenticated;
