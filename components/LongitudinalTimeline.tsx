'use client'

import { format, parseISO } from 'date-fns'
import { METRIC_LABELS } from '@/lib/anomaly'

type Row = {
  recorded_at: string
  hr?: number | null
  sleep_duration_min?: number | null
  steps?: number | null
}

type Props = {
  readings: Row[]
  days?: number
}

function normSeries(vals: number[]): number[] {
  if (!vals.length) return vals
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || 1
  return vals.map(v => (v - lo) / span)
}

function SparkRow({
  label,
  color,
  bars,
  dates,
}: {
  label: string
  color: string
  bars: number[]
  dates: string[]
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {label}
        </span>
        <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-3)' }}>
          {dates[0]} → {dates[dates.length - 1]}
        </span>
      </div>
      <div className="flex items-end gap-px h-14 rounded-lg overflow-hidden border border-white/[0.06]" style={{ background: 'var(--surface)' }}>
        {bars.map((h, i) => (
          <div
            key={i}
            title={dates[i]}
            className="flex-1 min-w-[2px] rounded-t-[1px] transition-all"
            style={{
              height: `${Math.max(8, h * 100)}%`,
              background: `linear-gradient(180deg, ${color}, ${color}55)`,
              opacity: 0.35 + h * 0.65,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** Apple-health-style density strip: last N daily buckets for HR, sleep, steps. */
export function LongitudinalTimeline({ readings, days = 30 }: Props) {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  )
  const slice = sorted.slice(-days)

  if (slice.length < 3) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/30 px-4 py-3 text-xs text-slate-500">
        Add more daily wearable rows to unlock the longitudinal timeline.
      </div>
    )
  }

  const dates = slice.map(r => format(parseISO(r.recorded_at), 'MMM d'))
  const hr = slice.map(r => (typeof r.hr === 'number' ? r.hr : NaN))
  const sleepH = slice.map(r =>
    typeof r.sleep_duration_min === 'number' ? r.sleep_duration_min / 60 : NaN
  )
  const steps = slice.map(r => (typeof r.steps === 'number' ? r.steps : NaN))

  const fillMean = (arr: number[], fallback: number) => {
    const valid = arr.filter(x => !Number.isNaN(x))
    const m = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : fallback
    return arr.map(x => (Number.isNaN(x) ? m : x))
  }

  const hrF = fillMean(hr, 72)
  const slF = fillMean(sleepH, 7)
  const stF = fillMean(steps, 6000)

  return (
    <div className="kg-panel rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
            Longitudinal timeline
          </p>
          <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text)' }}>
            Last {slice.length} days · vs your baseline in charts above
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
          Daily rhythm strip
        </span>
      </div>
      <div className="p-5 space-y-5">
        <SparkRow label={METRIC_LABELS.hr} color="#f43f5e" bars={normSeries(hrF)} dates={dates} />
        <SparkRow label="Sleep (hours)" color="#3b82f6" bars={normSeries(slF)} dates={dates} />
        <SparkRow label={METRIC_LABELS.steps} color="#10b981" bars={normSeries(stF)} dates={dates} />
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
          Bars show relative day-to-day variation (normalized within this window). Use the Trends tab for absolute scales and baseline bands.
        </p>
      </div>
    </div>
  )
}
