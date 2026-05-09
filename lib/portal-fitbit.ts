/** Stable UUIDs for Fitabase portal bundle (seeded from public/data — judges see real cohort rows without local CSV). */
export const PORTAL_FITBIT_IDS = [
  '33333333-3333-4333-8333-333333333303',
  '44444444-4444-4444-8444-444444444404',
] as const

export type PortalBundleReading = {
  recorded_at: string
  hr: number | null
  hrv_ms: number | null
  spo2: number | null
  steps: number | null
  sleep_duration_min: number | null
  sleep_deep_min: number | null
  rr: number | null
  skin_temp_delta: number | null
  sedentary_min: number | null
  very_active_min: number | null
  calories: number | null
  metrics_meta: Record<string, unknown> | null
}

export type PortalBundleSubject = {
  patient_id: string
  external_subject_id: string
  name: string
  age: number
  condition: string
  medications: string[]
  readings: PortalBundleReading[]
}

export type PortalFitbitBundle = {
  version: 1
  provenance: string
  subjects: PortalBundleSubject[]
}
