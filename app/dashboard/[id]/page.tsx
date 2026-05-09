'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ArrowLeft,
  LayoutDashboard,
  MessageSquare,
  FileStack,
  Sparkles,
  ExternalLink,
  Activity,
} from 'lucide-react'
import { usePatientWorkspace } from '@/hooks/usePatientWorkspace'
import { ClinicalStoryCard } from '@/components/ClinicalStoryCard'
import { LongitudinalTimeline } from '@/components/LongitudinalTimeline'

const CareTeamPanel = dynamic(() => import('@/components/CareTeamPanel').then(m => m.CareTeamPanel), {
  loading: () => <div className="min-h-[200px] rounded-xl border border-dashed animate-pulse" style={{ borderColor: 'var(--border)' }} />,
})
const ReportHistory = dynamic(() => import('@/components/ReportHistory').then(m => m.ReportHistory), {
  loading: () => <p className="text-sm py-8" style={{ color: 'var(--text-3)' }}>Loading…</p>,
})
const AiNursePanel = dynamic(() => import('@/components/AiNursePanel').then(m => m.AiNursePanel), {
  loading: () => <div className="min-h-[320px] rounded-xl border border-dashed animate-pulse" style={{ borderColor: 'var(--border)' }} />,
})

type Tab = 'overview' | 'messages' | 'reports' | 'ai-nurse'

function DashboardPatientContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const patientId = params.id as string

  const [tab, setTab] = useState<Tab>('overview')
  const { patient, anomalies, readings, patternInsight, loading } = usePatientWorkspace(patientId)

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'messages' || t === 'reports' || t === 'ai-nurse' || t === 'overview') {
      setTab(t)
    }
  }, [searchParams])

  const highCount = useMemo(() => anomalies.filter(a => a.severity === 'high').length, [anomalies])
  const pending = useMemo(() => anomalies.filter(a => a.status === 'pending').length, [anomalies])

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'reports', label: 'Report history', icon: FileStack },
    { id: 'ai-nurse', label: 'AI Nurse', icon: Sparkles },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <nav className="kg-breadcrumb flex items-center gap-1.5 flex-wrap mb-2">
            <Link href="/dashboard" className="transition-colors hover:text-[var(--kg-accent)]">
              Patients
            </Link>
            <ChevronRight className="w-3 h-3 opacity-45 shrink-0" />
            <span className="truncate" style={{ color: 'var(--text-2)' }}>
              {patient?.name || '…'}
            </span>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border md:hidden"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold font-display truncate" style={{ color: 'var(--text)' }}>
              {loading ? 'Loading…' : patient?.name}
            </h1>
          </div>
          {patient && (
            <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-2)' }}>
              {patient.condition} · Age {patient.age}
            </p>
          )}
        </div>
        <Link
          href={`/clinician/${patientId}`}
          className="inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border transition-colors hover:bg-white/[0.04] shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--kg-accent)' }}
        >
          <Activity className="w-4 h-4" />
          Advanced monitoring
          <ExternalLink className="w-3 h-3 opacity-70" />
        </Link>
      </div>

      <div className="kg-tabs mb-8 w-full flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`kg-tab inline-flex items-center gap-2 ${tab === id ? 'kg-tab-active' : ''}`}
          >
            <Icon className="w-3.5 h-3.5 opacity-80" />
            {label}
            {id === 'messages' && patient ? (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full border font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-3)' }}
              >
                Live
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: 'Open alerts', value: anomalies.length, color: 'var(--text)' },
              { label: 'High severity', value: highCount, color: '#f87171' },
              { label: 'Pending review', value: pending, color: '#fbbf24' },
            ].map(s => (
              <div key={s.label} className="kg-metric">
                <div className="kg-metric-value font-bold" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="kg-metric-label">{s.label}</div>
              </div>
            ))}
          </div>

          <ClinicalStoryCard insight={patternInsight} loading={loading} />
          <LongitudinalTimeline readings={readings} days={30} />

          <div className="kg-panel p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                Full clinical workstation
              </p>
              <p className="text-xs max-w-xl leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Review every anomaly with z-scores, trend charts, AI context, cohort comparison, and care-team messaging
                in the advanced view.
              </p>
            </div>
            <Link href={`/clinician/${patientId}`} className="kg-btn-primary inline-flex items-center gap-2 shrink-0">
              Open monitoring
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.div>
      )}

      {tab === 'messages' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {!patient ? (
            <p className="text-sm py-12 text-center" style={{ color: 'var(--text-3)' }}>
              {loading ? 'Loading patient…' : 'Patient not found.'}
            </p>
          ) : (
            <>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Thread shared with the patient-facing app for this account.
              </p>
              <CareTeamPanel patientId={patientId} perspective="clinician" pollMs={8000} />
            </>
          )}
        </motion.div>
      )}

      {tab === 'reports' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
            Saved AI briefs from clinical monitoring, newest first.
          </p>
          <ReportHistory patientId={patientId} />
        </motion.div>
      )}

      {tab === 'ai-nurse' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {!patient ? (
            <p className="text-sm py-12 text-center" style={{ color: 'var(--text-3)' }}>
              {loading ? 'Loading patient…' : 'Patient not found.'}
            </p>
          ) : (
            <AiNursePanel patientId={patientId} patientName={patient.name} />
          )}
        </motion.div>
      )}
    </div>
  )
}

export default function DashboardPatientPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-sm text-center" style={{ color: 'var(--text-3)' }}>
          Loading patient record…
        </div>
      }
    >
      <DashboardPatientContent />
    </Suspense>
  )
}
