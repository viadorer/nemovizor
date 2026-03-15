-- Track who created each property (useful when admin/broker creates without broker_id)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by) WHERE created_by IS NOT NULL;
