'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { Search, ChevronRight, LayoutDashboard, MessageSquare, Sparkles, Activity } from 'lucide-react'
import type { PracticeRosterRow } from '@/lib/practice-roster'
import { CARE_STATUS_OPTIONS, type CareStatusValue } from '@/lib/care-status'

export default function DashboardPatientsPage() {
  const [roster, setRoster] = useState<PracticeRosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CareStatusValue>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/practice')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else {
          setError(null)
          setRoster(d.roster || [])
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load patients')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let rows = roster
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.condition.toLowerCase().includes(q) ||
          (r.external_subject_id && r.external_subject_id.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== 'all') {
      rows = rows.filter(r => (r.care_status || 'active') === statusFilter)
    }
    return rows
  }, [roster, query, statusFilter])

  const initials = (name: string) =>
    name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <nav className="kg-breadcrumb flex items-center gap-1.5 mb-4">
          <span style={{ color: 'var(--text-3)' }}>Care hub</span>
          <ChevronRight className="w-3 h-3 opacity-45" />
          <span style={{ color: 'var(--text-2)' }}>Patients</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mb-2" style={{ color: 'var(--text)' }}>
          Patient roster
        </h1>
        <p className="text-sm max-w-2xl leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Open a patient to review summaries, messages, saved reports, AI Nurse, and advanced monitoring.
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
        <div className="kg-search-wrap w-full lg:flex-1 lg:max-w-xl">
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, condition, Fitabase Id…"
            aria-label="Search patients"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`kg-filter-pill ${statusFilter === 'all' ? 'kg-filter-pill-active' : ''}`}
          >
            All
          </button>
          {CARE_STATUS_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => setStatusFilter(o.value)}
              className={`kg-filter-pill ${statusFilter === o.value ? 'kg-filter-pill-active' : ''}`}
              style={
                statusFilter === o.value
                  ? { borderColor: `${o.color}66`, color: o.color, background: `${o.color}18` }
                  : undefined
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="kg-panel p-16 text-center text-sm" style={{ color: 'var(--text-3)' }}>
          Loading patient directory…
        </div>
      ) : filtered.length === 0 ? (
        <div className="kg-panel p-16 text-center">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
            No patients match
          </p>
          <p className="text-xs max-w-md mx-auto mb-4" style={{ color: 'var(--text-2)' }}>
            Add patients or adjust your search and filters.
          </p>
          <Link href="/" className="kg-btn-primary inline-flex">
            Go to home
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row, i) => {
            const st = row.care_status || 'active'
            const opt = CARE_STATUS_OPTIONS.find(o => o.value === st)
            const urgent = row.urgent_pending > 0
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="kg-panel p-0 overflow-hidden group flex flex-col"
              >
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{
                        background: urgent
                          ? 'linear-gradient(135deg, #dc2626, #f97316)'
                          : 'linear-gradient(135deg, #6366f1, #7c3aed)',
                      }}
                    >
                      {initials(row.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/${row.id}`}
                        className="text-base font-bold hover:underline truncate block"
                        style={{ color: 'var(--text)' }}
                      >
                        {row.name}
                      </Link>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-2)' }}>
                        {row.condition} · Age {row.age}
                      </p>
                      <span
                        className="inline-flex mt-2 text-[10px] px-2 py-0.5 rounded-full border font-semibold"
                        style={{ borderColor: `${opt?.color}44`, color: opt?.color }}
                      >
                        {opt?.label ?? st}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg py-2 px-1" style={{ background: 'var(--surface)' }}>
                      <div className="text-lg font-bold tabular-nums" style={{ color: row.pending_alerts ? '#fbbf24' : 'var(--text-3)' }}>
                        {row.pending_alerts}
                      </div>
                      <div className="text-[9px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>
                        Alerts
                      </div>
                    </div>
                    <div className="rounded-lg py-2 px-1" style={{ background: 'var(--surface)' }}>
                      <div className="text-lg font-bold tabular-nums" style={{ color: urgent ? '#f87171' : 'var(--text-3)' }}>
                        {row.urgent_pending}
                      </div>
                      <div className="text-[9px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>
                        Urgent
                      </div>
                    </div>
                    <div className="rounded-lg py-2 px-1" style={{ background: 'var(--surface)' }}>
                      <div className="text-[11px] font-semibold truncate px-0.5" style={{ color: 'var(--text-2)' }}>
                        {row.last_wearable_at ? format(parseISO(row.last_wearable_at), 'MMM d') : '—'}
                      </div>
                      <div className="text-[9px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>
                        Sync
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="flex border-t divide-x"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <Link
                    href={`/dashboard/${row.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors hover:bg-white/[0.04]"
                    style={{ color: 'var(--kg-accent)' }}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Record
                  </Link>
                  <Link
                    href={`/dashboard/${row.id}?tab=messages`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors hover:bg-white/[0.04]"
                    style={{ color: 'var(--text-2)' }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message
                  </Link>
                  <Link
                    href={`/dashboard/${row.id}?tab=ai-nurse`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors hover:bg-white/[0.04]"
                    style={{ color: 'var(--text-2)' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Nurse
                  </Link>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <div className="mt-10 kg-panel p-5 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5" style={{ color: 'var(--kg-accent)' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              Advanced monitoring
            </p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              Full anomaly review and charts are available from each patient&apos;s record.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/practice"
            className="text-xs font-semibold px-4 py-2 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            Table roster
          </Link>
        </div>
      </div>
    </div>
  )
}
