/** Enriched patient row for practice CRM dashboard (see GET /api/practice). */
export type PracticeRosterRow = {
  id: string
  name: string
  age: number
  condition: string
  medications: string[]
  data_source: string | null
  external_subject_id: string | null
  display_name: string | null
  clinician_id: string | null
  chart_notes: string | null
  care_status: string | null
  created_at: string
  pending_alerts: number
  urgent_pending: number
  last_wearable_at: string | null
}
