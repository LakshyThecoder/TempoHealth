-- Deployed via Supabase MCP / dashboard — duplicated here for repo history.
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS external_subject_id text,
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'synthetic_demo',
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE wearable_readings
  ADD COLUMN IF NOT EXISTS sedentary_min double precision,
  ADD COLUMN IF NOT EXISTS very_active_min double precision,
  ADD COLUMN IF NOT EXISTS calories double precision,
  ADD COLUMN IF NOT EXISTS metrics_meta jsonb;
