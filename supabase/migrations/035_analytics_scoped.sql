-- ============================================================
-- 035_analytics_scoped.sql
-- Add broker_id / agency_id scoping to all analytics summary tables
-- Uses sentinel UUID '00000000-0000-0000-0000-000000000000' for global stats
-- (NOT NULL DEFAULT sentinel so we can use plain UNIQUE constraints for upsert)
-- ============================================================

-- ── 1. Add columns with NOT NULL DEFAULT sentinel ───────────

ALTER TABLE analytics_daily_stats
  ADD COLUMN IF NOT EXISTS broker_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS agency_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE analytics_daily_top_pages
  ADD COLUMN IF NOT EXISTS broker_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS agency_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE analytics_daily_top_properties
  ADD COLUMN IF NOT EXISTS broker_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS agency_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE analytics_daily_funnel
  ADD COLUMN IF NOT EXISTS broker_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS agency_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE analytics_daily_referrers
  ADD COLUMN IF NOT EXISTS broker_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS agency_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE analytics_daily_hourly
  ADD COLUMN IF NOT EXISTS broker_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS agency_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- ── 2. Drop old unique constraints & create new ones ────────

-- analytics_daily_stats: was UNIQUE(stat_date, event_type)
ALTER TABLE analytics_daily_stats DROP CONSTRAINT IF EXISTS analytics_daily_stats_stat_date_event_type_key;
ALTER TABLE analytics_daily_stats ADD CONSTRAINT uq_daily_stats_scoped
  UNIQUE (stat_date, event_type, broker_id, agency_id);

-- analytics_daily_top_pages: was UNIQUE(stat_date, page_path)
ALTER TABLE analytics_daily_top_pages DROP CONSTRAINT IF EXISTS analytics_daily_top_pages_stat_date_page_path_key;
ALTER TABLE analytics_daily_top_pages ADD CONSTRAINT uq_daily_top_pages_scoped
  UNIQUE (stat_date, page_path, broker_id, agency_id);

-- analytics_daily_top_properties: was UNIQUE(stat_date, property_id)
ALTER TABLE analytics_daily_top_properties DROP CONSTRAINT IF EXISTS analytics_daily_top_properties_stat_date_property_id_key;
ALTER TABLE analytics_daily_top_properties ADD CONSTRAINT uq_daily_top_properties_scoped
  UNIQUE (stat_date, property_id, broker_id, agency_id);

-- analytics_daily_funnel: was UNIQUE(stat_date)
ALTER TABLE analytics_daily_funnel DROP CONSTRAINT IF EXISTS analytics_daily_funnel_stat_date_key;
ALTER TABLE analytics_daily_funnel ADD CONSTRAINT uq_daily_funnel_scoped
  UNIQUE (stat_date, broker_id, agency_id);

-- analytics_daily_referrers: was UNIQUE(stat_date, source)
ALTER TABLE analytics_daily_referrers DROP CONSTRAINT IF EXISTS analytics_daily_referrers_stat_date_source_key;
ALTER TABLE analytics_daily_referrers ADD CONSTRAINT uq_daily_referrers_scoped
  UNIQUE (stat_date, source, broker_id, agency_id);

-- analytics_daily_hourly: was UNIQUE(stat_date, hour_of_day)
ALTER TABLE analytics_daily_hourly DROP CONSTRAINT IF EXISTS analytics_daily_hourly_stat_date_hour_of_day_key;
ALTER TABLE analytics_daily_hourly ADD CONSTRAINT uq_daily_hourly_scoped
  UNIQUE (stat_date, hour_of_day, broker_id, agency_id);

-- ── 3. Indexes for scoped queries ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_daily_stats_broker ON analytics_daily_stats(broker_id) WHERE broker_id != '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_daily_stats_agency ON analytics_daily_stats(agency_id) WHERE agency_id != '00000000-0000-0000-0000-000000000000';

CREATE INDEX IF NOT EXISTS idx_daily_top_pages_broker ON analytics_daily_top_pages(broker_id) WHERE broker_id != '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_daily_top_pages_agency ON analytics_daily_top_pages(agency_id) WHERE agency_id != '00000000-0000-0000-0000-000000000000';

CREATE INDEX IF NOT EXISTS idx_daily_top_properties_broker ON analytics_daily_top_properties(broker_id) WHERE broker_id != '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_daily_top_properties_agency ON analytics_daily_top_properties(agency_id) WHERE agency_id != '00000000-0000-0000-0000-000000000000';

CREATE INDEX IF NOT EXISTS idx_daily_funnel_broker ON analytics_daily_funnel(broker_id) WHERE broker_id != '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_daily_funnel_agency ON analytics_daily_funnel(agency_id) WHERE agency_id != '00000000-0000-0000-0000-000000000000';

CREATE INDEX IF NOT EXISTS idx_daily_referrers_broker ON analytics_daily_referrers(broker_id) WHERE broker_id != '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_daily_referrers_agency ON analytics_daily_referrers(agency_id) WHERE agency_id != '00000000-0000-0000-0000-000000000000';

CREATE INDEX IF NOT EXISTS idx_daily_hourly_broker ON analytics_daily_hourly(broker_id) WHERE broker_id != '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_daily_hourly_agency ON analytics_daily_hourly(agency_id) WHERE agency_id != '00000000-0000-0000-0000-000000000000';
