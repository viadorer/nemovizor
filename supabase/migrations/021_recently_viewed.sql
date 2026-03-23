-- Recently viewed properties per user
CREATE TABLE IF NOT EXISTS recently_viewed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON recently_viewed(user_id, viewed_at DESC);

ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own views" ON recently_viewed
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own views" ON recently_viewed
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own views" ON recently_viewed
  FOR DELETE USING (auth.uid() = user_id);
