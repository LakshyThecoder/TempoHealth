import { parseISO } from 'date-fns'

type Row = { recorded_at: string } & Record<string, unknown>

/** Compare first vs second half of window for key recovery proxies (HRV, sleep, steps). */
export function computeRecoveryTrend(readings: Row[]): {
  direction: 'improving' | 'stable' | 'worsening'
  summary: string
  confidence: 'low' | 'medium' | 'high'
} {
  const sorted = [...readings].sort(
    (a, b) => parseISO(a.recorded_at).getTime() - parseISO(b.recorded_at).getTime()
  )
  if (sorted.length < 10) {
    return {
      direction: 'stable',
      summary: 'Not enough longitudinal points to infer recovery trajectory.',
      confidence: 'low',
    }
  }

  const mid = Math.floor(sorted.length / 2)
  const a = sorted.slice(0, mid)
  const b = sorted.slice(mid)

  const mean = (rows: Row[], k: string) => {
    const v = rows.map(r => r[k]).filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
    return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null
  }

  const hrvA = mean(a, 'hrv_ms')
  const hrvB = mean(b, 'hrv_ms')
  const sleepA = mean(a, 'sleep_duration_min')
  const sleepB = mean(b, 'sleep_duration_min')
  const stepsA = mean(a, 'steps')
  const stepsB = mean(b, 'steps')

  let score = 0
  const parts: string[] = []
  if (hrvA != null && hrvB != null) {
    const d = (hrvB - hrvA) / (Math.abs(hrvA) || 1)
    score += d > 0.05 ? 1 : d < -0.05 ? -1 : 0
    if (Math.abs(d) > 0.05) parts.push(`HRV ${d > 0 ? 'up' : 'down'} vs earlier window`)
  }
  if (sleepA != null && sleepB != null) {
    const d = (sleepB - sleepA) / (Math.abs(sleepA) || 1)
    score += d > 0.04 ? 0.5 : d < -0.04 ? -0.5 : 0
  }
  if (stepsA != null && stepsB != null) {
    const d = (stepsB - stepsA) / (Math.abs(stepsA) || 1)
    score += d > 0.06 ? 0.5 : d < -0.06 ? -0.5 : 0
  }

  let direction: 'improving' | 'stable' | 'worsening' = 'stable'
  if (score > 0.5) direction = 'improving'
  else if (score < -0.5) direction = 'worsening'

  const confidence: 'low' | 'medium' | 'high' = sorted.length > 40 ? 'high' : sorted.length > 20 ? 'medium' : 'low'

  const summary =
    parts.length > 0
      ? `Recovery proxies: ${parts.join('; ')}.`
      : 'Recovery signals mixed — no strong directional change in HRV, sleep, or activity halves.'

  return { direction, summary, confidence }
}
