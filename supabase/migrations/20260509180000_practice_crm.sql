-- Lightweight practice / CRM fields on patient chart (demo-friendly RLS unchanged).
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS chart_notes text,
  ADD COLUMN IF NOT EXISTS care_status text DEFAULT 'active';

COMMENT ON COLUMN patients.chart_notes IS 'Internal practice notes — not shown to patients in this demo UI.';
COMMENT ON COLUMN patients.care_status IS 'Workflow: active | monitoring | review_needed | stable | archived';
