'use client'

import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { METRIC_LABELS, METRIC_UNITS } from '@/lib/anomaly'

const SEV = {
  high: { badge: 'bg-red-500/15 text-red-400 border-red-500/25' },
  medium: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  low: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
} as const

const METRIC_COLORS: Record<string, string> = {
  hr: '#f43f5e',
  hrv_ms: '#8b5cf6',
  spo2: '#06b6d4',
  steps: '#10b981',
  sleep_duration_min: '#3b82f6',
  sleep_deep_min: '#6366f1',
  rr: '#f59e0b',
  skin_temp_delta: '#ec4899',
  sedentary_min: '#f97316',
  very_active_min: '#22c55e',
  calories: '#eab308',
}

const METRICS_LIST = [
  'hr',
  'hrv_ms',
  'spo2',
  'steps',
  'sleep_duration_min',
  'sleep_deep_min',
  'sedentary_min',
  'very_active_min',
  'calories',
  'rr',
  'skin_temp_delta',
] as const

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">
        {payload[0].value?.toFixed(1)} {unit}
      </p>
    </div>
  )
}

interface Reading {
  recorded_at: string
  hr: number | null
  hrv_ms: number | null
  spo2: number | null
  steps: number | null
  sleep_duration_min: number | null
  sleep_deep_min: number | null
  rr: number | null
  skin_temp_delta: number | null
  sedentary_min: number | null
  very_active_min: number | null
  calories: number | null
}

interface Anomaly {
  id: string
  metric: string
  severity: 'low' | 'medium' | 'high'
  triggered_at: string
  value: number
  z_score: number
}

type Tab = 'anomalies' | 'trends' | 'report' | 'care'

export type ClinicianTrendsPanelProps = {
  selectedMetric: string
  setSelectedMetric: (m: string) => void
  chartData: { date: string; value: number }[]
  baseline: { mean: number; std: number } | undefined
  readings: Reading[]
  baselines: Record<string, { mean: number; std: number }>
  anomalies: Anomaly[]
  setSelectedAnomaly: (a: Anomaly) => void
  setTab: (t: Tab) => void
}

/** Code-split: loads with next/dynamic so Recharts is not on the main clinician chunk until Trends is opened. */
export default function ClinicianTrendsPanel({
  selectedMetric,
  setSelectedMetric,
  chartData,
  baseline,
  readings,
  baselines,
  anomalies,
  setSelectedAnomaly,
  setTab,
}: ClinicianTrendsPanelProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {METRICS_LIST.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setSelectedMetric(m)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
              selectedMetric === m
                ? 'text-white border-slate-600 bg-slate-700 shadow-sm'
                : 'border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: METRIC_COLORS[m] || '#3b82f6' }} />
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white font-display tracking-tight">{METRIC_LABELS[selectedMetric]}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Personal baseline:{' '}
              {baseline ? `${baseline.mean.toFixed(1)} ± ${baseline.std.toFixed(1)} ${METRIC_UNITS[selectedMetric]}` : '—'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 rounded inline-block" style={{ background: METRIC_COLORS[selectedMetric] || '#3b82f6' }} />
              Readings
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 bg-slate-600 inline-block border-dashed border-t" />
              Baseline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 bg-red-500/30 inline-block" />
              ±2σ threshold
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={METRIC_COLORS[selectedMetric] || '#3b82f6'} stopOpacity={0.2} />
                <stop offset="95%" stopColor={METRIC_COLORS[selectedMetric] || '#3b82f6'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
            <Tooltip content={<ChartTooltip unit={METRIC_UNITS[selectedMetric]} />} />
            {baseline && (
              <>
                <ReferenceLine
                  y={baseline.mean}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  label={{ value: 'baseline', fill: '#475569', fontSize: 10, position: 'insideTopRight' }}
                />
                <ReferenceLine y={baseline.mean + 2 * baseline.std} stroke="#ef444450" strokeDasharray="2 4" />
                <ReferenceLine y={Math.max(0, baseline.mean - 2 * baseline.std)} stroke="#ef444450" strokeDasharray="2 4" />
              </>
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={METRIC_COLORS[selectedMetric] || '#3b82f6'}
              strokeWidth={2}
              fill="url(#mainGrad)"
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 0,
                fill: METRIC_COLORS[selectedMetric] || '#3b82f6',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {anomalies.filter(a => a.metric === selectedMetric).length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-2 font-medium">Flagged anomalies in this metric:</p>
            <div className="flex gap-2 flex-wrap">
              {anomalies
                .filter(a => a.metric === selectedMetric)
                .map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAnomaly(a)
                      setTab('anomalies')
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all hover:scale-105 ${SEV[a.severity].badge}`}
                  >
                    {format(parseISO(a.triggered_at), 'MMM d')} · {a.value.toFixed(1)} {METRIC_UNITS[a.metric]} (
                    {a.z_score > 0 ? '+' : ''}
                    {a.z_score.toFixed(1)}σ)
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {METRICS_LIST.filter(m => m !== selectedMetric).map(m => {
          const data = readings
            .map(r => ({ v: r[m as keyof Reading] }))
            .filter(d => typeof d.v === 'number' && !Number.isNaN(d.v as number))
          const bl = baselines[m]
          return (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMetric(m)}
              className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 p-4 text-left transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">{METRIC_LABELS[m]}</span>
                <span className="text-xs text-slate-500">{bl ? bl.mean.toFixed(0) : '—'} {METRIC_UNITS[m]}</span>
              </div>
              <ResponsiveContainer width="100%" height={48}>
                <LineChart data={data}>
                  <Line type="monotone" dataKey="v" stroke={METRIC_COLORS[m] || '#3b82f6'} strokeWidth={1.5} dot={false} />
                  {bl && <ReferenceLine y={bl.mean} stroke="#334155" strokeDasharray="2 2" />}
                </LineChart>
              </ResponsiveContainer>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
