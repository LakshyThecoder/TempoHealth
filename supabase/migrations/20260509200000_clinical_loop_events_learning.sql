-- Clinical decision loop: per-patient learning + correlated events timeline.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS learning_profile jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN patients.learning_profile IS 'Clinician feedback-derived weights: metricSignals.{metric}.{useful|noise} counts.';

CREATE TABLE IF NOT EXISTS patient_clinical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'medication_change',
      'symptom',
      'stress',
      'illness',
      'travel',
      'lifestyle',
      'other'
    )
  ),
  title text NOT NULL,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_events_patient_time
  ON patient_clinical_events (patient_id, occurred_at DESC);

COMMENT ON TABLE patient_clinical_events IS 'Layered timeline: meds, symptoms, stress, illness, travel — for cause/effect correlation with wearables.';

-- Expand anomaly workflow (human-in-the-loop). Migrate legacy "reviewed" → "acknowledged".
UPDATE anomalies SET status = 'acknowledged' WHERE status = 'reviewed';
