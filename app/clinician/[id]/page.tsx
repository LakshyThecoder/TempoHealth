'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, subDays, formatDistanceToNow } from 'date-fns'
import { METRIC_LABELS, METRIC_UNITS } from '@/lib/anomaly'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DATASET_PROVENANCE } from '@/lib/metrics'
import { ClinicalStoryCard } from '@/components/ClinicalStoryCard'
import { LongitudinalTimeline } from '@/components/LongitudinalTimeline'
import type { ClinicalPatternInsight } from '@/lib/clinical-patterns'

const AnomalyMetricSparkline = dynamic(() => import('@/components/clinician/AnomalyMetricSparkline'), {
  ssr: false,
  loading: () => <div className="h-20 rounded-xl bg-slate-800/30 animate-pulse mb-5" aria-hidden />,
})

const ClinicianTrendsPanel = dynamic(() => import('@/components/clinician/ClinicianTrendsPanel'), {
  ssr: false,
  loading: () => <div className="min-h-[400px] rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" aria-busy />,
})

const CareTeamPanel = dynamic(() => import('@/components/CareTeamPanel').then(m => m.CareTeamPanel), {
  loading: () => <div className="min-h-[320px] rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" />,
})

/* ─── Types ─── */
interface Patient {
  id: string
  name: string
  age: number
  condition: string
  medications: string[]
  data_source?: string | null
  external_subject_id?: string | null
  display_name?: string | null
  chart_notes?: string | null
  care_status?: string | null
}
interface Anomaly {
  id: string; metric: string; triggered_at: string; z_score: number
  severity: 'low' | 'medium' | 'high'; value: number; baseline_mean: number
  clinical_context: string | null; evidence_snippets: string[] | null; status: string
  clinician_note?: string | null
  reviewed_at?: string | null
}
interface Reading {
  recorded_at: string
  hr: number | null
  hrv_ms: number | null
  spo2: number | null
  steps: number | null
  sleep_duration_min: number | null
  sleep_deep_min?: number | null
  rr: number | null
  skin_temp_delta: number | null
  sedentary_min?: number | null
  very_active_min?: number | null
  calories?: number | null
  metrics_meta?: Record<string, unknown> | null
}

/* ─── Colours ─── */
const SEV = {
  high:   { badge: 'bg-red-500/15 text-red-400 border-red-500/25',   dot: 'bg-red-400',    ring: 'ring-red-500/30',   glow: 'shadow-red-500/20' },
  medium: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25', dot: 'bg-amber-400', ring: 'ring-amber-500/30', glow: 'shadow-amber-500/20' },
  low:    { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',  dot: 'bg-blue-400',   ring: 'ring-blue-500/30',  glow: 'shadow-blue-500/20' },
}

const METRIC_COLORS: Record<string, string> = {
  hr: '#f43f5e', hrv_ms: '#8b5cf6', spo2: '#06b6d4',
  steps: '#10b981', sleep_duration_min: '#3b82f6', sleep_deep_min: '#6366f1', rr: '#f59e0b',
  skin_temp_delta: '#ec4899',
  sedentary_min: '#f97316', very_active_min: '#22c55e', calories: '#eab308',
}

/* ─── Small components ─── */
function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>{children}</span>
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />
}

function MetricBadge({ metric, value, severity }: { metric: string; value: number; severity: Anomaly['severity'] }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${SEV[severity].badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV[severity].dot}`} />
      <span className="text-xs font-medium">{METRIC_LABELS[metric] || metric}</span>
      <span className="text-xs opacity-70">{value.toFixed(1)} {METRIC_UNITS[metric]}</span>
    </div>
  )
}

/* ─── Risk gauge ─── */
function RiskGauge({ score, label }: { score: number; label: string }) {
  const clampedScore = Math.min(100, Math.max(0, score))
  const color = clampedScore > 65 ? '#ef4444' : clampedScore > 40 ? '#f59e0b' : '#10b981'
  const angle = -135 + (clampedScore / 100) * 270

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-20 overflow-hidden">
        <svg viewBox="0 0 120 80" className="w-full h-full">
          {/* Track */}
          <path d="M10,70 A50,50 0 1,1 110,70" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
          {/* Fill */}
          <path d="M10,70 A50,50 0 1,1 110,70" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray="157" strokeDashoffset={157 - (clampedScore / 100) * 157}
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s' }}
          />
          {/* Needle */}
          <g transform={`translate(60,70) rotate(${angle})`}>
            <line x1="0" y1="0" x2="0" y2="-36" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="0" r="4" fill="white" />
          </g>
        </svg>
      </div>
      <div className="text-2xl font-bold text-white -mt-2">{clampedScore}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  )
}

/* ─── Main page ─── */
export default function ClinicianPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)

  const [patient, setPatient] = useState<Patient | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [readings, setReadings] = useState<Reading[]>([])
  const [baselines, setBaselines] = useState<Record<string, { mean: number; std: number }>>({})
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)
  const [tab, setTab] = useState<'anomalies' | 'trends' | 'report' | 'care'>('anomalies')
  const [report, setReport] = useState('')
  const [genReport, setGenReport] = useState(false)
  const [reportType, setReportType] = useState<'previsit' | 'weekly'>('previsit')
  const [selectedMetric, setSelectedMetric] = useState('hrv_ms')
  const [loadingAnomaly, setLoadingAnomaly] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [cohort, setCohort] = useState<{
    cohort_size: number
    percentiles: { steps?: number; sleep_duration_min?: number; sedentary_min?: number } | null
    sedentary_burden_index: string | null
    rhythm_stability: number | null
    cohort_reference?: string
  } | null>(null)
  const [patternInsight, setPatternInsight] = useState<ClinicalPatternInsight | null>(null)
  const [patternLoading, setPatternLoading] = useState(true)
  const [reviewNote, setReviewNote] = useState('')

  useEffect(() => {
    fetch(`/api/patients?id=${patientId}`).then(r => r.json()).then(d => d.patient && setPatient(d.patient))
    fetchAnomalies()
    fetch(`/api/data?patient_id=${patientId}&days=30`).then(r => r.json()).then(d => {
      setReadings(d.readings || [])
      setBaselines(d.baselines || {})
    })
  }, [patientId])

  useEffect(() => {
    if (patient?.data_source !== 'fitbit_kaggle') {
      setCohort(null)
      return
    }
    fetch(`/api/cohort?patient_id=${patientId}&days=21`)
      .then(r => r.json())
      .then(setCohort)
      .catch(() => setCohort(null))
  }, [patientId, patient?.data_source])

  useEffect(() => {
    let cancelled = false
    setPatternLoading(true)
    fetch(`/api/insights?patient_id=${patientId}&days=30`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.insight) setPatternInsight(d.insight)
      })
      .catch(() => {
        if (!cancelled) setPatternInsight(null)
      })
      .finally(() => {
        if (!cancelled) setPatternLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  function fetchAnomalies() {
    fetch(`/api/anomaly?patient_id=${patientId}`).then(r => r.json()).then(d => {
      const all = d.anomalies || []
      setAnomalies(all)
      if (all.length && !selectedAnomaly) setSelectedAnomaly(all[0])
    })
  }

  useEffect(() => {
    setReviewNote(selectedAnomaly?.clinician_note?.trim() ? selectedAnomaly.clinician_note : '')
  }, [selectedAnomaly?.id, selectedAnomaly?.clinician_note])

  async function updateStatus(id: string, status: string) {
    const res = await fetch('/api/anomaly', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status,
        reviewed_by: 'Dr. Clinician',
        clinician_note: reviewNote.trim() || undefined,
      }),
    })
    const d = await res.json()
    const next = d.anomaly as Anomaly | undefined
    if (next) {
      setAnomalies(prev => prev.map(a => (a.id === id ? { ...a, ...next } : a)))
      if (selectedAnomaly?.id === id) setSelectedAnomaly(next)
    } else {
      setAnomalies(prev => prev.map(a => (a.id === id ? { ...a, status } : a)))
      if (selectedAnomaly?.id === id) setSelectedAnomaly(prev => (prev ? { ...prev, status } : prev))
    }
  }

  async function generateReport() {
    setGenReport(true)
    setTab('report')
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, type: reportType }),
    })
    const d = await res.json()
    setReport(d.report?.narrative || 'Generation failed')
    setGenReport(false)
  }

  async function simulateNewReading() {
    setSimulating(true)
    setSimResult(null)
    const res = await fetch('/api/anomaly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId }),
    })
    const d = await res.json()
    setSimResult(`Scanned latest readings: ${d.new_anomalies} new anomaly event(s) detected and contextualised.`)
    fetchAnomalies()
    setSimulating(false)
  }

  /* Derived */
  const filtered = severityFilter === 'all' ? anomalies : anomalies.filter(a => a.severity === severityFilter)
  const highCount = anomalies.filter(a => a.severity === 'high').length
  const pending = anomalies.filter(a => a.status === 'pending').length
  const riskScore = Math.min(100, highCount * 20 + anomalies.filter(a => a.severity === 'medium').length * 8)

  const chartData = readings
    .filter(r => {
      const v = r[selectedMetric as keyof Reading]
      return typeof v === 'number' && !Number.isNaN(v as number)
    })
    .map(r => ({
      date: format(parseISO(r.recorded_at), 'MMM d'),
      value: r[selectedMetric as keyof Reading] as number,
    }))
  const baseline = baselines[selectedMetric]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="kg-accent-bar" aria-hidden />
      {/* ── Top bar ── */}
      <header className="kg-dash-header h-14 sticky top-0 z-30 flex items-center shrink-0">
        <div className="w-full max-w-[1400px] mx-auto px-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 px-2 py-1 rounded-lg transition-colors hover:bg-white/5"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-black"
                style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
              >
                T
              </div>
              <span className="text-sm font-bold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Tempo
                <span
                  style={{
                    background: 'linear-gradient(135deg, #60a5fa, #c084fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Health
                </span>
              </span>
            </Link>
            <div className="w-px h-4 shrink-0" style={{ background: 'var(--border-2)' }} />
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Care hub
            </Link>
            <Link
              href="/practice"
              className="hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Practice CRM
            </Link>
            <div className="w-px h-4 shrink-0 hidden sm:block" style={{ background: 'var(--border-2)' }} />
            <div className="flex min-w-0 items-center gap-2 flex-wrap">
              <span className="section-label text-[11px]">View</span>
              <span style={{ color: 'var(--text-3)' }}>/</span>
              <span className="truncate text-sm" style={{ color: 'var(--text-2)' }}>
                {patient?.name || '...'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {simResult ? (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full"
              >
                {simResult}
              </motion.span>
            ) : null}
            {pending > 0 ? (
              <Pill className="badge badge-red border-0 text-[10px]">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse mr-1.5" />
                {pending} pending
              </Pill>
            ) : null}
            <Pill className="badge text-[10px]">Not diagnostic · clinician-in-the-loop</Pill>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-6">
        {/* ── Patient header card ── */}
        {patient && ((patient.chart_notes && patient.chart_notes.trim()) || patient.care_status) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90 mb-1">From practice roster</p>
            {patient.care_status && patient.care_status !== 'active' && (
              <p className="text-xs text-slate-300 mb-1">
                Workflow status:{' '}
                <span className="font-medium text-white capitalize">{patient.care_status.replace(/_/g, ' ')}</span>
              </p>
            )}
            {patient.chart_notes && patient.chart_notes.trim() && (
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{patient.chart_notes.trim()}</p>
            )}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bento p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '0 4px 20px rgba(124,58,237,0.25)' }}>
                {patient ? patient.name.split(' ').map(n => n[0]).join('') : '??'}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{patient?.name || <Skeleton className="w-40 h-6" />}</h1>
                  {highCount > 0 && (
                    <Pill className="badge badge-red border-0 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full mr-1 animate-pulse bg-red-400" />
                      {highCount} HIGH
                    </Pill>
                  )}

                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                  <span>{patient?.condition}</span>
                  <span className="text-slate-700">·</span>
                  <span>Age {patient?.age}</span>
                  <span className="text-slate-700">·</span>
                  <span>{patient?.medications?.join(' · ')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <RiskGauge score={riskScore} label="Alert Score" />
              <div className="flex flex-col gap-2">
                <button
                  onClick={simulateNewReading}
                  disabled={simulating}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium px-3 py-2 rounded-xl transition-all"
                >
                  <svg className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {simulating ? 'Scanning...' : 'Sync New Data'}
                </button>
                <div className="flex gap-2">
                  <select
                    value={reportType}
                    onChange={e => setReportType(e.target.value as 'previsit' | 'weekly')}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-2"
                  >
                    <option value="previsit">Pre-Visit Brief</option>
                    <option value="weekly">Weekly Report</option>
                  </select>
                  <button
                    onClick={generateReport}
                    disabled={genReport}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-lg shadow-purple-500/20"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {genReport ? 'Generating...' : 'AI Brief'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <ClinicalStoryCard insight={patternInsight} loading={patternLoading} />

        <div className="mb-6">
          <LongitudinalTimeline readings={readings} days={30} />
        </div>

        {patient?.data_source === 'fitbit_kaggle' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bento p-4 mb-6 text-sm" style={{ color: 'var(--text-2)' }}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="badge badge-blue text-[10px]">Real cohort data</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{DATASET_PROVENANCE.license} · {DATASET_PROVENANCE.periodLabel}</span>
            </div>
            <p className="text-xs leading-relaxed mb-2">
              {DATASET_PROVENANCE.name}. SpO₂ and clinical HRV are not in the 2016 export; derived channels are labeled per row in <code className="text-[10px] px-1 rounded bg-white/5">metrics_meta</code>.
            </p>
            {patient.external_subject_id && (
              <p className="text-xs mb-2">Fitabase subject Id: <span className="font-mono">{patient.external_subject_id}</span></p>
            )}
            {cohort && cohort.cohort_size > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-white/10">
                {cohort.percentiles?.steps != null && (
                  <div><span className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>Steps percentile</span><div className="font-bold text-lg gt">{cohort.percentiles.steps}%</div></div>
                )}
                {cohort.percentiles?.sleep_duration_min != null && (
                  <div><span className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>Sleep percentile</span><div className="font-bold text-lg gt">{cohort.percentiles.sleep_duration_min}%</div></div>
                )}
                {cohort.percentiles?.sedentary_min != null && (
                  <div><span className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>Sedentary percentile</span><div className="font-bold text-lg gt">{cohort.percentiles.sedentary_min}%</div></div>
                )}
                {cohort.sedentary_burden_index && (
                  <div><span className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>Sedentary burden</span><div className="font-bold capitalize">{cohort.sedentary_burden_index}</div></div>
                )}
                {cohort.rhythm_stability != null && (
                  <div><span className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>Routine stability</span><div className="font-bold">{cohort.rhythm_stability}/100</div></div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Summary stat row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Alerts', value: anomalies.length, color: 'var(--text)' },
            { label: 'High Severity', value: highCount, color: '#f87171' },
            { label: 'Pending Review', value: pending, color: '#fbbf24' },
            { label: 'Reviewed', value: anomalies.filter(a => a.status === 'reviewed').length, color: '#34d399' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="kg-metric"
            >
              <div className="kg-metric-value font-bold gt" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="kg-metric-label">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="kg-tabs mb-6 w-fit max-w-full">
          {(['anomalies', 'trends', 'report', 'care'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`kg-tab capitalize ${tab === t ? 'kg-tab-active' : ''}`}
            >
              {t === 'report' ? 'AI Brief' : t === 'care' ? 'Care team' : t}
              {t === 'anomalies' && (
                <span
                  className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full border font-semibold tabular-nums"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-2)',
                  }}
                >
                  {anomalies.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════ ANOMALIES TAB ══════════════════════ */}
        {tab === 'anomalies' && (
          <div className="grid grid-cols-5 gap-5">
            {/* Left: list */}
            <div className="col-span-2 space-y-2">
              {/* Filter */}
              <div className="flex gap-2 mb-3">
                {(['all', 'high', 'medium'] as const).map(f => (
                  <button key={f} onClick={() => setSeverityFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium capitalize ${
                      severityFilter === f ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-500 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? `All (${anomalies.length})` : f === 'high' ? `High (${highCount})` : `Medium (${anomalies.filter(a => a.severity === 'medium').length})`}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 p-8 text-center text-slate-500 text-sm">
                    No anomalies found
                  </div>
                ) : (
                  filtered.map((a, i) => (
                    <motion.button
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedAnomaly(a)}
                      className={`w-full text-left rounded-xl border transition-all duration-200 p-4 ${
                        selectedAnomaly?.id === a.id
                          ? `border-slate-600 bg-slate-800/80 ring-1 ${SEV[a.severity].ring}`
                          : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEV[a.severity].dot}`} />
                          <span className="text-sm font-medium text-white">{METRIC_LABELS[a.metric] || a.metric}</span>
                        </div>
                        <Pill className={SEV[a.severity].badge}>{a.severity}</Pill>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-medium">{a.value.toFixed(1)}</span>
                          <span>{METRIC_UNITS[a.metric]}</span>
                          <span className={`font-medium ${Math.abs(a.z_score) >= 2.5 ? 'text-red-400' : 'text-amber-400'}`}>
                            {a.z_score > 0 ? '+' : ''}{a.z_score.toFixed(1)}σ
                          </span>
                        </div>
                        <span>{formatDistanceToNow(parseISO(a.triggered_at), { addSuffix: true })}</span>
                      </div>
                      <div className={`mt-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                        a.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                        a.status === 'reviewed' ? 'bg-green-500/10 text-green-400' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        {a.status}
                      </div>
                    </motion.button>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Right: detail */}
            <div className="col-span-3">
              <AnimatePresence mode="wait">
                {selectedAnomaly ? (
                  <motion.div key={selectedAnomaly.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 h-full"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${SEV[selectedAnomaly.severity].dot}`} />
                          <h2 className="text-xl font-bold text-white font-display tracking-tight">{METRIC_LABELS[selectedAnomaly.metric] || selectedAnomaly.metric}</h2>
                          <Pill className={SEV[selectedAnomaly.severity].badge}>{selectedAnomaly.severity.toUpperCase()}</Pill>
                        </div>
                        <p className="text-sm text-slate-400 ml-5">
                          Detected {format(parseISO(selectedAnomaly.triggered_at), 'EEEE, MMMM d, yyyy')}
                        </p>
                      </div>
                      <div className={`text-xs px-3 py-1 rounded-full border ${
                        selectedAnomaly.status === 'pending' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                        selectedAnomaly.status === 'reviewed' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                        'border-slate-700 bg-slate-800 text-slate-400'
                      }`}>
                        {selectedAnomaly.status}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[
                        { label: 'Observed', value: `${selectedAnomaly.value.toFixed(1)}`, sub: METRIC_UNITS[selectedAnomaly.metric], color: 'text-white', bg: 'bg-slate-800/60' },
                        { label: 'Baseline (30d avg)', value: `${selectedAnomaly.baseline_mean.toFixed(1)}`, sub: METRIC_UNITS[selectedAnomaly.metric], color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/10' },
                        {
                          label: 'Z-Score Deviation',
                          value: `${selectedAnomaly.z_score > 0 ? '+' : ''}${selectedAnomaly.z_score.toFixed(2)}σ`,
                          sub: `${Math.abs(((selectedAnomaly.value - selectedAnomaly.baseline_mean) / selectedAnomaly.baseline_mean) * 100).toFixed(0)}% from baseline`,
                          color: Math.abs(selectedAnomaly.z_score) >= 2.5 ? 'text-red-400' : 'text-amber-400',
                          bg: 'bg-slate-800/60'
                        },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl border border-slate-800 ${s.bg} p-4`}>
                          <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
                          <div className="text-xs text-slate-600 mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {readings.length > 0 && (
                      <AnomalyMetricSparkline
                        readings={readings}
                        metric={selectedAnomaly.metric}
                        baseline={baselines[selectedAnomaly.metric]}
                        metricColor={METRIC_COLORS[selectedAnomaly.metric] || '#3b82f6'}
                        unit={METRIC_UNITS[selectedAnomaly.metric]}
                      />
                    )}

                    {patternInsight && (
                      <div className="mb-4 rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                          Interpretation confidence
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <span className="font-semibold capitalize text-slate-200">{patternInsight.confidence}</span>
                          {' — '}
                          {patternInsight.confidenceReason} Single-flag alerts are weaker evidence than multi-day,
                          multi-signal patterns.
                        </p>
                      </div>
                    )}

                    {/* Clinical context */}
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">AI Clinical Context</h3>
                        <Pill className="border-purple-500/20 bg-purple-500/10 text-purple-400">Mistral Large</Pill>
                      </div>
                      <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-4">
                        <p className="text-sm text-slate-200 leading-relaxed">
                          {selectedAnomaly.clinical_context || 'Clinical context not yet generated. Run anomaly detection to generate.'}
                        </p>
                      </div>
                    </div>

                    {/* Evidence */}
                    {(selectedAnomaly.evidence_snippets?.length ?? 0) > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Evidence Sources</h3>
                        </div>
                        <div className="space-y-2">
                          {selectedAnomaly.evidence_snippets!.slice(0, 2).map((snippet, i) => {
                            const colonIdx = snippet.indexOf(': ')
                            const source = colonIdx > 0 ? snippet.substring(0, colonIdx) : 'Source'
                            const content = colonIdx > 0 ? snippet.substring(colonIdx + 2) : snippet
                            return (
                              <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                                <div className="text-xs font-medium text-blue-400 mb-1">{source}</div>
                                <p className="text-xs text-slate-400 leading-relaxed">{content}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-800 space-y-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          Clinician note (optional audit trail)
                        </label>
                        <textarea
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          rows={3}
                          placeholder="e.g. Discussed with patient — likely viral illness; recheck in 1 week."
                          className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">
                          Saved on review/dismiss. Not shown on the patient app.
                        </p>
                      </div>
                      {selectedAnomaly.reviewed_at && (
                        <p className="text-[10px] text-slate-500">
                          Last workflow action: {format(parseISO(selectedAnomaly.reviewed_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => updateStatus(selectedAnomaly.id, 'reviewed')}
                        disabled={selectedAnomaly.status === 'reviewed'}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-40 border border-green-500/20 text-green-400 text-sm font-medium py-2.5 rounded-xl transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark Reviewed
                      </button>
                      <button
                        onClick={() => updateStatus(selectedAnomaly.id, 'dismissed')}
                        disabled={selectedAnomaly.status === 'dismissed'}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-400 hover:text-white text-sm font-medium py-2.5 rounded-xl transition-all"
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 h-64 flex items-center justify-center text-slate-500 text-sm">
                    Select an anomaly to view details
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ══════════════════════ TRENDS TAB (Recharts lazy-loaded) ══════════════════════ */}
        {tab === 'trends' && (
          <ClinicianTrendsPanel
            selectedMetric={selectedMetric}
            setSelectedMetric={setSelectedMetric}
            chartData={chartData}
            baseline={baseline}
            readings={readings}
            baselines={baselines}
            anomalies={anomalies}
            setSelectedAnomaly={setSelectedAnomaly}
            setTab={setTab}
          />
        )}

        {/* ══════════════════════ AI BRIEF TAB ══════════════════════ */}
        {tab === 'report' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white font-display tracking-tight">
                    {reportType === 'previsit' ? 'Pre-Visit Brief' : 'Weekly Report'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {reportType === 'previsit'
                      ? 'Read before seeing the patient. Generated by Mistral Large with RAG evidence.'
                      : '7-day summary of physiological trends and clinical flags.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill className="border-purple-500/25 bg-purple-500/10 text-purple-400">Mistral Large</Pill>
                  <Pill className="border-blue-500/25 bg-blue-500/10 text-blue-400">RAG-grounded</Pill>
                </div>
              </div>

              {genReport ? (
                <div className="flex flex-col items-center justify-center py-20 gap-5">
                  <div className="relative">
                    <div className="w-12 h-12 border-2 border-purple-500/20 rounded-full" />
                    <div className="absolute inset-0 w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Analysing {anomalies.length} anomalies...</p>
                    <p className="text-sm text-slate-400 mt-1">Generating AI-powered clinical brief</p>
                  </div>
                </div>
              ) : report ? (
                <div>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed bg-slate-800/40 rounded-xl p-6 border border-slate-700/60">
                    {report}
                  </pre>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <p className="text-xs text-slate-600">
                      Clinical decision support only. Does not constitute a diagnosis or treatment recommendation.
                    </p>
                    <button
                      onClick={generateReport}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">No brief generated yet</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {anomalies.length} anomalies ready to summarise
                    </p>
                  </div>
                  <button
                    onClick={generateReport}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-medium px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-500/20"
                  >
                    Generate {reportType === 'previsit' ? 'Pre-Visit Brief' : 'Weekly Report'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'care' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl">
            <p className="text-sm text-slate-400 mb-4">
              Async messaging tied to this chart — patients see the same thread on their TempoHealth view. Use it for visit prep, symptom check-ins, or clarifying wearable alerts.
            </p>
            <CareTeamPanel patientId={patientId} perspective="clinician" pollMs={8000} />
          </motion.div>
        )}
      </div>
    </div>
  )
}
