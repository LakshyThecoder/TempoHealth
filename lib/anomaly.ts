export type Severity = 'low' | 'medium' | 'high'

export interface MetricReading {
  metric: string
  value: number
  mean: number
  std: number
}

export function computeZScore(value: number, mean: number, std: number): number {
  if (std === 0) return 0
  return (value - mean) / std
}

export function getSeverity(zScore: number): Severity {
  const abs = Math.abs(zScore)
  if (abs >= 2.5) return 'high'
  if (abs >= 2.0) return 'medium'
  return 'low'
}

export interface AnomalyResult {
  metric: string
  value: number
  zScore: number
  severity: Severity
  baselineMean: number
  direction: 'above' | 'below'
  isAnomaly: boolean
}

export function detectAnomalies(readings: MetricReading[], threshold = 1.5): AnomalyResult[] {
  const results: AnomalyResult[] = []
  for (const r of readings) {
    const z = computeZScore(r.value, r.mean, r.std)
    const isAnomaly = Math.abs(z) >= threshold
    results.push({
      metric: r.metric,
      value: r.value,
      zScore: z,
      severity: getSeverity(z),
      baselineMean: r.mean,
      direction: z > 0 ? 'above' : 'below',
      isAnomaly,
    })
  }
  return results
}

// Multi-signal boost: if 3+ metrics deviate together, escalate all to at least 'medium'
export function applyMultiSignalBoost(anomalies: AnomalyResult[]): AnomalyResult[] {
  const flagged = anomalies.filter(a => a.isAnomaly)
  if (flagged.length >= 3) {
    return anomalies.map(a => {
      if (a.isAnomaly && a.severity === 'low') {
        return { ...a, severity: 'medium' as Severity }
      }
      return a
    })
  }
  return anomalies
}

export const METRIC_LABELS: Record<string, string> = {
  hr: 'Heart Rate',
  hrv_ms: 'HRV',
  spo2: 'SpO₂',
  steps: 'Daily Steps',
  sleep_duration_min: 'Sleep Duration',
  sleep_deep_min: 'Deep Sleep',
  rr: 'Respiratory Rate',
  skin_temp_delta: 'Skin Temperature Δ',
  sedentary_min: 'Sedentary Time',
  very_active_min: 'Very Active Minutes',
  calories: 'Calories',
}

export const METRIC_UNITS: Record<string, string> = {
  hr: 'bpm',
  hrv_ms: 'ms',
  spo2: '%',
  steps: 'steps',
  sleep_duration_min: 'min',
  sleep_deep_min: 'min',
  rr: 'br/min',
  skin_temp_delta: '°C',
  sedentary_min: 'min',
  very_active_min: 'min',
  calories: 'kcal',
}
