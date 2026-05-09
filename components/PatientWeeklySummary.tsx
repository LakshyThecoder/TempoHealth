'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ClinicalPatternInsight } from '@/lib/clinical-patterns'

type Props = {
  patientId: string
}

/** Plain-language weekly + monthly snapshot for the patient view (non-diagnostic). */
export function PatientWeeklySummary({ patientId }: Props) {
  const [insight, setInsight] = useState<ClinicalPatternInsight | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let c = false
    setLoading(true)
    fetch(`/api/insights?patient_id=${patientId}&days=90`)
      .then(r => r.json())
      .then(d => {
        if (!c && d.insight) setInsight(d.insight)
      })
      .finally(() => {
        if (!c) setLoading(false)
      })
    return () => {
      c = true
    }
  }, [patientId])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 animate-pulse">
        <div className="h-4 w-48 bg-slate-800 rounded mb-3" />
        <div className="h-3 w-full bg-slate-800/80 rounded" />
      </div>
    )
  }

  if (!insight) return null

  const confLabel =
    insight.confidence === 'high' ? 'Higher confidence' : insight.confidence === 'moderate' ? 'Moderate confidence' : 'Lower confidence'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] to-slate-900/50"
    >
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">Your week at a glance</p>
          <h3 className="text-base font-bold text-white mt-1">Compared with your usual pattern</h3>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700 shrink-0">
          {confLabel}
        </span>
      </div>
      <div className="p-5 space-y-4">
        <ul className="space-y-2">
          {insight.deltas.slice(0, 6).map(d => (
            <li key={d.metric} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-400/80" />
              <span>
                <span className="font-medium text-white">{d.label}</span>
                {d.direction === 'stable' ? (
                  <> — close to your usual average.</>
                ) : (
                  <>
                    {' '}
                    — about{' '}
                    <strong className="text-white">{Math.abs(d.pctChange).toFixed(0)}%</strong>{' '}
                    {d.direction === 'up' ? 'above' : 'below'} what we use as <em>your</em> baseline (not a generic rule).
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>

        {insight.monthly && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Broader picture (~30 days)</p>
            <p className="text-xs text-slate-400 leading-relaxed">{insight.monthly.narrative}</p>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-slate-500">
          Trend length referenced in clinician tools: about <strong className="text-slate-400">{insight.trendDurationDays} days</strong> with
          overlapping data. This summary is for awareness — not a diagnosis. Share symptoms or concerns with your care team.
        </p>
      </div>
    </motion.div>
  )
}
