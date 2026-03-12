-- ============================================================
-- Nemovizor – Supabase DB schéma (Sreality v3.0.0)
-- Kompletní číselníky dle oficiální importní specifikace
-- ============================================================

-- ===== ENUM TYPY (číselníky) =====

CREATE TYPE listing_type AS ENUM ('sale', 'rent', 'auction', 'shares');
CREATE TYPE property_category AS ENUM ('apartment', 'house', 'land', 'commercial', 'other');

CREATE TYPE property_condition AS ENUM (
  'velmi_dobry', 'dobry', 'spatny', 've_vystavbe', 'projekt',
  'novostavba', 'k_demolici', 'pred_rekonstrukci', 'po_rekonstrukci', 'v_rekonstrukci'
);

CREATE TYPE building_material AS ENUM (
  'drevostavba', 'cihla', 'kamen', 'montovana', 'panel', 'skeletal', 'smisena', 'modularni'
);

CREATE TYPE ownership_type AS ENUM ('osobni', 'druzstevni', 'statni');
CREATE TYPE furnishing_type AS ENUM ('ano', 'ne', 'castecne');
CREATE TYPE energy_rating AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G');
CREATE TYPE parking_type AS ENUM ('garaz', 'dvojgaraz', 'trojgaraz', 'podzemni', 'parkovaci_stani', 'zadne');

CREATE TYPE object_type AS ENUM ('prizemni', 'patrovy');
CREATE TYPE object_kind AS ENUM ('radovy', 'rohovy', 'v_bloku', 'samostatny');

CREATE TYPE object_location AS ENUM (
  'centrum', 'klidna_cast', 'rusna_cast', 'okraj', 'sidliste', 'polosamota', 'samota'
);

CREATE TYPE flat_class AS ENUM ('mezonet', 'loft', 'podkrovni', 'jednopodlazni');

CREATE TYPE surroundings_type AS ENUM (
  'bydleni', 'bydleni_kancelare', 'obchodni', 'administrativni',
  'prumyslova', 'venkovska', 'rekreacni', 'rekreacne_nevyuzita'
);

CREATE TYPE protection_type AS ENUM (
  'ochranne_pasmo', 'narodni_park', 'chko', 'pamatkova_zona',
  'pamatkova_rezervace', 'kulturni_pamatka', 'narodni_kulturni_pamatka'
);

CREATE TYPE circuit_breaker AS ENUM ('16a', '20a', '25a', '32a', '40a', '50a', '63a');
CREATE TYPE phase_distribution AS ENUM ('1_faze', '3_faze');

CREATE TYPE auction_kind AS ENUM (
  'nedobrovolna', 'dobrovolna', 'exekucni', 'aukce', 'obchodni_soutez'
);

CREATE TYPE lease_type_cb AS ENUM ('najem', 'podnajem');
CREATE TYPE price_currency AS ENUM ('czk', 'usd', 'eur');

CREATE TYPE price_unit AS ENUM (
  'za_nemovitost', 'za_mesic', 'za_m2', 'za_m2_mesic', 'za_m2_rok',
  'za_rok', 'za_den', 'za_hodinu', 'za_m2_den', 'za_m2_hodinu'
);

CREATE TYPE extra_info_status AS ENUM ('rezervovano', 'prodano');
CREATE TYPE easy_access_type AS ENUM ('ano', 'ne');
CREATE TYPE personal_transfer AS ENUM ('ano', 'ne');

-- ===== TABULKY =====

-- Realitní kanceláře
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  description TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  founded_year INT,
  total_brokers INT NOT NULL DEFAULT 0,
  total_listings INT NOT NULL DEFAULT 0,
  total_deals INT NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  specializations TEXT[] NOT NULL DEFAULT '{}',
  parent_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  is_independent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pobočky kanceláří
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 50.0755,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 14.4378,
  is_headquarters BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hodnocení (makléřů i kanceláří)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('broker', 'agency')),
  target_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  property_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Makléři
CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  photo TEXT,
  agency_name TEXT NOT NULL DEFAULT 'Nemovizor Prime',
  specialization TEXT NOT NULL DEFAULT '',
  active_listings INT NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  total_deals INT NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  languages TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT[] NOT NULL DEFAULT '{}',
  year_started INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nemovitosti
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,

  -- Základní info
  title TEXT NOT NULL,
  listing_type listing_type NOT NULL DEFAULT 'sale',
  category property_category NOT NULL DEFAULT 'apartment',
  subtype TEXT NOT NULL DEFAULT '',
  rooms_label TEXT NOT NULL DEFAULT '',

  -- Cena
  price NUMERIC NOT NULL DEFAULT 0,
  price_note TEXT,
  price_currency price_currency DEFAULT 'czk',
  price_unit price_unit DEFAULT 'za_nemovitost',
  price_negotiation BOOLEAN DEFAULT false,

  -- Lokace
  city TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  street TEXT,
  zip TEXT,
  region TEXT,
  city_part TEXT,
  location_label TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL DEFAULT 50.0755,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 14.4378,

  -- Plochy (hlavní)
  area NUMERIC NOT NULL DEFAULT 0,
  land_area NUMERIC,
  built_up_area NUMERIC,
  floor_area NUMERIC,

  -- Plochy (detailní)
  balcony_area INT,
  basin_area INT,
  cellar_area INT,
  garden_area INT,
  loggia_area INT,
  terrace_area INT,
  nolive_total_area INT,
  offices_area INT,
  production_area INT,
  shop_area INT,
  store_area INT,
  workshop_area INT,

  -- Popis
  summary TEXT NOT NULL DEFAULT '',
  description TEXT,

  -- Stav a parametry
  condition property_condition DEFAULT 'velmi_dobry',
  ownership ownership_type DEFAULT 'osobni',
  furnishing furnishing_type DEFAULT 'ne',
  energy_rating energy_rating DEFAULT 'C',
  building_material building_material,
  flooring TEXT,

  -- Topení (multiselect – uloženo jako TEXT[])
  heating TEXT[],
  heating_element TEXT[],
  heating_source TEXT[],
  water_heat_source TEXT[],

  -- Dům specifické
  object_type object_type,
  object_kind object_kind,
  object_location object_location,
  flat_class flat_class,

  -- Podlaží
  floor INT,
  total_floors INT,
  underground_floors INT,
  ceiling_height DOUBLE PRECISION,

  -- Parkování
  parking parking_type DEFAULT 'zadne',
  parking_spaces INT,
  garage_count INT,

  -- Vybavení (boolean)
  balcony BOOLEAN NOT NULL DEFAULT false,
  terrace BOOLEAN NOT NULL DEFAULT false,
  garden BOOLEAN NOT NULL DEFAULT false,
  elevator BOOLEAN NOT NULL DEFAULT false,
  cellar BOOLEAN NOT NULL DEFAULT false,
  garage BOOLEAN NOT NULL DEFAULT false,
  pool BOOLEAN NOT NULL DEFAULT false,
  loggia BOOLEAN NOT NULL DEFAULT false,
  easy_access easy_access_type,
  low_energy BOOLEAN DEFAULT false,
  ftv_panels BOOLEAN DEFAULT false,
  solar_panels BOOLEAN DEFAULT false,
  mortgage BOOLEAN DEFAULT false,

  -- Sítě (multiselect – TEXT[])
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
  internet_connection_speed INT,

  -- Okolí
  surroundings_type surroundings_type,
  protection protection_type,

  -- Jističe / fáze
  circuit_breaker circuit_breaker,
  phase_distribution phase_distribution,

  -- Studna
  well_type TEXT[],

  -- Finanční
  annuity INT,
  cost_of_living TEXT,
  commission DOUBLE PRECISION,
  mortgage_percent DOUBLE PRECISION,
  spor_percent DOUBLE PRECISION,
  refundable_deposit DOUBLE PRECISION,

  -- Pronájem specifické
  lease_type lease_type_cb,
  tenant_not_pay_commission BOOLEAN DEFAULT false,
  ready_date DATE,

  -- Dražba specifické
  auction_kind auction_kind,
  auction_date TIMESTAMPTZ,
  auction_place TEXT,
  price_auction_principal DOUBLE PRECISION,
  price_expert_report DOUBLE PRECISION,
  price_minimum_bid DOUBLE PRECISION,

  -- Podíly
  share_numerator INT,
  share_denominator INT,

  -- Stáří
  year_built INT,
  last_renovation INT,
  acceptance_year INT,

  -- Výstavba
  beginning_date DATE,
  finish_date DATE,
  sale_date DATE,

  -- Prohlídky
  first_tour_date TIMESTAMPTZ,

  -- Status inzerátu
  extra_info extra_info_status,
  exclusively_at_rk BOOLEAN DEFAULT false,
  personal_transfer personal_transfer,

  -- Počet vlastníků
  num_owners INT,

  -- VR / panorama
  matterport_url TEXT,
  mapy_panorama_url TEXT,

  -- Klíčová slova
  keywords TEXT[],

  -- Číslo bytové jednotky
  apartment_number INT,

  -- Média
  image_src TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  images TEXT[] NOT NULL DEFAULT '{}',

  -- Makléř
  broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,

  -- Status
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== INDEXY =====
CREATE INDEX idx_properties_slug ON properties(slug);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_listing_type ON properties(listing_type);
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_area ON properties(area);
CREATE INDEX idx_properties_active ON properties(active);
CREATE INDEX idx_properties_featured ON properties(featured);
CREATE INDEX idx_properties_coords ON properties(latitude, longitude);
CREATE INDEX idx_properties_condition ON properties(condition);
CREATE INDEX idx_properties_subtype ON properties(subtype);
CREATE INDEX idx_brokers_slug ON brokers(slug);
CREATE INDEX idx_brokers_agency ON brokers(agency_id);

CREATE INDEX idx_agencies_slug ON agencies(slug);
CREATE INDEX idx_agencies_parent ON agencies(parent_agency_id);

CREATE INDEX idx_branches_agency ON branches(agency_id);
CREATE INDEX idx_branches_slug ON branches(slug);
CREATE INDEX idx_branches_city ON branches(city);

CREATE INDEX idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ===== RLS (Row Level Security) =====
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Veřejné čtení
CREATE POLICY "Properties are viewable by everyone" ON properties FOR SELECT USING (active = true);
CREATE POLICY "Brokers are viewable by everyone" ON brokers FOR SELECT USING (true);
CREATE POLICY "Agencies are viewable by everyone" ON agencies FOR SELECT USING (true);
CREATE POLICY "Branches are viewable by everyone" ON branches FOR SELECT USING (true);
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);

-- ===== TRIGGER pro updated_at =====
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER set_updated_at_agencies
  BEFORE UPDATE ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER set_updated_at_brokers
  BEFORE UPDATE ON brokers
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
