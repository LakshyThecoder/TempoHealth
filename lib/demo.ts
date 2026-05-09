import { PORTAL_FITBIT_IDS } from '@/lib/portal-fitbit'

/** Matches seeded synthetic patients — keep in sync with app/api/seed/route.ts */
export const DEMO_SYNTHETIC_PATIENT_IDS = [
  '11111111-1111-4111-8111-111111111101',
  '22222222-2222-4222-8222-222222222202',
] as const

export const DEMO_PRIMARY_PATIENT_ID = DEMO_SYNTHETIC_PATIENT_IDS[0]

/** First Fitabase portal cohort member — use after POST /api/seed {"mode":"portal_fitbit"} */
export const DEMO_PORTAL_FITBIT_ID = PORTAL_FITBIT_IDS[0]
