/** Clinician feedback loop: track useful vs noise per metric to tune detection sensitivity. */

export type MetricFeedback = { useful?: number; noise?: number }

export type LearningProfile = {
  metricSignals?: Record<string, MetricFeedback>
}

export function bumpMetricFeedback(
  profile: LearningProfile | null | undefined,
  metric: string,
  kind: 'useful' | 'noise'
): LearningProfile {
  const p: LearningProfile = profile ? { ...profile, metricSignals: { ...profile.metricSignals } } : { metricSignals: {} }
  const ms = p.metricSignals!
  const cur: MetricFeedback = { ...ms[metric] }
  if (kind === 'useful') cur.useful = (cur.useful ?? 0) + 1
  else cur.noise = (cur.noise ?? 0) + 1
  ms[metric] = cur
  return p
}

/** Multiplier applied to z-score detection threshold (base ~1.5). Higher = fewer alerts when clinicians dismiss often. */
export function detectionThresholdMultiplier(metric: string, profile: LearningProfile | null | undefined): number {
  const m = profile?.metricSignals?.[metric]
  if (!m) return 1
  const useful = m.useful ?? 0
  const noise = m.noise ?? 0
  const n = noise + useful
  if (n === 0) return 1
  const noiseRatio = noise / n
  return 1 + 0.45 * noiseRatio
}
