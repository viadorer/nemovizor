-- Migration 018: Realman Import Support
-- Přidání external_id pro propojení s Realman systémem a tabulka import_logs

-- ===== Rozšíření properties =====
ALTER TABLE properties ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS external_source TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id) WHERE external_id IS NOT NULL;

-- ===== Import Logs =====
CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  import_type TEXT NOT NULL CHECK (import_type IN ('create', 'update', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
  raw_data JSONB,
  processed_data JSONB,
  error_message TEXT,
  warning_messages TEXT[],
  photos_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_external ON import_logs(external_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON import_logs(status);
CREATE INDEX IF NOT EXISTS idx_import_logs_created ON import_logs(created_at DESC);

-- RLS
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Admin může číst logy
CREATE POLICY "import_logs_admin_read" ON import_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
