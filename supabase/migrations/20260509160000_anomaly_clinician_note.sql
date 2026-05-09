-- Clinician annotation on alert workflow (in-the-loop documentation).
ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS clinician_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

COMMENT ON COLUMN anomalies.clinician_note IS 'Optional note when reviewing or dismissing an alert (audit / handoff).';
