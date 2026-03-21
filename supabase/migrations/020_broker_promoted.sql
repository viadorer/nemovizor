-- Add is_promoted flag to brokers
-- Brokers with is_promoted = true are eligible for the grid promo card
-- Location is inferred from their active property listings

ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_brokers_promoted ON brokers(is_promoted) WHERE is_promoted = true;
