-- Add user_id to agencies table (same pattern as brokers in 008)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agencies_user ON agencies(user_id) WHERE user_id IS NOT NULL;
