import { METRIC_LABELS } from '@/lib/anomaly'

export type ConfidenceLevel = 'high' | 'moderate' | 'low'

export type MetricDelta = {
  metric: string
  label: string
  pctChange: number
  direction: 'up' | 'down' | 'stable'
  weekAvg: number
  baselineMean: number
}

export type MonthlyRollup = {
  windowDays: number
  daysWithData: number
  deltas: MetricDelta[]
  narrative: string
}

export type ClinicalPatternInsight = {
  confidence: ConfidenceLevel
  confidenceReason: string
  windowDays: number
  daysWithData: number
  deltas: MetricDelta[]
  /** One-line longitudinal summary for clinicians */
  sustainedNarrative: string
  /** Connects physiology to possible mechanisms — not diagnostic */
  diseaseContext: string
  /** How many key domains deviate together (HR, sleep, activity, HRV) */
  alignedStressSignals: number
  trendDurationDays: number
  weeklySummaryLine: string
  /** Longer window vs personal baseline (typically ~30 days of rows). */
  monthly: MonthlyRollup | null
}

type ReadingRow = {
  recorded_at: string
  hr?: number | null
  hrv_ms?: number | null
  steps?: number | null
  sleep_duration_min?: number | null
  sleep_deep_min?: number | null
  spo2?: number | null
  sedentary_min?: number | null
  very_active_min?: number | null
  calories?: number | null
}

const WINDOW = 7
const MONTH_WINDOW = 30
const KEY_METRICS = ['hr', 'sleep_duration_min', 'steps', 'hrv_ms'] as const

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function meanLastWindow(readings: ReadingRow[], metric: keyof ReadingRow, days: number): number | null {
  const slice = readings.slice(-days)
  const vals = slice
    .map(r => r[metric])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  return mean(vals)
}

function daysWithNumericSignal(readings: ReadingRow[], days: number): number {
  const slice = readings.slice(-days)
  let n = 0
  for (const r of slice) {
    const ok = KEY_METRICS.some(k => {
      const v = r[k as keyof ReadingRow]
      return typeof v === 'number' && !Number.isNaN(v)
    })
    if (ok) n++
  }
  return n
}

function classifyDirection(pct: number): 'up' | 'down' | 'stable' {
  if (Math.abs(pct) < 8) return 'stable'
  return pct > 0 ? 'up' : 'down'
}

/** Higher = worse alignment of stress-type signals (rule-based, explainable). */
function stressAlignmentScore(flags: {
  hrUp: boolean
  sleepDown: boolean
  stepsDown: boolean
  hrvDown: boolean
}): number {
  let s = 0
  if (flags.hrUp) s += 1
  if (flags.sleepDown) s += 1
  if (flags.stepsDown) s += 1
  if (flags.hrvDown) s += 1
  return Math.min(100, s * 28)
}

function buildNarrative(
  deltas: MetricDelta[],
  flags: { hrUp: boolean; sleepDown: boolean; stepsDown: boolean; hrvDown: boolean }
): { sustained: string; disease: string } {
  const parts: string[] = []
  if (flags.hrUp) parts.push('resting heart rate has run above this person’s usual')
  if (flags.sleepDown) parts.push('sleep duration has trended below baseline')
  if (flags.stepsDown) parts.push('daily movement has decreased')
  if (flags.hrvDown) parts.push('recovery variability looks lower than typical')

  const joined =
    parts.length === 0
      ? 'Key wearable streams are largely aligned with personal baselines over the past week.'
      : `Over the past ${WINDOW} days, ${parts.join('; ')}.`

  let disease =
    'Wearable trends are not diagnostic. When multiple recovery signals diverge together, teams often review symptoms, medications, sleep disorders, illness, and cardiovascular strain — prioritizing what the patient is experiencing day to day.'

  if (stressAlignmentScore(flags) >= 56) {
    disease =
      'This multi-signal pattern can overlap with recovery stress, sleep disruption, inflammatory illness, or deconditioning — contexts where autonomic and behavioral rhythms move together. Use alongside symptoms, meds, and vitals in clinic; correlation is not causation.'
  } else if (parts.length >= 2) {
    disease =
      'Partial divergence from baseline may still warrant context (travel, illness, training load). Combine with patient-reported symptoms before inferring disease activity.'
  }

  return { sustained: joined, disease }
}

function buildMonthlyNarrative(deltas: MetricDelta[]): string {
  if (!deltas.length) return 'Not enough overlapping history for a monthly-style summary yet.'
  const notable = deltas.filter(d => d.direction !== 'stable' && Math.abs(d.pctChange) >= 6)
  if (!notable.length) {
    return `Across the last ${MONTH_WINDOW} days of data, key streams stayed close to your personal baseline on average.`
  }
  const bits = notable.map(d => {
    const dir = d.direction === 'up' ? 'higher' : 'lower'
    return `${d.label.toLowerCase()} averaged ${dir} than your baseline (~${Math.abs(d.pctChange).toFixed(0)}%)`
  })
  return `Across roughly the last month of wearable days: ${bits.join('; ')}. This is a longitudinal summary — not a diagnosis.`
}

export function computeMonthlyRollup(
  readings: ReadingRow[],
  baselines: Record<string, { mean: number; std: number }>
): MonthlyRollup | null {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  )
  const daysWithData = daysWithNumericSignal(sorted, MONTH_WINDOW)
  if (daysWithData < 5) return null

  const deltas: MetricDelta[] = []
  for (const m of KEY_METRICS) {
    const b = baselines[m]
    if (!b) continue
    const w = meanLastWindow(sorted, m as keyof ReadingRow, MONTH_WINDOW)
    if (w == null) continue
    const pct = ((w - b.mean) / (Math.abs(b.mean) < 1e-6 ? 1 : b.mean)) * 100
    deltas.push({
      metric: m,
      label: METRIC_LABELS[m] || m,
      pctChange: pct,
      direction: classifyDirection(pct),
      weekAvg: w,
      baselineMean: b.mean,
    })
  }

  return {
    windowDays: MONTH_WINDOW,
    daysWithData,
    deltas,
    narrative: buildMonthlyNarrative(deltas),
  }
}

/**
 * Deterministic, explainable longitudinal insight from daily rows + personal baselines.
 */
export function computeClinicalInsights(
  readings: ReadingRow[],
  baselines: Record<string, { mean: number; std: number }>
): ClinicalPatternInsight {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  )

  const daysWithData = daysWithNumericSignal(sorted, WINDOW)
  const deltas: MetricDelta[] = []

  for (const m of KEY_METRICS) {
    const b = baselines[m]
    if (!b) continue
    const w = meanLastWindow(sorted, m as keyof ReadingRow, WINDOW)
    if (w == null) continue
    const pct = ((w - b.mean) / (Math.abs(b.mean) < 1e-6 ? 1 : b.mean)) * 100
    deltas.push({
      metric: m,
      label: METRIC_LABELS[m] || m,
      pctChange: pct,
      direction: classifyDirection(pct),
      weekAvg: w,
      baselineMean: b.mean,
    })
  }

  const dHr = deltas.find(d => d.metric === 'hr')
  const dSleep = deltas.find(d => d.metric === 'sleep_duration_min')
  const dSteps = deltas.find(d => d.metric === 'steps')
  const dHrv = deltas.find(d => d.metric === 'hrv_ms')

  const flags = {
    hrUp: (dHr?.direction === 'up' && Math.abs(dHr.pctChange) >= 8) ?? false,
    sleepDown: (dSleep?.direction === 'down' && Math.abs(dSleep.pctChange) >= 8) ?? false,
    stepsDown: (dSteps?.direction === 'down' && Math.abs(dSteps.pctChange) >= 10) ?? false,
    hrvDown: (dHrv?.direction === 'down' && Math.abs(dHrv.pctChange) >= 8) ?? false,
  }

  const aligned = [flags.hrUp, flags.sleepDown, flags.stepsDown, flags.hrvDown].filter(Boolean).length
  const { sustained, disease } = buildNarrative(deltas, flags)

  let confidence: ConfidenceLevel = 'low'
  let confidenceReason = 'Limited overlapping daily rows in the last week reduce certainty.'
  const metricCoverage = deltas.length
  if (daysWithData >= 6 && metricCoverage >= 3) {
    confidence = 'high'
    confidenceReason = 'Most days in the window include wearable rows across multiple signals.'
  } else if (daysWithData >= 4 && metricCoverage >= 2) {
    confidence = 'moderate'
    confidenceReason = 'Moderate data density — interpret directions, not exact percentages, as gospel.'
  }

  const trendDurationDays = Math.min(WINDOW, daysWithData || WINDOW)

  const fmt = (d: MetricDelta) => {
    const arrow = d.direction === 'up' ? '↑' : d.direction === 'down' ? '↓' : '→'
    return `${d.label} ${arrow} ${Math.abs(d.pctChange).toFixed(0)}%`
  }
  const weeklySummaryLine =
    deltas.length === 0
      ? 'Insufficient overlapping metrics for a weekly delta summary.'
      : deltas.map(fmt).join(' · ')

  const monthly = computeMonthlyRollup(sorted, baselines)

  return {
    confidence,
    confidenceReason,
    windowDays: WINDOW,
    daysWithData,
    deltas,
    sustainedNarrative: sustained,
    diseaseContext: disease,
    alignedStressSignals: aligned,
    trendDurationDays,
    weeklySummaryLine,
    monthly,
  }
}
