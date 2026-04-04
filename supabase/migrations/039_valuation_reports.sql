-- ============================================================
-- 039: Valuation reports table
-- Stores property valuation results from Valuo/RealVisor API
-- Each record = one valuation request + result + optional PDF
-- ============================================================

CREATE TABLE IF NOT EXISTS valuation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,

  -- Property parameters submitted by user
  property_params JSONB NOT NULL DEFAULT '{}',

  -- Valuo API request/response
  valuo_request JSONB,
  valuo_response JSONB,
  used_fallback BOOLEAN DEFAULT FALSE,

  -- Extracted results
  estimated_price NUMERIC(14,2),
  price_range_min NUMERIC(14,2),
  price_range_max NUMERIC(14,2),
  price_per_m2 NUMERIC(10,2),
  currency TEXT DEFAULT 'CZK',

  -- PDF report
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Payment
  paid BOOLEAN DEFAULT FALSE,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT, -- 'wallet' | 'stripe'
  payment_ref TEXT,

  -- Lead tracking
  lead_id UUID,
  realvisor_valuation_id TEXT,

  -- Metadata
  source TEXT DEFAULT 'nemovizor-oceneni',
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_valuation_reports_email ON valuation_reports(email);
CREATE INDEX IF NOT EXISTS idx_valuation_reports_user_id ON valuation_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_valuation_reports_created ON valuation_reports(created_at DESC);

-- RLS
ALTER TABLE valuation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own valuations" ON valuation_reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert valuations" ON valuation_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON valuation_reports
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
