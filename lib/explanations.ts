import { METRIC_LABELS } from '@/lib/anomaly'

type ReadingLite = {
  recorded_at: string
  sleep_duration_min?: number | null
  steps?: number | null
  hrv_ms?: number | null
  sedentary_min?: number | null
}

/** Rule-based multi-signal explanation — complements LLM clinical_context (no extra API call). */
export function buildStructuredWhyExplanation(
  metric: string,
  readingsWindow: ReadingLite[],
  anomalyTriggeredAt: string
): { headline: string; contributors: string[]; confidence: 'low' | 'medium' | 'high' } {
  const t0 = new Date(anomalyTriggeredAt).getTime()
  const prior = readingsWindow.filter(r => new Date(r.recorded_at).getTime() < t0).slice(-7)
  const recent = readingsWindow.filter(r => Math.abs(new Date(r.recorded_at).getTime() - t0) < 5 * 864e5)

  const contributors: string[] = []

  const avg = (key: keyof ReadingLite) => {
    const nums = recent.map(r => r[key]).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
    if (!nums.length) return null
    return nums.reduce((a, b) => a + b, 0) / nums.length
  }

  const priorSleep = prior.map(p => p.sleep_duration_min).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  const recentSleep = recent.map(p => p.sleep_duration_min).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  const avgPriorS = priorSleep.length ? priorSleep.reduce((a, b) => a + b, 0) / priorSleep.length : null
  const avgRecentS = recentSleep.length ? recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length : null
  const sleepDrop = avgPriorS != null && avgRecentS != null && avgRecentS < avgPriorS * 0.92

  const priorSteps = prior.map(p => p.steps).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  const recentSteps = recent.map(p => p.steps).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  const avgPriorSt = priorSteps.length ? priorSteps.reduce((a, b) => a + b, 0) / priorSteps.length : null
  const avgRecentSt = recentSteps.length ? recentSteps.reduce((a, b) => a + b, 0) / recentSteps.length : null
  const activityDrop = avgPriorSt != null && avgRecentSt != null && avgRecentSt < avgPriorSt * 0.85

  const sedHigh = (avg('sedentary_min') ?? 0) > 480

  if (metric === 'hrv_ms' || metric.includes('hrv')) {
    if (sleepDrop) contributors.push('Sleep duration compressed in the days around this flag — often couples with lower HRV.')
    if (activityDrop) contributors.push('Step counts trended down versus your recent baseline — deconditioning or illness pattern.')
    if (sedHigh) contributors.push('Elevated sedentary burden may track with autonomic suppression.')
  }
  if (metric === 'sleep_duration_min' || metric === 'sleep_deep_min') {
    if (sedHigh) contributors.push('Higher sedentary time can associate with fragmented recovery windows.')
  }
  if (metric === 'steps' || metric === 'very_active_min') {
    if (sleepDrop) contributors.push('Sleep debt commonly precedes voluntary activity pullback.')
  }

  if (contributors.length === 0) {
    contributors.push(
      'Single-metric deviation — review adjacent days for stacked signals (sleep + activity + autonomic).'
    )
  }

  let confidence: 'low' | 'medium' | 'high' = 'medium'
  if (recent.length < 4 || prior.length < 4) confidence = 'low'
  if (contributors.length >= 2 && recent.length >= 10) confidence = 'high'

  const label = METRIC_LABELS[metric] || metric
  const headline = `${label} shift is most consistent with ${contributors[0]?.replace(/\.$/, '') || 'multi-factor variability'}.`

  return { headline, contributors, confidence }
}
