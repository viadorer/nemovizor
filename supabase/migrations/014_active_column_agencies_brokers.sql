-- Add active column to agencies and brokers for soft-delete support
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_agencies_active ON agencies(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_brokers_active ON brokers(active) WHERE active = true;
