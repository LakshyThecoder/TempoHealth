import { parseISO } from 'date-fns'

type Row = { recorded_at: string; hrv_ms?: number | null; sleep_duration_min?: number | null; steps?: number | null }

function nums(rows: Row[], k: keyof Row): number[] {
  return rows.map(r => r[k]).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
}

function std(vals: number[]): number {
  if (vals.length < 2) return 0
  const m = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length)
}

/** Lightweight phenotype tags for cohort-style framing (demo / UX layer). */
export function inferLightPhenotype(readings: Row[]): {
  labels: string[]
  axes: { stress_responsiveness: number; sleep_sensitivity: number; activity_variability: number; recovery_speed: number }
} {
  const sorted = [...readings].sort(
    (a, b) => parseISO(a.recorded_at).getTime() - parseISO(b.recorded_at).getTime()
  )
  const hrv = nums(sorted, 'hrv_ms')
  const sleep = nums(sorted, 'sleep_duration_min')
  const steps = nums(sorted, 'steps')

  const hrvCv = hrv.length >= 3 ? std(hrv) / (Math.abs(hrv.reduce((a, b) => a + b, 0) / hrv.length) || 1) : 0
  const sleepCv = sleep.length >= 3 ? std(sleep) / (Math.abs(sleep.reduce((a, b) => a + b, 0) / sleep.length) || 1) : 0
  const stepCv = steps.length >= 3 ? std(steps) / (Math.abs(steps.reduce((a, b) => a + b, 0) / steps.length) || 1) : 0

  const stress_responsiveness = Math.min(100, Math.round(hrvCv * 120))
  const sleep_sensitivity = Math.min(100, Math.round(sleepCv * 90))
  const activity_variability = Math.min(100, Math.round(stepCv * 70))

  let recovery_speed = 50
  if (hrv.length >= 8) {
    const half = Math.floor(hrv.length / 2)
    const a = hrv.slice(0, half).reduce((x, y) => x + y, 0) / half
    const b = hrv.slice(half).reduce((x, y) => x + y, 0) / (hrv.length - half)
    recovery_speed = Math.min(100, Math.round(50 + (b - a) * 2))
  }

  const labels: string[] = []
  if (stress_responsiveness > 55) labels.push('high autonomic lability')
  if (sleep_sensitivity > 55) labels.push('sleep-sensitive phenotype')
  if (activity_variability > 55) labels.push('volatile activity pattern')
  if (recovery_speed > 62) labels.push('faster HRV rebound')
  else if (recovery_speed < 38 && hrv.length >= 8) labels.push('slow recovery trajectory')

  if (labels.length === 0) labels.push('balanced variability profile')

  return {
    labels,
    axes: { stress_responsiveness, sleep_sensitivity, activity_variability, recovery_speed },
  }
}
