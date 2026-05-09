import { parseISO, differenceInCalendarDays } from 'date-fns'
import { METRIC_LABELS } from '@/lib/anomaly'

export type ClinicalEventRow = {
  id: string
  event_type: string
  title: string
  notes: string | null
  occurred_at: string
}

/**
 * Heuristic correlations between timeline events and metric inflection points.
 * Example narrative: "HRV inflection within 48h after medication_change"
 */
export function correlateEventsWithSignals(
  events: ClinicalEventRow[],
  metricSeries: { recorded_at: string; value: number }[],
  metricKey: string,
  maxStatements = 4
): string[] {
  if (!events.length || metricSeries.length < 5) {
    return []
  }

  const sorted = [...metricSeries].sort(
    (a, b) => parseISO(a.recorded_at).getTime() - parseISO(b.recorded_at).getTime()
  )
  const statements: string[] = []

  for (const ev of events) {
    const tEv = parseISO(ev.occurred_at).getTime()
    let bestDropIdx = -1
    let bestDrop = 0
    for (let i = 3; i < sorted.length; i++) {
      const prev = sorted.slice(i - 3, i).reduce((s, x) => s + x.value, 0) / 3
      const cur = sorted[i].value
      const drop = prev - cur
      const daysAfter = differenceInCalendarDays(parseISO(sorted[i].recorded_at), parseISO(ev.occurred_at))
      if (daysAfter >= 0 && daysAfter <= 5 && drop > bestDrop && parseISO(sorted[i].recorded_at).getTime() >= tEv) {
        bestDrop = drop
        bestDropIdx = i
      }
    }
    if (bestDropIdx > 0 && bestDrop > 0.05 * (sorted[bestDropIdx].value || 1)) {
      const label = METRIC_LABELS[metricKey] || metricKey
      statements.push(
        `${label} showed a downward inflection starting ~${differenceInCalendarDays(parseISO(sorted[bestDropIdx].recorded_at), parseISO(ev.occurred_at))} day(s) after “${ev.title}” (${ev.event_type.replace(/_/g, ' ')}).`
      )
    }
  }

  return statements.slice(0, maxStatements)
}
