'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { METRIC_LABELS, METRIC_UNITS } from '@/lib/anomaly'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DATASET_PROVENANCE } from '@/lib/metrics'
import { CareTeamPanel } from '@/components/CareTeamPanel'
import { FollowUpIntake } from '@/components/FollowUpIntake'
import { PatientWeeklySummary } from '@/components/PatientWeeklySummary'

interface Anomaly {
  id: string; metric: string; severity: 'low' | 'medium' | 'high'
  value: number; baseline_mean: number; triggered_at: string
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
  sedentary_min?: number | null
  very_active_min?: number | null
  calories?: number | null
  metrics_meta?: Record<string, unknown> | null
}

const PATIENT_BLURB: Record<string, Record<string, string>> = {
  above: {
    hr: 'Your recent heart rate is a little higher than your usual pattern — worth mentioning if you also feel unwell.',
    hrv_ms: 'Your recovery rhythm signal looks higher than your usual — sometimes this follows heavy training or stress.',
    spo2: 'This oxygen reading is slightly above your usual; context matters if you have lung symptoms.',
    steps: 'You\'ve been moving a bit more than your usual week — nice momentum.',
    sleep_duration_min: 'You\'ve been sleeping a bit longer than your usual — could be recovery or schedule change.',
    rr: 'Your breathing rate looks slightly elevated compared with your baseline — exertion and illness can do this.',
    sedentary_min: 'There\'s been more quiet time than your usual — short walks can break it up.',
    default: 'This is a little above your personal usual — not a diagnosis on its own.',
  },
  below: {
    hr: 'Your resting heart rate looks a bit lower than your usual — sometimes normal, sometimes worth a mention.',
    hrv_ms: 'Your recovery rhythm signal is lower than your usual — rest and stress can both affect this.',
    spo2: 'This oxygen reading is slightly below your usual; seek care if you feel short of breath.',
    steps: 'Movement has been lighter than your usual week — gentle activity helps when you\'re ready.',
    sleep_duration_min: 'Sleep has been a bit shorter than your usual — prioritize wind-down when you can.',
    rr: 'Your breathing rate is a bit lower than usual — connect with your team if something feels off.',
    sedentary_min: 'Less sedentary time than usual — great job staying up and moving.',
    default: 'This is a little below your personal usual — your care team can help interpret it.',
  },
}

const METRIC_COLORS: Record<string, string> = {
  hr: '#f43f5e', hrv_ms: '#8b5cf6', spo2: '#06b6d4',
  steps: '#10b981', sleep_duration_min: '#3b82f6', rr: '#f59e0b',
}

function HealthRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label = score >= 75 ? 'On track' : score >= 50 ? 'Worth monitoring' : 'Let\'s review'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s ease, stroke 0.5s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{score}</span>
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </div>
    </div>
  )
}

function MetricCard({ metric, readings, baseline }: {
  metric: string
  readings: Reading[]
  baseline?: { mean: number; std: number }
}) {
  const [expanded, setExpanded] = useState(false)
  const data = readings
    .map(r => {
      const v = r[metric as keyof Reading]
      if (typeof v !== 'number' || Number.isNaN(v)) return null
      return { date: format(parseISO(r.recorded_at), 'MMM d'), v }
    })
    .filter((d): d is { date: string; v: number } => d != null)
  const latest = data[data.length - 1]?.v
  const color = METRIC_COLORS[metric] || '#3b82f6'
  const deviation = baseline && latest ? ((latest - baseline.mean) / baseline.mean) * 100 : null

  return (
    <motion.div
      layout
      className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 text-left flex items-center justify-between hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{METRIC_LABELS[metric] || metric}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {latest ? `${latest.toFixed(1)} ${METRIC_UNITS[metric]}` : '—'}
              {baseline && <span className="ml-2 text-slate-600">usual: {baseline.mean.toFixed(0)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {deviation !== null && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              Math.abs(deviation) < 10 ? 'text-green-400 bg-green-500/10' :
              Math.abs(deviation) < 25 ? 'text-amber-400 bg-amber-500/10' :
              'text-red-400 bg-red-500/10'
            }`}>
              {deviation > 0 ? '+' : ''}{deviation.toFixed(0)}%
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-800"
          >
            <div className="p-5 pt-4">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id={`pg-${metric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={7} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v) => v != null ? [`${Number(v).toFixed(1)} ${METRIC_UNITS[metric]}`, METRIC_LABELS[metric]] : ['—', '']}
                  />
                  {baseline && <ReferenceLine y={baseline.mean} stroke="#334155" strokeDasharray="3 3" />}
                  <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#pg-${metric})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              {baseline && (
                <p className="text-xs text-slate-500 mt-3">
                  Your personal baseline is {baseline.mean.toFixed(0)} {METRIC_UNITS[metric]}. Readings within the shaded zone are within your normal range.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const [patient, setPatient] = useState<{
    name: string
    condition: string
    age: number
    data_source?: string | null
    external_subject_id?: string | null
  } | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [readings, setReadings] = useState<Reading[]>([])
  const [baselines, setBaselines] = useState<Record<string, { mean: number; std: number }>>({})
  const [activeSection, setActiveSection] = useState<'overview' | 'trends' | 'care'>('overview')
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setPageStatus('loading')

    ;(async () => {
      try {
        const pr = await fetch(`/api/patients?id=${patientId}`)
        const pj = await pr.json()
        if (cancelled) return
        if (pr.status === 404 || !pj.patient) {
          setPageStatus('missing')
          return
        }
        if (!pr.ok) {
          setPageStatus('error')
          return
        }
        setPatient(pj.patient)

        const [ar, dr] = await Promise.all([
          fetch(`/api/anomaly?patient_id=${patientId}`),
          fetch(`/api/data?patient_id=${patientId}&days=30`),
        ])
        const aj = await ar.json()
        const dj = await dr.json()
        if (cancelled) return
        if (ar.ok) {
          setAnomalies((aj.anomalies || []).filter((a: Anomaly) => a.severity !== 'low').slice(0, 4))
        }
        if (dr.ok) {
          setReadings(dj.readings || [])
          setBaselines(dj.baselines || {})
        }
        setPageStatus('ready')
      } catch {
        if (!cancelled) setPageStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [patientId])

  const highCount = anomalies.filter(a => a.severity === 'high').length
  const score = Math.max(0, 100 - highCount * 20 - anomalies.filter(a => a.severity === 'medium').length * 10)

  const status = score >= 75 ? 'good' : score >= 50 ? 'watch' : 'attention'
  const statusMsg = {
    good: {
      title: 'Mostly aligned with your usual',
      sub: 'Compared with your own baseline, today\'s snapshot looks familiar. Keep doing what works for you.',
      color: 'text-green-400',
      bg: 'border-green-500/20 bg-green-500/5',
    },
    watch: {
      title: 'A few gentle shifts',
      sub: 'Some signals drifted from your personal usual. That can happen with stress, sleep, or illness — mention it at your next check-in if it persists.',
      color: 'text-amber-400',
      bg: 'border-amber-500/20 bg-amber-500/5',
    },
    attention: {
      title: 'Patterns changed more than usual',
      sub: 'A few metrics moved farther from your baseline. This is not a diagnosis — share how you feel with your care team.',
      color: 'text-orange-400',
      bg: 'border-orange-500/20 bg-orange-500/5',
    },
  }[status]

  const latestReading = readings[readings.length - 1]

  const quickStats = latestReading ? [
    { label: 'Heart Rate', value: latestReading.hr?.toFixed(0), unit: 'bpm', color: METRIC_COLORS.hr, icon: '♥' },
    { label: 'HRV', value: latestReading.hrv_ms?.toFixed(0), unit: 'ms', color: METRIC_COLORS.hrv_ms, icon: '〰' },
    { label: 'SpO₂', value: latestReading.spo2?.toFixed(1), unit: '%', color: METRIC_COLORS.spo2, icon: '○' },
    { label: 'Steps', value: latestReading.steps?.toLocaleString(), unit: 'today', color: METRIC_COLORS.steps, icon: '↑' },
  ] : []

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-green-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 card rounded-none h-14 flex items-center"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto w-full px-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors hover:bg-white/5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-black"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>T</div>
            <span className="text-sm font-bold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Tempo<span style={{ background: 'linear-gradient(135deg, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Health</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="badge text-[10px] hidden sm:flex">My Health</span>
          </div>
        </div>
      </header>

      <div className="relative max-w-2xl mx-auto px-5 py-8 space-y-6">
        {pageStatus === 'loading' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
            <div className="inline-block w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-400">Loading your health snapshot…</p>
          </div>
        )}

        {pageStatus === 'missing' && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-amber-400">Patient not found</p>
            <p className="text-xs text-slate-400">This patient ID was not found. Check the link or return to the dashboard.</p>
            <Link href="/" className="inline-block text-xs font-semibold text-blue-400 hover:text-blue-300">← Back home</Link>
          </div>
        )}

        {pageStatus === 'error' && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-red-400">Could not load data</p>
            <p className="text-xs text-slate-400">Check your connection and Supabase configuration, then refresh the page.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              Retry
            </button>
          </div>
        )}

        {patient?.data_source === 'fitbit_kaggle' && pageStatus === 'ready' && (
          <div className="bento p-4 text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
            <span className="badge badge-blue text-[10px] mb-2 inline-block">Real cohort data</span>
            <p>
              {DATASET_PROVENANCE.name} ({DATASET_PROVENANCE.license}). Some values are derived from 2016 Fitbit exports
              (see <code className="text-[10px]">metrics_meta</code> in your records). This is not a medical device.
            </p>
          </div>
        )}

        {/* Greeting + health ring */}
        {pageStatus === 'ready' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Good day, {patient?.name?.split(' ')[0] || '...'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Your 30-day health snapshot</p>
          </div>
          <HealthRing score={score} size={100} />
        </motion.div>
        )}

        {/* Status card */}
        {pageStatus === 'ready' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className={`rounded-2xl border p-5 ${statusMsg.bg}`}
        >
          <div className="flex gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
              status === 'good' ? 'bg-green-400' : status === 'watch' ? 'bg-amber-400 animate-pulse' : 'bg-orange-400 animate-pulse'
            }`} />
            <div>
              <h2 className={`text-base font-semibold ${statusMsg.color}`}>{statusMsg.title}</h2>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">{statusMsg.sub}</p>
              {status !== 'good' && (
                <p className="text-xs text-slate-500 mt-2">
                  This is informational only — your care team reviews these trends.
                </p>
              )}
            </div>
          </div>
        </motion.div>
        )}

        {pageStatus === 'ready' && (
          <FollowUpIntake patientId={patientId} />
        )}

        {pageStatus === 'ready' && <PatientWeeklySummary patientId={patientId} />}

        {/* Quick stat grid */}
        {pageStatus === 'ready' && quickStats.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="grid grid-cols-4 gap-3"
          >
            {quickStats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.05 }}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center"
              >
                <div className="text-xl mb-1" style={{ color: s.color }}>{s.icon}</div>
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-slate-500">{s.unit}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* What changed section */}
        {pageStatus === 'ready' && anomalies.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <h2 className="text-base font-semibold text-white mb-3">What changed</h2>
            <div className="space-y-3">
              {anomalies.map((a, i) => {
                const direction = a.value > a.baseline_mean ? 'above' : 'below'
                const desc = PATIENT_BLURB[direction][a.metric] || PATIENT_BLURB[direction].default
                const pct = Math.abs(((a.value - a.baseline_mean) / a.baseline_mean) * 100)
                const color = METRIC_COLORS[a.metric] || '#3b82f6'
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.05 }}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{METRIC_LABELS[a.metric] || a.metric}</div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-white">{a.value.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">{METRIC_UNITS[a.metric]}</div>
                        <div className={`text-xs mt-0.5 font-medium ${pct > 20 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {direction === 'above' ? '+' : '-'}{pct.toFixed(0)}% from usual
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Section tabs */}
        {pageStatus === 'ready' && (
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit flex-wrap">
          {(['overview', 'trends', 'care'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                activeSection === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {s === 'overview' ? 'Key Metrics' : s === 'trends' ? 'All Trends' : 'Care team'}
            </button>
          ))}
        </div>
        )}

        {pageStatus === 'ready' && activeSection === 'care' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <p className="text-xs text-slate-500 leading-relaxed">
              Messages here are visible to your clinic team on their TempoHealth dashboard — useful before visits or when something feels off.
            </p>
            <CareTeamPanel patientId={patientId} perspective="patient" pollMs={8000} />
          </motion.div>
        )}

        {/* Key metrics — expandable cards */}
        {pageStatus === 'ready' && activeSection === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {['hr', 'hrv_ms', 'spo2'].map(m => (
              <MetricCard key={m} metric={m} readings={readings} baseline={baselines[m]} />
            ))}
          </motion.div>
        )}

        {pageStatus === 'ready' && activeSection === 'trends' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {['hr', 'hrv_ms', 'spo2', 'steps', 'sleep_duration_min', 'rr'].map(m => (
              <MetricCard key={m} metric={m} readings={readings} baseline={baselines[m]} />
            ))}
          </motion.div>
        )}

        {/* Sleep summary */}
        {pageStatus === 'ready' && activeSection !== 'care' && readings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <h3 className="text-sm font-semibold text-white mb-4 font-display tracking-tight">Sleep (last 7 nights)</h3>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={readings.slice(-7).map(r => ({
                date: format(parseISO(r.recorded_at), 'EEE'),
                total: Math.round(((r.sleep_duration_min ?? 0) / 60) * 10) / 10,
                deep: Math.round(((r.sleep_deep_min ?? 0) / 60) * 10) / 10,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={25} unit="h" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(v) => v != null ? [`${Number(v).toFixed(1)}h`, ''] : ['—', '']}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={1.5} fill="#3b82f610" dot={false} name="Total sleep" />
                <Area type="monotone" dataKey="deep" stroke="#8b5cf6" strokeWidth={1.5} fill="#8b5cf610" dot={false} name="Deep sleep" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Disclaimer */}
        {pageStatus === 'ready' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5"
        >
          <h3 className="text-sm font-medium text-slate-300 mb-2">About your health summary</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            TempoHealth compares your readings to <strong className="text-slate-400">your own usual pattern</strong>, not generic thresholds.
            Words like “above usual” describe distance from <em>your</em> baseline — not a disease label.{' '}
            <strong className="text-slate-400">This screen does not diagnose or treat.</strong>{' '}
            Use emergency services for urgent symptoms; otherwise discuss trends with your clinician.
          </p>
        </motion.div>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  )
}
