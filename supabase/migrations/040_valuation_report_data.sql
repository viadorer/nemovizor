-- ============================================================
-- 040: Add report_data + gemini_text to valuation_reports
-- report_data = complete JSON snapshot for PDF regeneration
-- gemini_text = AI-generated commentary
-- ============================================================

ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS gemini_text TEXT;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS report_data JSONB;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS report_version INT DEFAULT 1;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS realvisor_valuation_id TEXT;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS realvisor_lead_id TEXT;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS realvisor_property_id TEXT;
ALTER TABLE valuation_reports ADD COLUMN IF NOT EXISTS cadastre_data JSONB;
