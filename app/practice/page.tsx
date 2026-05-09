'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { ChevronRight, LayoutDashboard, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CARE_STATUS_OPTIONS, type CareStatusValue } from '@/lib/care-status'
import type { PracticeRosterRow } from '@/lib/practice-roster'

type Totals = { patients: number; pending_sum: number; urgent_sum: number; review_queue: number }

export default function PracticePage() {
  const [roster, setRoster] = useState<PracticeRosterRow[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CareStatusValue>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})
  const [draftStatus, setDraftStatus] = useState<Record<string, CareStatusValue>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/practice')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load roster')
      setRoster(d.roster || [])
      setTotals(d.totals || null)
      const notes: Record<string, string> = {}
      const st: Record<string, CareStatusValue> = {}
      for (const row of d.roster || []) {
        notes[row.id] = row.chart_notes || ''
        st[row.id] = (row.care_status as CareStatusValue) || 'active'
      }
      setDraftNotes(notes)
      setDraftStatus(st)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let rows = roster
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.condition.toLowerCase().includes(q) ||
          (r.external_subject_id && r.external_subject_id.includes(q))
      )
    }
    if (statusFilter !== 'all') {
      rows = rows.filter(r => (r.care_status || 'active') === statusFilter)
    }
    return rows
  }, [roster, query, statusFilter])

  async function savePatient(id: string) {
    setSaving(id)
    try {
      const r = await fetch('/api/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          chart_notes: draftNotes[id] ?? '',
          care_status: draftStatus[id] ?? 'active',
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Save failed')
      await load()
      setExpanded(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="kg-accent-bar" aria-hidden />
      <header className="kg-dash-header sticky top-0 z-30 h-14 flex items-center shrink-0">
        <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
              >
                T
              </div>
              <span className="font-bold text-sm hidden sm:inline" style={{ color: 'var(--text)' }}>
                Tempo<span className="gt">Health</span>
              </span>
            </Link>
            <div className="w-px h-5 shrink-0 hidden sm:block" style={{ background: 'var(--border-2)' }} />
            <nav className="kg-breadcrumb hidden sm:flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
              <Link href="/" className="transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3 h-3 shrink-0 opacity-45" aria-hidden />
              <span style={{ color: 'var(--text-2)' }}>Practice roster</span>
            </nav>
            <div className="min-w-0 sm:hidden">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-3)' }}>
                Practice
              </p>
              <h1 className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
                Roster & CRM
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="text-xs font-semibold px-3 py-2 rounded-lg border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Care hub
            </Link>
            <Link
              href="/"
              className="text-xs font-semibold px-3 py-2 rounded-lg border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-8 flex-1 w-full">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div>
            <p className="section-label mb-2">Clinical operations</p>
            <h2 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mb-2" style={{ color: 'var(--text)' }}>
              Every patient, one view
            </h2>
            <p className="text-sm max-w-2xl leading-relaxed" style={{ color: 'var(--text-2)' }}>
              Triage by alerts and workflow status, capture chart notes, then open the full wearable dashboard for deep
              review.
            </p>
          </div>
        </motion.div>

        {totals && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Patients', value: totals.patients, color: 'var(--text)' },
              { label: 'Pending alerts', value: totals.pending_sum, color: '#f59e0b' },
              { label: 'Urgent (pending HIGH)', value: totals.urgent_sum, color: '#ef4444' },
              { label: 'Review needed status', value: totals.review_queue, color: '#a855f7' },
            ].map(t => (
              <div key={t.label} className="kg-metric">
                <div className="kg-metric-value gt" style={{ color: t.color }}>
                  {t.value}
                </div>
                <div className="kg-metric-label">{t.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          <div className="kg-search-wrap w-full lg:flex-1 lg:max-w-none">
            <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, condition, Fitabase Id…"
              aria-label="Search roster"
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
          <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            <button type="button" className="ml-3 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="bento p-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>
            Loading practice roster…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bento p-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>
            No patients match your filters. Try another search or clear filters.
          </div>
        ) : (
          <div className="kg-table-shell">
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ color: 'var(--text)' }}>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th className="hidden md:table-cell">Condition</th>
                    <th>Workflow</th>
                    <th className="text-center">Pending</th>
                    <th className="text-center hidden sm:table-cell">Urgent</th>
                    <th className="hidden lg:table-cell">Last sync</th>
                    <th className="hidden xl:table-cell">Source</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const open = expanded === row.id
                    const st = row.care_status || 'active'
                    const opt = CARE_STATUS_OPTIONS.find(o => o.value === st)
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className="border-b transition-colors hover:bg-white/[0.03]"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setExpanded(open ? null : row.id)}
                              className="text-left font-semibold hover:underline"
                              style={{ color: 'var(--text)' }}
                            >
                              {row.name}
                            </button>
                            <div className="text-[11px] mt-0.5 md:hidden" style={{ color: 'var(--text-3)' }}>
                              {row.condition}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--text-2)' }}>
                            {row.condition}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                              style={{ borderColor: `${opt?.color}44`, color: opt?.color }}
                            >
                              {opt?.label ?? st}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums font-medium" style={{ color: row.pending_alerts ? '#f59e0b' : 'var(--text-3)' }}>
                            {row.pending_alerts}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums font-medium hidden sm:table-cell" style={{ color: row.urgent_pending ? '#ef4444' : 'var(--text-3)' }}>
                            {row.urgent_pending}
                          </td>
                          <td className="px-4 py-3 text-[11px] hidden lg:table-cell" style={{ color: 'var(--text-3)' }}>
                            {row.last_wearable_at ? format(parseISO(row.last_wearable_at), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 text-[11px] hidden xl:table-cell truncate max-w-[120px]" style={{ color: 'var(--text-3)' }}>
                            {row.data_source === 'fitbit_kaggle' ? 'Fitbit cohort' : row.data_source === 'synthetic_demo' ? 'Sample' : row.data_source || '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Link href={`/clinician/${row.id}`} className="kg-btn-primary no-underline">
                              <LayoutDashboard className="w-3.5 h-3.5" aria-hidden />
                              Dashboard
                            </Link>
                          </td>
                        </tr>
                        {open && (
                            <tr className="bg-slate-950/40">
                              <td colSpan={8} className="px-4 pb-4 pt-0 border-b" style={{ borderColor: 'var(--border)' }}>
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="rounded-xl border p-4 mt-2 space-y-3"
                                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                                >
                                    <div className="grid sm:grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-[10px] uppercase font-semibold" style={{ color: 'var(--text-3)' }}>
                                          Care status
                                        </label>
                                        <select
                                          value={draftStatus[row.id] ?? 'active'}
                                          onChange={e =>
                                            setDraftStatus(prev => ({ ...prev, [row.id]: e.target.value as CareStatusValue }))
                                          }
                                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                                          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                        >
                                          {CARE_STATUS_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="text-[11px] space-y-1" style={{ color: 'var(--text-2)' }}>
                                        <p>
                                          <strong style={{ color: 'var(--text)' }}>Age {row.age}</strong> ·{' '}
                                          {row.medications.slice(0, 2).join(' · ')}
                                          {row.medications.length > 2 ? '…' : ''}
                                        </p>
                                        {row.external_subject_id && (
                                          <p className="font-mono text-[10px]">Fitabase Id {row.external_subject_id}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase font-semibold" style={{ color: 'var(--text-3)' }}>
                                        Chart notes (practice only)
                                      </label>
                                      <textarea
                                        value={draftNotes[row.id] ?? ''}
                                        onChange={e => setDraftNotes(prev => ({ ...prev, [row.id]: e.target.value }))}
                                        rows={4}
                                        placeholder="Visit summary, follow-up plan, who to loop in…"
                                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                      />
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => savePatient(row.id)}
                                        disabled={saving === row.id}
                                        className="text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                                      >
                                        {saving === row.id ? 'Saving…' : 'Save chart'}
                                      </button>
                                      <Link
                                        href={`/patient/${row.id}`}
                                        className="text-xs font-semibold px-4 py-2 rounded-lg border"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                                      >
                                        Preview patient app
                                      </Link>
                                    </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-[11px] mt-8 leading-relaxed max-w-3xl" style={{ color: 'var(--text-3)' }}>
          Run migration <code className="text-[10px] px-1 rounded bg-white/5">20260509180000_practice_crm.sql</code> in
          Supabase so <code className="text-[10px] px-1 rounded bg-white/5">chart_notes</code> and{' '}
          <code className="text-[10px] px-1 rounded bg-white/5">care_status</code> are available.
        </p>
      </div>
    </div>
  )
}
