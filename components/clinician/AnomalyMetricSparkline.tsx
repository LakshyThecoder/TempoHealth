'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'

type Props = {
  /** Wearable rows — metric column read by string key (matches clinician `Reading`). */
  readings: ReadonlyArray<{ recorded_at: string }>
  metric: string
  baseline: { mean: number; std: number } | undefined
  metricColor: string
  unit: string
}

/** Lazy-loaded with next/dynamic — keeps Recharts off the main clinician bundle until needed. */
export default function AnomalyMetricSparkline({ readings, metric, baseline, metricColor, unit }: Props) {
  const stroke = metricColor || '#3b82f6'
  const data = readings.map(r => {
    const row = r as Record<string, unknown>
    return {
      date: format(parseISO(r.recorded_at), 'MMM d'),
      value: row[metric] as number,
    }
  })

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 font-medium">30-day trend</span>
        {baseline && (
          <span className="text-xs text-slate-500">
            Baseline: {baseline.mean.toFixed(1)} ± {baseline.std.toFixed(1)} {unit}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={stroke} stopOpacity={0.2} />
              <stop offset="95%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={6} />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
          {baseline && <ReferenceLine y={baseline.mean} stroke="#475569" strokeDasharray="3 3" />}
          {baseline && <ReferenceLine y={baseline.mean + 2 * baseline.std} stroke="#ef444440" strokeDasharray="2 2" />}
          {baseline && <ReferenceLine y={baseline.mean - 2 * baseline.std} stroke="#ef444440" strokeDasharray="2 2" />}
          <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={1.5} fill="url(#gA)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
