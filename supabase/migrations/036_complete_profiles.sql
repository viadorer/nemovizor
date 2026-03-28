-- ============================================================
-- 036: Complete broker & agency profiles — world-class standard
-- Social media, video, bio, service areas, recent sales, etc.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- BROKERS — new columns
-- ═══════════════════════════════════════════════════════════════

-- Social media
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS linkedin TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS instagram TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS facebook TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS twitter TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';

-- Video intro
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS video_type TEXT DEFAULT 'youtube'; -- youtube, vimeo, mp4

-- Enhanced bio
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS bio_short TEXT DEFAULT ''; -- 60-90 words, for cards
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS bio_long TEXT DEFAULT ''; -- 300-600 words, full page
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS motto TEXT DEFAULT ''; -- personal tagline

-- Professional details
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS title TEXT DEFAULT ''; -- "Senior Partner", "Realitní makléř"
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS license_number TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS education TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::JSONB; -- [{name, year}]

-- Service & expertise
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::JSONB; -- [{city, district, country}]
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS specializations JSONB DEFAULT '[]'::JSONB; -- ["luxury", "new_dev", "commercial"]
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS property_types JSONB DEFAULT '[]'::JSONB; -- ["apartment", "house", "land"]
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS price_range_min BIGINT DEFAULT 0;
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS price_range_max BIGINT DEFAULT 0;

-- Performance metrics
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS total_sales_volume BIGINT DEFAULT 0; -- total EUR/CZK sold
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS avg_response_time_hours NUMERIC(5,1) DEFAULT 0; -- avg response time
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS response_rate_pct INT DEFAULT 0; -- 0-100

-- Cover/gallery
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS cover_photo TEXT DEFAULT ''; -- hero background image
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::JSONB; -- additional photos

-- Booking
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS calendly_url TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';

-- Personal touch
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS hobbies TEXT DEFAULT '';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS fun_fact TEXT DEFAULT '';


-- ═══════════════════════════════════════════════════════════════
-- AGENCIES — new columns
-- ═══════════════════════════════════════════════════════════════

-- Social media
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS linkedin TEXT DEFAULT '';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS instagram TEXT DEFAULT '';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS facebook TEXT DEFAULT '';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS twitter TEXT DEFAULT '';

-- Video
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS video_type TEXT DEFAULT 'youtube';

-- Enhanced description
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS description_long TEXT DEFAULT ''; -- full page description
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS motto TEXT DEFAULT ''; -- company tagline
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS mission TEXT DEFAULT ''; -- mission statement
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS values_text TEXT DEFAULT ''; -- company values

-- Visuals
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS cover_photo TEXT DEFAULT ''; -- hero background
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::JSONB; -- office photos

-- Performance
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS total_sales_volume BIGINT DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS avg_response_time_hours NUMERIC(5,1) DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS properties_sold_count INT DEFAULT 0;

-- Awards & certifications
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::JSONB; -- [{name, year}]
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::JSONB; -- ["ISO 9001", "AREMD"]

-- Service areas
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::JSONB;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS service_countries JSONB DEFAULT '[]'::JSONB; -- ["cz", "sk", "fr"]

-- Extra contact
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS calendly_url TEXT DEFAULT '';

-- Newsletter / CTA
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS newsletter_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS cta_text TEXT DEFAULT '';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS cta_url TEXT DEFAULT '';


-- ═══════════════════════════════════════════════════════════════
-- BRANCHES — enhanced
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE branches ADD COLUMN IF NOT EXISTS photo TEXT DEFAULT '';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT '';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS specializations JSONB DEFAULT '[]'::JSONB;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS broker_count INT DEFAULT 0;


-- ═══════════════════════════════════════════════════════════════
-- RECENT SALES table — track sold properties for profiles
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recent_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  -- Manual entry fields (if property not in DB)
  title TEXT NOT NULL DEFAULT '',
  city TEXT DEFAULT '',
  country TEXT DEFAULT 'cz',
  price BIGINT DEFAULT 0,
  price_currency TEXT DEFAULT 'czk',
  area NUMERIC(10,2) DEFAULT 0,
  category TEXT DEFAULT 'apartment',
  image_url TEXT DEFAULT '',
  sold_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recent_sales_broker ON recent_sales(broker_id);
CREATE INDEX IF NOT EXISTS idx_recent_sales_agency ON recent_sales(agency_id);


-- ═══════════════════════════════════════════════════════════════
-- BROKER TESTIMONIALS — dedicated table for richer reviews
-- ═══════════════════════════════════════════════════════════════
-- (We already have reviews table, but adding highlight field)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS property_city TEXT DEFAULT '';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
