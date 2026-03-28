-- Daily aggregated analytics stats
CREATE TABLE IF NOT EXISTS analytics_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  event_count INT DEFAULT 0,
  unique_sessions INT DEFAULT 0,
  device_desktop INT DEFAULT 0,
  device_mobile INT DEFAULT 0,
  device_tablet INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stat_date, event_type)
);

-- Top pages per day
CREATE TABLE IF NOT EXISTS analytics_daily_top_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL,
  page_path TEXT NOT NULL,
  view_count INT DEFAULT 0,
  UNIQUE(stat_date, page_path)
);

-- Top properties per day
CREATE TABLE IF NOT EXISTS analytics_daily_top_properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL,
  property_id UUID NOT NULL,
  view_count INT DEFAULT 0,
  slug TEXT,
  city TEXT,
  UNIQUE(stat_date, property_id)
);

-- Daily funnel stats
CREATE TABLE IF NOT EXISTS analytics_daily_funnel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL UNIQUE,
  sessions_total INT DEFAULT 0,
  sessions_impression INT DEFAULT 0,
  sessions_detail INT DEFAULT 0,
  sessions_contact INT DEFAULT 0,
  bounce_count INT DEFAULT 0,
  avg_scroll_depth NUMERIC(5,2) DEFAULT 0,
  avg_time_on_page NUMERIC(8,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily referrer sources
CREATE TABLE IF NOT EXISTS analytics_daily_referrers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL,
  source TEXT NOT NULL,
  visit_count INT DEFAULT 0,
  UNIQUE(stat_date, source)
);

-- Hourly activity (for heatmap)
CREATE TABLE IF NOT EXISTS analytics_daily_hourly (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL,
  hour_of_day INT NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  event_count INT DEFAULT 0,
  UNIQUE(stat_date, hour_of_day)
);

-- Enable RLS
ALTER TABLE analytics_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_top_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_top_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_funnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_hourly ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_all" ON analytics_daily_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON analytics_daily_top_pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON analytics_daily_top_properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON analytics_daily_funnel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON analytics_daily_referrers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON analytics_daily_hourly FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_daily_stats_date ON analytics_daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_top_pages_date ON analytics_daily_top_pages(stat_date);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_top_properties_date ON analytics_daily_top_properties(stat_date);
