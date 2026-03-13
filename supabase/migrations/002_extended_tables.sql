-- ============================================================
-- Nemovizor – Migration 002: Extended Tables
-- Profiles, Favorites, Saved Searches, Valuations, PostGIS
-- Spustit PO 001_initial_schema.sql
-- ============================================================

-- ===== PostGIS pro geo queries =====
CREATE EXTENSION IF NOT EXISTS postgis;

-- Pridat geometry sloupec na properties (pro rychle geo dotazy)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Naplnit z existujicich lat/lon
UPDATE properties SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  WHERE latitude != 0 AND longitude != 0;

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST(geom);

-- Trigger pro automaticke nastaveni geom pri INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude != 0 AND NEW.longitude != 0 THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_properties_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_geom();

-- ===== PROFILES (rozsireni Supabase Auth) =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'broker', 'admin')),
  preferred_city TEXT,
  notification_email BOOLEAN NOT NULL DEFAULT true,
  notification_push BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Uzivatel vidi a upravuje jen svuj profil
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profil pri registraci
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ===== FAVORITES (oblibene nemovitosti) =====
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_property ON favorites(property_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_own" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- ===== SAVED SEARCHES (hlidac nabidek) =====
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Moje hledani',

  -- Filtry (kopie z PropertyFilters)
  listing_type listing_type,
  category property_category,
  subtype TEXT,
  city TEXT,
  district TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  area_min NUMERIC,
  area_max NUMERIC,
  rooms_min INTEGER,
  rooms_max INTEGER,
  condition property_condition,
  ownership ownership_type,
  furnishing furnishing_type,
  energy_rating energy_rating,
  building_material building_material,

  -- Geo oblast (bounding box)
  bounds_north DOUBLE PRECISION,
  bounds_south DOUBLE PRECISION,
  bounds_east DOUBLE PRECISION,
  bounds_west DOUBLE PRECISION,

  -- Notifikace
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (notify_frequency IN ('instant', 'daily', 'weekly')),
  active BOOLEAN NOT NULL DEFAULT true,

  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_active ON saved_searches(active) WHERE active = true;

CREATE TRIGGER trigger_saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_searches_select_own" ON saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_searches_insert_own" ON saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_searches_update_own" ON saved_searches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "saved_searches_delete_own" ON saved_searches FOR DELETE USING (auth.uid() = user_id);

-- ===== VALUATIONS (vysledky ocenovaciho wizardu) =====
CREATE TABLE valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Vstupni data z wizardu
  category property_category NOT NULL,
  subtype TEXT,
  rooms_label TEXT,
  area NUMERIC NOT NULL,
  land_area NUMERIC,
  city TEXT NOT NULL,
  district TEXT,
  street TEXT,
  zip TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  condition property_condition,
  ownership ownership_type,
  building_material building_material,
  energy_rating energy_rating,
  floor INTEGER,
  total_floors INTEGER,
  year_built INTEGER,
  last_renovation INTEGER,

  -- Vybaveni
  balcony BOOLEAN DEFAULT false,
  terrace BOOLEAN DEFAULT false,
  garden BOOLEAN DEFAULT false,
  elevator BOOLEAN DEFAULT false,
  cellar BOOLEAN DEFAULT false,
  garage BOOLEAN DEFAULT false,
  pool BOOLEAN DEFAULT false,
  parking parking_type,

  -- Vysledky oceneni
  estimated_price NUMERIC,
  price_low NUMERIC,
  price_high NUMERIC,
  price_per_m2 NUMERIC,
  confidence_score NUMERIC,
  comparable_count INTEGER,

  -- Metadata
  valuation_method TEXT DEFAULT 'comparable',
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_valuations_user ON valuations(user_id);
CREATE INDEX idx_valuations_city ON valuations(city);
CREATE INDEX idx_valuations_created ON valuations(created_at DESC);

ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;

-- Uzivatel vidi sve oceneni, anonymni oceneni (user_id IS NULL) vidi kazdy
CREATE POLICY "valuations_select_own" ON valuations FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "valuations_insert" ON valuations FOR INSERT WITH CHECK (true);

-- ===== PROPERTY VIEWS (statistiky zobrazeni) =====
CREATE TABLE property_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_views_property ON property_views(property_id);
CREATE INDEX idx_property_views_date ON property_views(viewed_at DESC);

ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;

-- Kdokoliv muze vlozit view, admin cte
CREATE POLICY "property_views_insert" ON property_views FOR INSERT WITH CHECK (true);
CREATE POLICY "property_views_select_auth" ON property_views FOR SELECT USING (auth.role() = 'authenticated');

-- ===== CONTACT REQUESTS (poptavky na maklere) =====
CREATE TABLE contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  request_type TEXT NOT NULL DEFAULT 'info' CHECK (request_type IN ('info', 'viewing', 'offer', 'valuation')),

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_requests_broker ON contact_requests(broker_id);
CREATE INDEX idx_contact_requests_property ON contact_requests(property_id);
CREATE INDEX idx_contact_requests_status ON contact_requests(status);

ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_requests_insert" ON contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "contact_requests_select_auth" ON contact_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "contact_requests_update_auth" ON contact_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- ===== VIEWS pro caste dotazy =====

-- Pocet zobrazeni za poslednich 7 dni
CREATE OR REPLACE VIEW property_views_7d AS
SELECT property_id, COUNT(*) AS view_count
FROM property_views
WHERE viewed_at > now() - INTERVAL '7 days'
GROUP BY property_id;

-- Pocet oblibeni
CREATE OR REPLACE VIEW property_favorites_count AS
SELECT property_id, COUNT(*) AS favorite_count
FROM favorites
GROUP BY property_id;
