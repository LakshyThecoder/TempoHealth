import { parseISO, subDays } from 'date-fns'

export type SeverityOrder = 'high' | 'medium' | 'low'

const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

/** One representative anomaly per metric for the period — reduces duplicate alerts. */
export function dedupeByMetric<T extends { metric: string; severity: string; z_score: number; triggered_at: string }>(
  anomalies: T[]
): T[] {
  const sorted = [...anomalies].sort((a, b) => {
    const sr = (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0)
    if (sr !== 0) return sr
    return Math.abs(b.z_score) - Math.abs(a.z_score)
  })
  const seen = new Set<string>()
  const out: T[] = []
  for (const a of sorted) {
    if (seen.has(a.metric)) continue
    seen.add(a.metric)
    out.push(a)
  }
  return out
}

/** Priority score for persistent / severe signals (alert fatigue reduction). */
export function anomalyPriorityScore(a: { severity: string; z_score: number; triggered_at: string }): number {
  const daysSince = (Date.now() - parseISO(a.triggered_at).getTime()) / 864e5
  const recency = Math.exp(-daysSince / 14)
  const sev = RANK[a.severity] ?? 1
  return sev * Math.abs(a.z_score) * (0.5 + 0.5 * recency)
}

/** Top N distinct-metric issues in the last `days` (default week). */
export function topIssuesThisWeek<
  T extends { metric: string; severity: string; z_score: number; triggered_at: string },
>(anomalies: T[], limit = 3, days = 7): T[] {
  const since = subDays(new Date(), days)
  const recent = anomalies.filter(a => parseISO(a.triggered_at) >= since)
  const scored = dedupeByMetric(recent).sort((a, b) => anomalyPriorityScore(b) - anomalyPriorityScore(a))
  return scored.slice(0, limit)
}

/** Group anomalies that share metric + calendar day (noise clustering). */
export function clusterByMetricAndDay<
  T extends { metric: string; triggered_at: string; id: string },
>(anomalies: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const a of anomalies) {
    const d = parseISO(a.triggered_at)
    const key = `${a.metric}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    const arr = map.get(key) ?? []
    arr.push(a)
    map.set(key, arr)
  }
  return map
}

/** Suppress ephemeral spikes: keep strongest per bucket when bucket has 2+ same-day same-metric. */
export function suppressEphemeralDuplicates<
  T extends { metric: string; severity: string; z_score: number; triggered_at: string; id: string },
>(anomalies: T[]): T[] {
  const clusters = clusterByMetricAndDay(anomalies)
  const kept = new Set<string>()
  for (const [, group] of clusters) {
    if (group.length <= 1) {
      kept.add(group[0].id)
      continue
    }
    const best = [...group].sort((a, b) => anomalyPriorityScore(b) - anomalyPriorityScore(a))[0]
    kept.add(best.id)
  }
  return anomalies.filter(a => kept.has(a.id))
}
