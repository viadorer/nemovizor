-- ============================================================
-- Nemovizor – Migration 007: Projects
-- Projekty (developerske projekty obsahujici vice nemovitosti)
-- ============================================================

-- Pozn: ALTER TYPE ADD VALUE nelze v transakci, ale Supabase SQL Editor to zvladne
ALTER TYPE listing_type ADD VALUE IF NOT EXISTS 'project';

-- ===== PROJECTS =====
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,

  -- Developer / agency
  developer_name TEXT NOT NULL DEFAULT '',
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,

  -- Location
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  street TEXT,
  zip TEXT,
  region TEXT,
  location_label TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,

  -- Description
  summary TEXT NOT NULL DEFAULT '',
  description TEXT,

  -- Unit stats (auto-updated by trigger)
  total_units INTEGER NOT NULL DEFAULT 0,
  available_units INTEGER NOT NULL DEFAULT 0,
  sold_units INTEGER NOT NULL DEFAULT 0,
  reserved_units INTEGER NOT NULL DEFAULT 0,

  -- Price/area range
  price_from NUMERIC,
  price_to NUMERIC,
  area_from NUMERIC,
  area_to NUMERIC,

  -- Timeline
  construction_start DATE,
  estimated_completion DATE,
  actual_completion DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('planned', 'active', 'construction', 'selling', 'completed', 'archived')),

  -- Media
  image_src TEXT NOT NULL DEFAULT '',
  images TEXT[] NOT NULL DEFAULT '{}',

  -- Features
  elevator BOOLEAN NOT NULL DEFAULT false,
  balcony BOOLEAN NOT NULL DEFAULT true,
  terrace BOOLEAN NOT NULL DEFAULT false,
  garden BOOLEAN NOT NULL DEFAULT false,
  pool BOOLEAN NOT NULL DEFAULT false,
  playground BOOLEAN NOT NULL DEFAULT false,
  underground_parking BOOLEAN NOT NULL DEFAULT false,

  -- Flags
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link properties to projects
ALTER TABLE properties ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_city ON projects(city);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_properties_project ON properties(project_id) WHERE project_id IS NOT NULL;

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_read" ON projects FOR SELECT USING (true);

-- ===== Auto-refresh project stats when properties change =====
CREATE OR REPLACE FUNCTION refresh_project_stats()
RETURNS TRIGGER AS $$
DECLARE
  pid UUID;
BEGIN
  pid := COALESCE(NEW.project_id, OLD.project_id);
  IF pid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE projects SET
    total_units = sub.total,
    available_units = sub.available,
    sold_units = sub.sold,
    price_from = sub.pmin,
    price_to = sub.pmax,
    area_from = sub.amin,
    area_to = sub.amax
  FROM (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE active = true) AS available,
      COUNT(*) FILTER (WHERE active = false) AS sold,
      MIN(price) FILTER (WHERE price > 0) AS pmin,
      MAX(price) AS pmax,
      MIN(usable_area) FILTER (WHERE usable_area > 0) AS amin,
      MAX(usable_area) AS amax
    FROM properties WHERE project_id = pid
  ) sub
  WHERE projects.id = pid;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_project_stats
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION refresh_project_stats();
