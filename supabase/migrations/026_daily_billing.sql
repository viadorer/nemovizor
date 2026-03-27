-- ============================================================
-- 026_daily_billing.sql
-- Daily listing billing system:
--   - billing_daily_log: tracks which properties were billed each day (dedup)
--   - listing_pricing: per-country/region rate table
--   - volume_discounts: tiered discounts by listing count
--   - bill_listing_day(): atomically bill one listing for one day
--   - run_daily_billing(): nightly cron billing for all active listings
-- ============================================================

-- ─── LISTING PRICING ──────────────────────────────────────────
-- Rate per day for listing a property, by country/region/type

CREATE TABLE IF NOT EXISTS listing_pricing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country           TEXT        NOT NULL,             -- 'cz','fr','ch','es','it','de','uk'
  region            TEXT,                             -- nullable = country-wide default
  city              TEXT,                             -- nullable = region-wide default
  listing_type      TEXT,                             -- 'sale','rent' or null = both
  price_per_day     BIGINT      NOT NULL,             -- smallest unit (haléře/cents/rappen)
  currency          TEXT        NOT NULL,             -- 'czk','eur','chf','gbp'
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lp_unique ON listing_pricing(
  country,
  COALESCE(region, ''), COALESCE(city, ''),
  COALESCE(listing_type, '')
);

ALTER TABLE listing_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp_read" ON listing_pricing FOR SELECT USING (true);
CREATE POLICY "lp_admin_manage" ON listing_pricing FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── VOLUME DISCOUNTS ─────────────────────────────────────────
-- Tiered discounts by active listing count per wallet/country

CREATE TABLE IF NOT EXISTS volume_discounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country       TEXT        NOT NULL,
  min_listings  INT         NOT NULL,  -- inclusive
  max_listings  INT,                   -- exclusive, null = unlimited
  discount_pct  INT         NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vd_unique ON volume_discounts(country, min_listings);

ALTER TABLE volume_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vd_read" ON volume_discounts FOR SELECT USING (true);
CREATE POLICY "vd_admin_manage" ON volume_discounts FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── BILLING DAILY LOG ────────────────────────────────────────
-- One row per property per day — prevents double billing

CREATE TABLE IF NOT EXISTS billing_daily_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  wallet_id     UUID        NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  billing_date  DATE        NOT NULL,
  amount        BIGINT      NOT NULL,   -- amount charged (after discount)
  currency      TEXT        NOT NULL,
  discount_pct  INT         NOT NULL DEFAULT 0,
  transaction_id UUID       REFERENCES wallet_transactions(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, billing_date)
);

CREATE INDEX IF NOT EXISTS idx_bdl_wallet_date ON billing_daily_log(wallet_id, billing_date);
CREATE INDEX IF NOT EXISTS idx_bdl_property    ON billing_daily_log(property_id, billing_date DESC);

ALTER TABLE billing_daily_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdl_select_own" ON billing_daily_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = billing_daily_log.wallet_id AND wallets.user_id = auth.uid())
  );
CREATE POLICY "bdl_select_admin" ON billing_daily_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── BILL ONE LISTING FOR ONE DAY ────────────────────────────
-- Returns transaction_id or NULL if already billed today

CREATE OR REPLACE FUNCTION bill_listing_day(
  p_property_id UUID,
  p_date        DATE DEFAULT CURRENT_DATE
) RETURNS UUID AS $$
DECLARE
  v_prop        RECORD;
  v_broker      RECORD;
  v_wallet      wallets%ROWTYPE;
  v_price       BIGINT;
  v_currency    TEXT;
  v_discount    INT := 0;
  v_listing_count INT;
  v_final_price BIGINT;
  v_tx_id       UUID;
  v_min_price   BIGINT;
BEGIN
  -- Check if already billed today
  IF EXISTS (SELECT 1 FROM billing_daily_log WHERE property_id = p_property_id AND billing_date = p_date) THEN
    RETURN NULL;  -- already billed, no-op
  END IF;

  -- Get property details
  SELECT id, broker_id, country, city, listing_type, active
  INTO v_prop
  FROM properties WHERE id = p_property_id;

  IF NOT FOUND OR NOT v_prop.active THEN
    RETURN NULL;  -- inactive property, skip
  END IF;

  -- Get broker → user_id for wallet lookup
  SELECT user_id INTO v_broker FROM brokers WHERE id = v_prop.broker_id;
  IF v_broker.user_id IS NULL THEN
    RETURN NULL;  -- broker not linked to user, skip
  END IF;

  -- Find wallet for this user + country
  SELECT * INTO v_wallet FROM wallets
  WHERE user_id = v_broker.user_id AND country = v_prop.country
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;  -- no wallet for this country, skip
  END IF;

  IF v_wallet.frozen THEN
    RETURN NULL;  -- frozen wallet, skip
  END IF;

  -- Find price: most specific match first (city > region > country)
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

  IF v_price IS NULL THEN
    RETURN NULL;  -- no pricing configured for this country, skip (free)
  END IF;

  -- Count active listings for this wallet (for volume discount)
  SELECT COUNT(*) INTO v_listing_count
  FROM properties p
  JOIN brokers b ON b.id = p.broker_id
  WHERE b.user_id = v_wallet.user_id
    AND p.country = v_prop.country
    AND p.active = true;

  -- Find volume discount tier
  SELECT vd.discount_pct INTO v_discount
  FROM volume_discounts vd
  WHERE vd.country = v_prop.country
    AND vd.min_listings <= v_listing_count
    AND (vd.max_listings IS NULL OR vd.max_listings > v_listing_count)
  ORDER BY vd.min_listings DESC
  LIMIT 1;

  IF v_discount IS NULL THEN v_discount := 0; END IF;

  -- Apply discount
  v_final_price := v_price - (v_price * v_discount / 100);

  -- Minimum daily charge per wallet (not per listing):
  -- 20 CZK / 0.80 EUR / 1.00 CHF / 0.80 GBP
  -- This is enforced at the wallet level in run_daily_billing, not here.
  -- Per-listing minimum to avoid rounding to zero:
  v_min_price := CASE v_currency
    WHEN 'czk' THEN 50     -- 0.50 Kč per listing minimum
    WHEN 'eur' THEN 5      -- 0.05 € per listing minimum
    WHEN 'chf' THEN 5      -- 0.05 CHF per listing minimum
    WHEN 'gbp' THEN 5      -- 0.05 GBP per listing minimum
    ELSE 50
  END;

  IF v_final_price < v_min_price THEN
    v_final_price := v_min_price;
  END IF;

  -- Check if wallet can afford it (balance + credit_limit)
  IF v_wallet.balance + v_wallet.credit_limit < v_final_price THEN
    -- Insufficient funds — still log but don't charge
    -- Property stays active, but owner should be notified
    RETURN NULL;
  END IF;

  -- Debit wallet
  v_tx_id := wallet_debit(
    v_wallet.id,
    v_final_price,
    'listing_fee',
    format('Inzerce %s — %s (%s%% sleva)', p_date, v_prop.city, v_discount),
    'system',
    NULL,
    v_broker.user_id
  );

  -- Log billing
  INSERT INTO billing_daily_log (property_id, wallet_id, billing_date, amount, currency, discount_pct, transaction_id)
  VALUES (p_property_id, v_wallet.id, p_date, v_final_price, v_currency, v_discount, v_tx_id);

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── NIGHTLY BILLING CRON ─────────────────────────────────────
-- Call this from edge function / cron: SELECT run_daily_billing()

CREATE OR REPLACE FUNCTION run_daily_billing(
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(billed INT, skipped INT, errors INT, top_up_charged INT) AS $$
DECLARE
  v_billed  INT := 0;
  v_skipped INT := 0;
  v_errors  INT := 0;
  v_top_up  INT := 0;
  v_prop    RECORD;
  v_tx      UUID;
  v_wallet  RECORD;
  v_day_total BIGINT;
  v_min_daily BIGINT;
  v_diff    BIGINT;
BEGIN
  -- Step 1: Bill each active listing individually
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
      IF v_tx IS NOT NULL THEN
        v_billed := v_billed + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Step 2: Enforce minimum daily charge per wallet
  -- 20 CZK / 0.80 EUR / 1.00 CHF / 0.80 GBP
  FOR v_wallet IN
    SELECT w.id, w.currency, w.user_id,
      COALESCE(SUM(bdl.amount), 0) AS day_total
    FROM wallets w
    LEFT JOIN billing_daily_log bdl ON bdl.wallet_id = w.id AND bdl.billing_date = p_date
    WHERE NOT w.frozen
    GROUP BY w.id, w.currency, w.user_id
    HAVING COALESCE(SUM(bdl.amount), 0) > 0  -- only wallets that had some billing today
  LOOP
    v_min_daily := CASE v_wallet.currency
      WHEN 'czk' THEN 2000   -- 20 Kč
      WHEN 'eur' THEN 80     -- 0.80 €
      WHEN 'chf' THEN 100    -- 1.00 CHF
      WHEN 'gbp' THEN 80     -- 0.80 GBP
      ELSE 2000
    END;

    IF v_wallet.day_total < v_min_daily THEN
      v_diff := v_min_daily - v_wallet.day_total;
      BEGIN
        PERFORM wallet_debit(
          v_wallet.id,
          v_diff,
          'listing_fee',
          format('Doplatek na minimální denní poplatek %s', p_date),
          'system',
          NULL,
          v_wallet.user_id
        );
        v_top_up := v_top_up + 1;
      EXCEPTION WHEN OTHERS THEN
        -- insufficient funds for top-up, skip
        NULL;
      END;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_billed, v_skipped, v_errors, v_top_up;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── GRANTS ───────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION bill_listing_day TO authenticated;
GRANT EXECUTE ON FUNCTION run_daily_billing TO authenticated;

-- Allow service role to insert billing logs
CREATE POLICY "bdl_insert_system" ON billing_daily_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- ─── SEED: Pricing data ──────────────────────────────────────

-- CZ pricing (haléře)
INSERT INTO listing_pricing (country, city, listing_type, price_per_day, currency) VALUES
  ('cz', 'Praha',    'sale', 200, 'czk'),   -- 2 Kč/den
  ('cz', 'Praha',    'rent', 100, 'czk'),   -- 1 Kč/den
  ('cz', 'Brno',     'sale', 150, 'czk'),   -- 1.50 Kč/den
  ('cz', 'Brno',     'rent',  80, 'czk'),   -- 0.80 Kč/den
  ('cz', 'Ostrava',  'sale', 150, 'czk'),
  ('cz', 'Ostrava',  'rent',  80, 'czk'),
  ('cz', 'Plzeň',   'sale', 150, 'czk'),
  ('cz', 'Plzeň',   'rent',  80, 'czk'),
  ('cz', NULL,       'sale', 100, 'czk'),   -- ostatní CZ prodej = 1 Kč/den
  ('cz', NULL,       'rent',  50, 'czk'),   -- ostatní CZ pronájem = 0.50 Kč/den
  -- FR pricing (euro cents)
  ('fr', 'Paris',    'sale',  50, 'eur'),   -- 0.50 €/den
  ('fr', 'Paris',    'rent',  30, 'eur'),   -- 0.30 €/den
  ('fr', 'Nice',     'sale',  50, 'eur'),
  ('fr', 'Nice',     'rent',  30, 'eur'),
  ('fr', 'Cannes',   'sale',  50, 'eur'),
  ('fr', 'Monaco',   'sale',  50, 'eur'),
  ('fr', NULL,       'sale',  30, 'eur'),   -- ostatní FR = 0.30 €/den
  ('fr', NULL,       'rent',  15, 'eur'),
  -- CH pricing (rappen)
  ('ch', 'Zürich',   'sale',  60, 'chf'),   -- 0.60 CHF/den
  ('ch', 'Zürich',   'rent',  35, 'chf'),
  ('ch', 'Genf',     'sale',  60, 'chf'),
  ('ch', 'Genf',     'rent',  35, 'chf'),
  ('ch', 'Basel',    'sale',  60, 'chf'),
  ('ch', 'Basel',    'rent',  35, 'chf'),
  ('ch', NULL,       'sale',  40, 'chf'),   -- ostatní CH = 0.40 CHF/den
  ('ch', NULL,       'rent',  20, 'chf'),
  -- ES pricing (euro cents)
  ('es', 'Barcelona','sale',  40, 'eur'),
  ('es', 'Madrid',   'sale',  40, 'eur'),
  ('es', 'Málaga',   'sale',  40, 'eur'),
  ('es', 'Marbella', 'sale',  40, 'eur'),
  ('es', NULL,       'sale',  25, 'eur'),
  ('es', NULL,       'rent',  12, 'eur'),
  -- IT pricing (euro cents)
  ('it', 'Milano',   'sale',  40, 'eur'),
  ('it', 'Roma',     'sale',  40, 'eur'),
  ('it', NULL,       'sale',  25, 'eur'),
  ('it', NULL,       'rent',  12, 'eur'),
  -- UK pricing (pence)
  ('uk', 'London',   'sale',  50, 'gbp'),
  ('uk', 'London',   'rent',  30, 'gbp'),
  ('uk', NULL,       'sale',  25, 'gbp'),
  ('uk', NULL,       'rent',  12, 'gbp')
ON CONFLICT DO NOTHING;

-- Volume discounts (same for all countries)
INSERT INTO volume_discounts (country, min_listings, max_listings, discount_pct) VALUES
  ('cz', 1,   11,   0),
  ('cz', 11,  51,  10),
  ('cz', 51,  201, 20),
  ('cz', 201, 501, 30),
  ('cz', 501, NULL,40),
  ('fr', 1,   11,   0),
  ('fr', 11,  51,  10),
  ('fr', 51,  201, 20),
  ('fr', 201, 501, 30),
  ('fr', 501, NULL,40),
  ('ch', 1,   11,   0),
  ('ch', 11,  51,  10),
  ('ch', 51,  201, 20),
  ('ch', 201, 501, 30),
  ('ch', 501, NULL,40),
  ('es', 1,   11,   0),
  ('es', 11,  51,  10),
  ('es', 51,  201, 20),
  ('es', 201, 501, 30),
  ('es', 501, NULL,40),
  ('it', 1,   11,   0),
  ('it', 11,  51,  10),
  ('it', 51,  201, 20),
  ('it', 201, 501, 30),
  ('it', 501, NULL,40),
  ('uk', 1,   11,   0),
  ('uk', 11,  51,  10),
  ('uk', 51,  201, 20),
  ('uk', 201, 501, 30),
  ('uk', 501, NULL,40)
ON CONFLICT DO NOTHING;
