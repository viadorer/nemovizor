-- ============================================================
-- International Support — source tracking + GBP currency
-- ============================================================

-- Add GBP for UK properties
ALTER TYPE price_currency ADD VALUE IF NOT EXISTS 'gbp';

-- Source tracking (sreality, rightmove, immoscout24, immoweb)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'cz';

CREATE INDEX IF NOT EXISTS idx_properties_source ON properties(source);
CREATE INDEX IF NOT EXISTS idx_properties_country ON properties(country);

-- Update existing properties as Czech/Sreality
UPDATE properties SET source = 'sreality', country = 'cz' WHERE source IS NULL;
