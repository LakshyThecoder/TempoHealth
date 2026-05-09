import { parseISO } from 'date-fns'

export type StabilityTrend = 'improving' | 'stable' | 'deteriorating'

export type PhysiologicalStabilityResult = {
  score: number
  trend: StabilityTrend
  components: {
    hr_stability: number
    hrv_stability: number
    sleep_stability: number
    activity_stability: number
  }
  /** 0–1 fraction of expected metric coverage in window */
  dataCompleteness: number
  narrativeHint: string
}

type Row = Record<string, unknown> & { recorded_at: string }

function columnNumbers(rows: Row[], key: string): number[] {
  return rows
    .map(r => r[key])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
}

function coeffVariation(vals: number[]): number {
  if (vals.length < 2) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  if (Math.abs(mean) < 1e-9) return 0
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
  return Math.sqrt(variance) / Math.abs(mean)
}

/** Map instability component (0–1-ish) to partial score contribution */
function stabilityFromDeviation(cv: number, weight: number): number {
  const penalty = Math.min(1, cv * 4)
  return weight * (1 - penalty)
}

/**
 * Single 0–100 physiological stability index from wearable rows + optional baselines.
 * Higher = more stable relative to recent personal variability (not population norms).
 */
export function computePhysiologicalStability(
  readings: Row[],
  baselines: Record<string, { mean: number; std: number }>,
  windowDays = 30
): PhysiologicalStabilityResult {
  const sorted = [...readings].sort(
    (a, b) => parseISO(a.recorded_at).getTime() - parseISO(b.recorded_at).getTime()
  )
  const cutoff = Date.now() - windowDays * 864e5
  const slice = sorted.filter(r => parseISO(r.recorded_at).getTime() >= cutoff)

  const hr = columnNumbers(slice, 'hr')
  const hrv = columnNumbers(slice, 'hrv_ms')
  const sleep = columnNumbers(slice, 'sleep_duration_min')
  const steps = columnNumbers(slice, 'steps')

  const cvHr = coeffVariation(hr)
  const cvHrv = coeffVariation(hrv)
  const cvSleep = coeffVariation(sleep)
  const cvSteps = coeffVariation(steps)

  const wHr = 0.22
  const wHrv = 0.28
  const wSleep = 0.28
  const wSteps = 0.22

  const hr_s = stabilityFromDeviation(cvHr, wHr)
  const hrv_s = stabilityFromDeviation(cvHrv, wHrv)
  const sleep_s = stabilityFromDeviation(cvSleep, wSleep)
  const act_s = stabilityFromDeviation(cvSteps, wSteps)

  const expectedCols = [hr.length > 0, hrv.length > 0, sleep.length > 0, steps.length > 0].filter(Boolean).length
  const dataCompleteness = expectedCols / 4

  let score = Math.round(100 * (hr_s + hrv_s + sleep_s + act_s))
  score = Math.min(100, Math.max(0, score))
  if (slice.length < 5) {
    score = Math.round(score * (0.55 + 0.45 * Math.min(1, slice.length / 5)))
  }

  const mid = Math.floor(slice.length / 2)
  const first = slice.slice(0, mid)
  const second = slice.slice(mid)
  const meanFirst =
    columnNumbers(first, 'hrv_ms').reduce((a, b) => a + b, 0) /
      Math.max(1, columnNumbers(first, 'hrv_ms').length) || 0
  const meanSecond =
    columnNumbers(second, 'hrv_ms').reduce((a, b) => a + b, 0) /
      Math.max(1, columnNumbers(second, 'hrv_ms').length) || 0

  let trend: StabilityTrend = 'stable'
  if (columnNumbers(second, 'hrv_ms').length >= 3 && columnNumbers(first, 'hrv_ms').length >= 3) {
    const delta = (meanSecond - meanFirst) / (Math.abs(meanFirst) > 1 ? Math.abs(meanFirst) : 1)
    if (delta > 0.06) trend = 'improving'
    else if (delta < -0.06) trend = 'deteriorating'
  }

  const baselineHint =
    baselines.hrv_ms && meanSecond < baselines.hrv_ms.mean - baselines.hrv_ms.std
      ? 'HRV running below personal baseline — worth correlating with sleep and stress events.'
      : ''

  return {
    score,
    trend,
    components: {
      hr_stability: Math.round(100 * (hr_s / wHr || 0)),
      hrv_stability: Math.round(100 * (hrv_s / wHrv || 0)),
      sleep_stability: Math.round(100 * (sleep_s / wSleep || 0)),
      activity_stability: Math.round(100 * (act_s / wSteps || 0)),
    },
    dataCompleteness,
    narrativeHint:
      dataCompleteness < 0.5
        ? 'Reduced confidence: several physiological channels sparse in this window.'
        : baselineHint || 'Stability reflects intra-person variability — not diagnosis.',
  }
}
