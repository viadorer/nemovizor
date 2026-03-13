-- ============================================================
-- Nemovizor – Migration 003: Agencies, Branches, Reviews
-- Spustit PO 002_extended_tables.sql
-- ============================================================

-- ===== AGENCIES =====
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  description TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT,
  seat_city TEXT,
  seat_address TEXT,
  founded_year INTEGER,
  total_brokers INTEGER NOT NULL DEFAULT 0,
  total_listings INTEGER NOT NULL DEFAULT 0,
  total_deals INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 0,
  specializations TEXT[] DEFAULT '{}',
  parent_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  is_independent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agencies_slug ON agencies(slug);

CREATE TRIGGER trigger_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agencies_select_all" ON agencies FOR SELECT USING (true);
CREATE POLICY "agencies_insert_auth" ON agencies FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "agencies_update_auth" ON agencies FOR UPDATE USING (auth.role() = 'authenticated');

-- ===== Pridat agency_id na brokers =====
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_brokers_agency ON brokers(agency_id);

-- ===== BRANCHES =====
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  zip TEXT,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_headquarters BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_branches_agency ON branches(agency_id);
CREATE INDEX idx_branches_slug ON branches(slug);
CREATE INDEX idx_branches_city ON branches(city);

CREATE TRIGGER trigger_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select_all" ON branches FOR SELECT USING (true);
CREATE POLICY "branches_insert_auth" ON branches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "branches_update_auth" ON branches FOR UPDATE USING (auth.role() = 'authenticated');

-- ===== REVIEWS =====
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('broker', 'agency')),
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  property_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Kontrola ze je vyplnen spravny FK
  CONSTRAINT reviews_target_check CHECK (
    (target_type = 'broker' AND broker_id IS NOT NULL) OR
    (target_type = 'agency' AND agency_id IS NOT NULL)
  )
);

CREATE INDEX idx_reviews_broker ON reviews(broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX idx_reviews_agency ON reviews(agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX idx_reviews_date ON reviews(date DESC);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_all" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_auth" ON reviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ===== Rozšířit brokers o chybějící sloupce =====
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS year_started INTEGER;
