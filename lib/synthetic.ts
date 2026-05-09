import { addDays, subDays, format } from 'date-fns'
import { ANOMALY_METRICS, POPULATION_NORMS } from '@/lib/metrics'
import type { MetricsMeta } from '@/lib/supabase'

export interface DailyReading {
  patient_id: string
  recorded_at: string
  hr: number
  hrv_ms: number
  spo2: number
  steps: number
  sleep_duration_min: number
  sleep_deep_min: number
  rr: number
  skin_temp_delta: number
  sedentary_min?: number
  very_active_min?: number
  calories?: number
  metrics_meta?: MetricsMeta | null
}

function gaussianRandom(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

export function generatePatientData(patientId: string, days = 90): DailyReading[] {
  const readings: DailyReading[] = []
  const endDate = new Date()
  const startDate = subDays(endDate, days)

  const personalBaseline = {
    hr: 63 + gaussianRandom(0, 3),
    hrv_ms: 48 + gaussianRandom(0, 5),
    spo2: 97.8 + gaussianRandom(0, 0.3),
    steps: 8100 + gaussianRandom(0, 500),
    sleep_duration_min: 435 + gaussianRandom(0, 20),
    sleep_deep_min: 88 + gaussianRandom(0, 8),
    rr: 14.5 + gaussianRandom(0, 0.5),
    skin_temp_delta: 0.1 + gaussianRandom(0, 0.1),
    sedentary_min: 620 + gaussianRandom(0, 90),
    very_active_min: 38 + gaussianRandom(0, 18),
    calories: 2150 + gaussianRandom(0, 220),
  }

  const meta: MetricsMeta = {
    measured: ['hr', 'hrv_ms', 'spo2', 'steps', 'sleep_duration_min', 'sleep_deep_min', 'rr', 'skin_temp_delta', 'sedentary_min', 'very_active_min', 'calories'],
    derived: [],
    unavailable: [],
    notes: 'Fully simulated wearable stream for AF longitudinal demo.',
  }

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i)

    const inAnomalyWindow = i >= 65 && i <= 72
    const anomalyFactor = inAnomalyWindow ? 1 : 0

    const reading: DailyReading = {
      patient_id: patientId,
      recorded_at: format(date, "yyyy-MM-dd'T'12:00:00.000'Z'"),
      hr: clamp(
        gaussianRandom(personalBaseline.hr + anomalyFactor * 18, 4),
        45, 160
      ),
      hrv_ms: clamp(
        gaussianRandom(personalBaseline.hrv_ms - anomalyFactor * 22, 4),
        10, 120
      ),
      spo2: clamp(
        gaussianRandom(personalBaseline.spo2 - anomalyFactor * 1.8, 0.4),
        90, 100
      ),
      steps: clamp(
        Math.round(gaussianRandom(personalBaseline.steps - anomalyFactor * 3500, 800)),
        0, 30000
      ),
      sleep_duration_min: clamp(
        Math.round(gaussianRandom(personalBaseline.sleep_duration_min - anomalyFactor * 85, 30)),
        120, 600
      ),
      sleep_deep_min: clamp(
        Math.round(gaussianRandom(personalBaseline.sleep_deep_min - anomalyFactor * 35, 10)),
        0, 200
      ),
      rr: clamp(
        gaussianRandom(personalBaseline.rr + anomalyFactor * 2.8, 1),
        8, 30
      ),
      skin_temp_delta: clamp(
        gaussianRandom(personalBaseline.skin_temp_delta + anomalyFactor * 0.7, 0.15),
        -1.5, 2.0
      ),
      sedentary_min: clamp(
        Math.round(gaussianRandom(personalBaseline.sedentary_min + anomalyFactor * 140, 40)),
        180, 1200
      ),
      very_active_min: clamp(
        Math.round(gaussianRandom(personalBaseline.very_active_min - anomalyFactor * 22, 12)),
        0, 200
      ),
      calories: clamp(
        Math.round(gaussianRandom(personalBaseline.calories - anomalyFactor * 280, 120)),
        1200, 4500
      ),
      metrics_meta: meta,
    }

    readings.push(reading)
  }

  return readings
}

/** Rolling means/std from the tail window; skips null/undefined metrics; cold-starts from POPULATION_NORMS when &lt;3 samples. */
export function computeRollingBaselines(
  readings: ReadonlyArray<Partial<DailyReading>>,
  windowDays = 30
) {
  const result: Record<string, { mean: number; std: number }> = {}
  const window = readings.slice(-windowDays)

  for (const metric of ANOMALY_METRICS) {
    const values = window
      .map(r => (r as Record<string, unknown>)[metric])
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
    if (values.length < 3) {
      result[metric] = POPULATION_NORMS[metric]
      continue
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const std = Math.sqrt(variance) || 1
    result[metric] = { mean, std }
  }

  return result
}
