-- ============================================================
-- 025_wallet_system.sql
-- Country-scoped wallet, transaction log, service catalog,
-- regional pricing, and purchases.
-- All monetary amounts stored as BIGINT in smallest unit
-- (haléře / cents) to avoid floating-point issues.
-- ============================================================

-- ─── WALLETS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country       TEXT        NOT NULL,            -- 'cz','fr','ch','es','it','de'...
  currency      TEXT        NOT NULL DEFAULT 'czk', -- 'czk','eur','chf','gbp'
  balance       BIGINT      NOT NULL DEFAULT 0,  -- in smallest unit (haléře/cents)
  credit_limit  BIGINT      NOT NULL DEFAULT 0,  -- how much can go negative
  frozen        BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, country)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user    ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_country ON wallets(country);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- User can see own wallets
CREATE POLICY "wallets_select_own" ON wallets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admin can see all
CREATE POLICY "wallets_select_admin" ON wallets FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Admin can update (freeze, adjust credit_limit)
CREATE POLICY "wallets_update_admin" ON wallets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- System/admin can insert (wallet creation)
CREATE POLICY "wallets_insert_authenticated" ON wallets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ─── WALLET TRANSACTIONS (immutable log) ────────────────────

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID        NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  type            TEXT        NOT NULL CHECK (type IN ('credit','debit','hold','release','refund')),
  amount          BIGINT      NOT NULL CHECK (amount > 0),
  balance_before  BIGINT      NOT NULL,
  balance_after   BIGINT      NOT NULL,
  category        TEXT        NOT NULL, -- deposit, tip_purchase, listing_fee, broker_promo, project_page, refund, bonus, admin_adjustment
  description     TEXT,
  reference_type  TEXT,        -- 'purchase','manual','system'
  reference_id    UUID,        -- FK to purchases.id or null
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wt_wallet     ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wt_ref        ON wallet_transactions(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wt_category   ON wallet_transactions(category);
CREATE INDEX IF NOT EXISTS idx_wt_created    ON wallet_transactions(created_at DESC);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- User can read own transactions (via wallet ownership)
CREATE POLICY "wt_select_own" ON wallet_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
  );

-- Admin can read all
CREATE POLICY "wt_select_admin" ON wallet_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- NO UPDATE or DELETE policies — transactions are immutable!

-- ─── SERVICE CATALOG ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        NOT NULL UNIQUE,  -- 'tip_7d','tip_30d','listing_basic','broker_promo_30d'...
  name          TEXT        NOT NULL,
  description   TEXT,
  base_price    BIGINT      NOT NULL,         -- in smallest unit
  currency      TEXT        NOT NULL DEFAULT 'czk',
  duration_days INT,                          -- null = permanent/one-time
  category      TEXT        NOT NULL,         -- 'listing','tip','broker_promo','agency_promo','project'
  active        BOOLEAN     NOT NULL DEFAULT true,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;

-- Anyone can read active catalog
CREATE POLICY "catalog_read" ON service_catalog FOR SELECT USING (true);

-- Admin can manage
CREATE POLICY "catalog_admin_insert" ON service_catalog FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "catalog_admin_update" ON service_catalog FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "catalog_admin_delete" ON service_catalog FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── REGIONAL PRICING ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS regional_pricing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id        UUID        NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  country           TEXT        NOT NULL,
  region            TEXT,        -- nullable = country-wide
  city              TEXT,        -- nullable = region-wide
  listing_type      TEXT,        -- nullable = all types
  property_category TEXT,        -- nullable = all categories
  price             BIGINT      NOT NULL,
  currency          TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite uniqueness (NULLs handled by COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_unique ON regional_pricing(
  service_id, country,
  COALESCE(region, ''), COALESCE(city, ''),
  COALESCE(listing_type, ''), COALESCE(property_category, '')
);

CREATE INDEX IF NOT EXISTS idx_rp_service ON regional_pricing(service_id, country);

ALTER TABLE regional_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_read" ON regional_pricing FOR SELECT USING (true);

CREATE POLICY "rp_admin_insert" ON regional_pricing FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "rp_admin_update" ON regional_pricing FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "rp_admin_delete" ON regional_pricing FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── PURCHASES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID        NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_code  TEXT        NOT NULL,
  property_id   UUID        REFERENCES properties(id) ON DELETE SET NULL,
  broker_id     UUID        REFERENCES brokers(id) ON DELETE SET NULL,
  agency_id     UUID        REFERENCES agencies(id) ON DELETE SET NULL,
  price_paid    BIGINT      NOT NULL,
  currency      TEXT        NOT NULL,
  country       TEXT        NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,  -- null = permanent
  auto_renew    BOOLEAN     NOT NULL DEFAULT false,
  status        TEXT        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','expired','cancelled','pending')),
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_user     ON purchases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet   ON purchases(wallet_id);
CREATE INDEX IF NOT EXISTS idx_purchases_expires  ON purchases(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_purchases_property ON purchases(property_id) WHERE property_id IS NOT NULL;

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select_own" ON purchases FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "purchases_select_admin" ON purchases FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── ATOMIC WALLET FUNCTIONS ────────────────────────────────

-- Debit: atomically subtract from wallet with race-condition protection
CREATE OR REPLACE FUNCTION wallet_debit(
  p_wallet_id   UUID,
  p_amount      BIGINT,
  p_category    TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'manual',
  p_reference_id UUID DEFAULT NULL,
  p_created_by  UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_wallet      wallets%ROWTYPE;
  v_tx_id       UUID;
BEGIN
  -- Lock the wallet row to prevent concurrent modifications
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  IF v_wallet.frozen THEN
    RAISE EXCEPTION 'Wallet is frozen: %', p_wallet_id;
  END IF;

  IF v_wallet.balance + v_wallet.credit_limit < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds. Balance: %, Credit limit: %, Required: %',
      v_wallet.balance, v_wallet.credit_limit, p_amount;
  END IF;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, balance_before, balance_after,
    category, description, reference_type, reference_id, created_by
  ) VALUES (
    p_wallet_id, 'debit', p_amount, v_wallet.balance, v_wallet.balance - p_amount,
    p_category, p_description, p_reference_type, p_reference_id, COALESCE(p_created_by, auth.uid())
  ) RETURNING id INTO v_tx_id;

  -- Update wallet balance
  UPDATE wallets SET
    balance = balance - p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Credit: atomically add to wallet
CREATE OR REPLACE FUNCTION wallet_credit(
  p_wallet_id   UUID,
  p_amount      BIGINT,
  p_category    TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'manual',
  p_reference_id UUID DEFAULT NULL,
  p_created_by  UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_wallet      wallets%ROWTYPE;
  v_tx_id       UUID;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  INSERT INTO wallet_transactions (
    wallet_id, type, amount, balance_before, balance_after,
    category, description, reference_type, reference_id, created_by
  ) VALUES (
    p_wallet_id, 'credit', p_amount, v_wallet.balance, v_wallet.balance + p_amount,
    p_category, p_description, p_reference_type, p_reference_id, COALESCE(p_created_by, auth.uid())
  ) RETURNING id INTO v_tx_id;

  UPDATE wallets SET
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get the best matching price for a service in a given context
CREATE OR REPLACE FUNCTION get_service_price(
  p_service_code TEXT,
  p_country      TEXT,
  p_city         TEXT DEFAULT NULL,
  p_listing_type TEXT DEFAULT NULL,
  p_property_category TEXT DEFAULT NULL
) RETURNS TABLE(price BIGINT, currency TEXT) AS $$
DECLARE
  v_service service_catalog%ROWTYPE;
BEGIN
  SELECT * INTO v_service FROM service_catalog WHERE code = p_service_code AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found or inactive: %', p_service_code;
  END IF;

  -- Try most specific match first, fall back to less specific
  RETURN QUERY
  SELECT rp.price, rp.currency
  FROM regional_pricing rp
  WHERE rp.service_id = v_service.id
    AND rp.country = p_country
    AND (rp.city = p_city OR rp.city IS NULL)
    AND (rp.listing_type = p_listing_type OR rp.listing_type IS NULL)
    AND (rp.property_category = p_property_category OR rp.property_category IS NULL)
  ORDER BY
    -- More specific matches first
    (CASE WHEN rp.city IS NOT NULL THEN 1 ELSE 0 END) DESC,
    (CASE WHEN rp.listing_type IS NOT NULL THEN 1 ELSE 0 END) DESC,
    (CASE WHEN rp.property_category IS NOT NULL THEN 1 ELSE 0 END) DESC
  LIMIT 1;

  -- If no regional override found, return base price
  IF NOT FOUND THEN
    RETURN QUERY SELECT v_service.base_price, v_service.currency;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── SEED: Default service catalog ──────────────────────────

INSERT INTO service_catalog (code, name, description, base_price, currency, duration_days, category) VALUES
  ('tip_7d',           'TIP 7 dní',           'Zvýraznění nabídky na 7 dní',              9900,  'czk', 7,  'tip'),
  ('tip_30d',          'TIP 30 dní',          'Zvýraznění nabídky na 30 dní',            29900,  'czk', 30, 'tip'),
  ('top_listing_7d',   'TOP pozice 7 dní',    'Přednostní pozice v kategorii na 7 dní',  14900,  'czk', 7,  'tip'),
  ('top_listing_30d',  'TOP pozice 30 dní',   'Přednostní pozice v kategorii na 30 dní', 39900,  'czk', 30, 'tip'),
  ('listing_basic_30d','Základní inzerát 30d', 'Základní inzerce na 30 dní',              4900,  'czk', 30, 'listing'),
  ('listing_premium_30d','Premium inzerát 30d','Prémiová inzerce s více fotkami na 30d',  14900,  'czk', 30, 'listing'),
  ('broker_promo_30d', 'Promo makléře 30 dní','Kartička makléře v gridu na 30 dní',      19900,  'czk', 30, 'broker_promo'),
  ('agency_promo_30d', 'Promo kanceláře 30d', 'Zvýraznění kanceláře na 30 dní',         29900,  'czk', 30, 'agency_promo'),
  ('project_page',     'Stránka projektu',    'Vlastní stránka projektu v Nemovizor',    99900,  'czk', 90, 'project')
ON CONFLICT (code) DO NOTHING;

-- ─── Grant execute on functions ─────────────────────────────

GRANT EXECUTE ON FUNCTION wallet_debit TO authenticated;
GRANT EXECUTE ON FUNCTION wallet_credit TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_price TO authenticated, anon;

-- Allow transactions insert via functions (SECURITY DEFINER handles it)
CREATE POLICY "wt_insert_via_function" ON wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (true);
