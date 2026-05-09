'use client'

import { motion } from 'framer-motion'
import type { ClinicalPatternInsight } from '@/lib/clinical-patterns'

type Props = {
  insight: ClinicalPatternInsight | null
  loading?: boolean
}

const CONF_STYLES = {
  high: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300',
  moderate: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-300',
  low: 'border-slate-600 bg-slate-800/40 text-slate-400',
}

export function ClinicalStoryCard({ insight, loading }: Props) {
  if (loading) {
    return (
      <div className="bento p-6 mb-6 animate-pulse">
        <div className="h-4 w-40 bg-slate-800 rounded mb-4" />
        <div className="h-3 w-full bg-slate-800/80 rounded mb-2" />
        <div className="h-3 w-5/6 bg-slate-800/80 rounded" />
      </div>
    )
  }

  if (!insight) return null

  const conf = CONF_STYLES[insight.confidence]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border mb-6"
      style={{
        borderColor: 'var(--border)',
        background:
          'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(124,58,237,0.04) 45%, rgba(15,23,42,0.9) 100%)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset',
      }}
    >
      <div className="absolute top-0 right-0 w-[380px] h-[380px] pointer-events-none opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle at top right, rgba(99,102,241,0.35), transparent 55%)' }}
      />

      <div className="relative p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--text-3)' }}>
              Longitudinal pattern · vs personal baseline
            </p>
            <h2 className="text-lg lg:text-xl font-bold font-display tracking-tight" style={{ color: 'var(--text)' }}>
              Clinical story
            </h2>
            <p className="text-xs mt-1 max-w-2xl leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {insight.weeklySummaryLine}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border ${conf}`}>
              Insight confidence · {insight.confidence}
            </span>
            <span className="text-[10px] text-right max-w-[220px]" style={{ color: 'var(--text-3)' }}>
              {insight.confidenceReason}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {insight.deltas.slice(0, 8).map(d => (
            <div
              key={d.metric}
              className="rounded-xl px-3 py-2.5 border border-white/[0.06]"
              style={{ background: 'var(--surface)' }}
            >
              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>
                {d.label}
              </p>
              <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                {d.direction === 'stable' ? (
                  <span className="text-slate-400">Stable</span>
                ) : (
                  <>
                    <span style={{ color: d.direction === 'up' ? '#f87171' : '#38bdf8' }}>
                      {d.direction === 'up' ? '↑' : '↓'} {Math.abs(d.pctChange).toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--text-3)' }}>
                      vs your baseline
                    </span>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-blue-300/90">
              What the timeline suggests
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {insight.sustainedNarrative}
            </p>
            <p className="text-[10px] mt-3" style={{ color: 'var(--text-3)' }}>
              Trend window: {insight.trendDurationDays} days with overlapping data · aligned signals:{' '}
              {insight.alignedStressSignals}/4 (explainable rule score, not ML)
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/15 bg-purple-500/[0.04] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-purple-300/90">
              Disease context (non-diagnostic)
            </p>
            <p className="text-sm leading-relaxed text-slate-300">{insight.diseaseContext}</p>
            <p className="text-[10px] mt-3 text-slate-500">
              Not a diagnosis — combine with symptoms, medications, and exam. Wearable data may include derived proxies;
              see row-level audit labels where applicable.
            </p>
          </div>
        </div>

        {insight.monthly && (
          <div className="mt-4 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.05] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-cyan-300/90">
              ~30-day longitudinal summary
            </p>
            <p className="text-sm leading-relaxed text-slate-300">{insight.monthly.narrative}</p>
            <p className="text-[10px] mt-2 text-slate-500">
              Based on ~{insight.monthly.daysWithData} days with data in the last {insight.monthly.windowDays} day window vs stored personal baselines.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
