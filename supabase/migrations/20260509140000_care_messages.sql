-- Secure care-team messaging thread (demo: open policies for judge portal without auth).
CREATE TABLE IF NOT EXISTS care_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('clinician', 'patient')),
  body text NOT NULL,
  topic text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS care_messages_patient_created_idx
  ON care_messages (patient_id, created_at DESC);

ALTER TABLE care_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_messages_select_demo"
  ON care_messages FOR SELECT
  USING (true);

CREATE POLICY "care_messages_insert_demo"
  ON care_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "care_messages_update_demo"
  ON care_messages FOR UPDATE
  USING (true)
  WITH CHECK (true);
