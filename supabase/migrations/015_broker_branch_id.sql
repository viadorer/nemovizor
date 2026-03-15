-- Add branch_id to brokers so a broker can be assigned to a specific branch
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_brokers_branch ON brokers(branch_id) WHERE branch_id IS NOT NULL;
