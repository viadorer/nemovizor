-- ============================================================
-- 024_analytics_events.sql
-- Full visitor behavior tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type   TEXT        NOT NULL,
  properties   JSONB       NOT NULL DEFAULT '{}',
  url          TEXT,
  referrer     TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  device_type  TEXT,  -- 'mobile' | 'tablet' | 'desktop'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_session   ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type      ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created   ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user      ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_type_date ON analytics_events(event_type, created_at DESC);
-- For property-specific queries
CREATE INDEX IF NOT EXISTS idx_analytics_prop      ON analytics_events((properties->>'property_id')) WHERE properties->>'property_id' IS NOT NULL;

-- RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert events
CREATE POLICY "anyone can insert analytics"
  ON analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "admin can read analytics"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ─── Convenience views ────────────────────────────────────────

-- Daily event counts by type (last 30 days)
CREATE OR REPLACE VIEW analytics_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  event_type,
  COUNT(*)                       AS event_count,
  COUNT(DISTINCT session_id)     AS sessions,
  COUNT(DISTINCT user_id)        AS users
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- Top pages (last 7 days)
CREATE OR REPLACE VIEW analytics_top_pages AS
SELECT
  url,
  COUNT(*)               AS views,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM analytics_events
WHERE event_type = 'page_view'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY url
ORDER BY views DESC;

-- Top searched terms / filters (last 7 days)
CREATE OR REPLACE VIEW analytics_top_searches AS
SELECT
  properties->>'query' AS query,
  COUNT(*)             AS count
FROM analytics_events
WHERE event_type = 'search'
  AND properties->>'query' IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY count DESC;

GRANT SELECT ON analytics_daily TO authenticated;
GRANT SELECT ON analytics_top_pages TO authenticated;
GRANT SELECT ON analytics_top_searches TO authenticated;
