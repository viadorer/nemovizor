-- ============================================================
-- Nemovizor – Initial Database Schema
-- Supabase PostgreSQL Migration
-- ============================================================

-- ===== ENUMS =====
CREATE TYPE listing_type AS ENUM ('sale', 'rent', 'auction', 'shares');
CREATE TYPE property_category AS ENUM ('apartment', 'house', 'land', 'commercial', 'other');
CREATE TYPE property_condition AS ENUM ('velmi_dobry', 'dobry', 'spatny', 've_vystavbe', 'projekt', 'novostavba', 'k_demolici', 'pred_rekonstrukci', 'po_rekonstrukci', 'v_rekonstrukci');
CREATE TYPE building_material AS ENUM ('drevostavba', 'cihla', 'kamen', 'montovana', 'panel', 'skeletal', 'smisena', 'modularni');
CREATE TYPE ownership_type AS ENUM ('osobni', 'druzstevni', 'statni');
CREATE TYPE furnishing_type AS ENUM ('ano', 'ne', 'castecne');
CREATE TYPE energy_rating AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G');
CREATE TYPE parking_type AS ENUM ('garaz', 'dvojgaraz', 'trojgaraz', 'podzemni', 'parkovaci_stani', 'zadne');
CREATE TYPE object_type AS ENUM ('prizemni', 'patrovy');
CREATE TYPE object_kind AS ENUM ('radovy', 'rohovy', 'v_bloku', 'samostatny');
CREATE TYPE object_location AS ENUM ('centrum', 'klidna_cast', 'rusna_cast', 'okraj', 'sidliste', 'polosamota', 'samota');
CREATE TYPE flat_class AS ENUM ('mezonet', 'loft', 'podkrovni', 'jednopodlazni');
CREATE TYPE surroundings_type AS ENUM ('bydleni', 'bydleni_kancelare', 'obchodni', 'administrativni', 'prumyslova', 'venkovska', 'rekreacni', 'rekreacne_nevyuzita');
CREATE TYPE protection_type AS ENUM ('ochranne_pasmo', 'narodni_park', 'chko', 'pamatkova_zona', 'pamatkova_rezervace', 'kulturni_pamatka', 'narodni_kulturni_pamatka');
CREATE TYPE circuit_breaker AS ENUM ('16a', '20a', '25a', '32a', '40a', '50a', '63a');
CREATE TYPE phase_distribution AS ENUM ('1_faze', '3_faze');
CREATE TYPE auction_kind AS ENUM ('nedobrovolna', 'dobrovolna', 'exekucni', 'aukce', 'obchodni_soutez');
CREATE TYPE lease_type_cb AS ENUM ('najem', 'podnajem');
CREATE TYPE price_currency AS ENUM ('czk', 'usd', 'eur');
CREATE TYPE price_unit AS ENUM ('za_nemovitost', 'za_mesic', 'za_m2', 'za_m2_mesic', 'za_m2_rok', 'za_rok', 'za_den', 'za_hodinu', 'za_m2_den', 'za_m2_hodinu');
CREATE TYPE extra_info_status AS ENUM ('rezervovano', 'prodano');
CREATE TYPE easy_access_type AS ENUM ('ano', 'ne');
CREATE TYPE personal_transfer AS ENUM ('ano', 'ne');

-- ===== BROKERS TABLE =====
CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  photo TEXT,
  agency_name TEXT NOT NULL DEFAULT '',
  specialization TEXT NOT NULL DEFAULT '',
  active_listings INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  total_deals INTEGER NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== PROPERTIES TABLE =====
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  listing_type listing_type NOT NULL DEFAULT 'sale',
  category property_category NOT NULL DEFAULT 'apartment',
  subtype TEXT NOT NULL DEFAULT '',
  rooms_label TEXT NOT NULL DEFAULT '',

  -- Cena
  price NUMERIC NOT NULL DEFAULT 0,
  price_note TEXT,
  price_currency price_currency,
  price_unit price_unit,
  price_negotiation BOOLEAN,

  -- Lokace
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  street TEXT,
  zip TEXT,
  region TEXT,
  city_part TEXT,
  location_label TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,

  -- Plochy
  area NUMERIC NOT NULL DEFAULT 0,
  land_area NUMERIC,
  built_up_area NUMERIC,
  floor_area NUMERIC,
  balcony_area NUMERIC,
  basin_area NUMERIC,
  cellar_area NUMERIC,
  garden_area NUMERIC,
  loggia_area NUMERIC,
  terrace_area NUMERIC,
  nolive_total_area NUMERIC,
  offices_area NUMERIC,
  production_area NUMERIC,
  shop_area NUMERIC,
  store_area NUMERIC,
  workshop_area NUMERIC,

  -- Popis
  summary TEXT NOT NULL DEFAULT '',
  description TEXT,

  -- Stav a parametry
  condition property_condition,
  ownership ownership_type,
  furnishing furnishing_type,
  energy_rating energy_rating,
  building_material building_material,
  flooring TEXT,

  -- Topeni (multiselect)
  heating TEXT[],
  heating_element TEXT[],
  heating_source TEXT[],
  water_heat_source TEXT[],

  -- Dum specificke
  object_type object_type,
  object_kind object_kind,
  object_location object_location,
  flat_class flat_class,

  -- Podlazi
  floor INTEGER,
  total_floors INTEGER,
  underground_floors INTEGER,
  ceiling_height NUMERIC,

  -- Parkovani
  parking parking_type,
  parking_spaces INTEGER,
  garage_count INTEGER,

  -- Vybaveni (boolean)
  balcony BOOLEAN NOT NULL DEFAULT false,
  terrace BOOLEAN NOT NULL DEFAULT false,
  garden BOOLEAN NOT NULL DEFAULT false,
  elevator BOOLEAN NOT NULL DEFAULT false,
  cellar BOOLEAN NOT NULL DEFAULT false,
  garage BOOLEAN NOT NULL DEFAULT false,
  pool BOOLEAN NOT NULL DEFAULT false,
  loggia BOOLEAN NOT NULL DEFAULT false,
  easy_access easy_access_type,
  low_energy BOOLEAN,
  ftv_panels BOOLEAN,
  solar_panels BOOLEAN,
  mortgage BOOLEAN,

  -- Site (multiselect)
  electricity TEXT[],
  gas TEXT[],
  water TEXT[],
  gully TEXT[],
  road_type TEXT[],
  telecommunication TEXT[],
  transport TEXT[],
  internet_connection_type TEXT[],

  -- Internet
  internet_connection_provider TEXT,
  internet_connection_speed INTEGER,

  -- Okoli
  surroundings_type surroundings_type,
  protection protection_type,

  -- Jistice / faze
  circuit_breaker circuit_breaker,
  phase_distribution phase_distribution,

  -- Studna
  well_type TEXT[],

  -- Financni
  annuity NUMERIC,
  cost_of_living TEXT,
  commission NUMERIC,
  mortgage_percent NUMERIC,
  spor_percent NUMERIC,
  refundable_deposit NUMERIC,

  -- Pronajem
  lease_type lease_type_cb,
  tenant_not_pay_commission BOOLEAN,
  ready_date DATE,

  -- Drazba
  auction_kind auction_kind,
  auction_date DATE,
  auction_place TEXT,
  price_auction_principal NUMERIC,
  price_expert_report NUMERIC,
  price_minimum_bid NUMERIC,

  -- Podily
  share_numerator INTEGER,
  share_denominator INTEGER,

  -- Stari
  year_built INTEGER,
  last_renovation INTEGER,
  acceptance_year INTEGER,

  -- Vystavba
  beginning_date DATE,
  finish_date DATE,
  sale_date DATE,

  -- Prohlidky
  first_tour_date DATE,

  -- Status
  extra_info extra_info_status,
  exclusively_at_rk BOOLEAN,
  personal_transfer personal_transfer,

  -- Pocet vlastniku
  num_owners INTEGER,

  -- VR / panorama
  matterport_url TEXT,
  mapy_panorama_url TEXT,

  -- Klicova slova
  keywords TEXT[],

  -- Cislo bytove jednotky
  apartment_number INTEGER,

  -- Media
  image_src TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  images TEXT[] NOT NULL DEFAULT '{}',

  -- Makler
  broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,

  -- Status
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== INDEXES =====
CREATE INDEX idx_properties_slug ON properties(slug);
CREATE INDEX idx_properties_active ON properties(active) WHERE active = true;
CREATE INDEX idx_properties_featured ON properties(featured) WHERE featured = true;
CREATE INDEX idx_properties_listing_type ON properties(listing_type);
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_area ON properties(area);
CREATE INDEX idx_properties_geo ON properties(latitude, longitude);
CREATE INDEX idx_properties_broker ON properties(broker_id);
CREATE INDEX idx_properties_created ON properties(created_at DESC);

CREATE INDEX idx_brokers_slug ON brokers(slug);

-- ===== AUTO-UPDATE updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ===== ROW LEVEL SECURITY =====
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

-- Verejne cteni pro vsechny
CREATE POLICY "properties_read" ON properties FOR SELECT USING (true);
CREATE POLICY "brokers_read" ON brokers FOR SELECT USING (true);

-- Zapis pouze pro autentizovane uzivatele (admin)
CREATE POLICY "properties_insert" ON properties FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "properties_update" ON properties FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "properties_delete" ON properties FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "brokers_insert" ON brokers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "brokers_update" ON brokers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "brokers_delete" ON brokers FOR DELETE USING (auth.role() = 'authenticated');
