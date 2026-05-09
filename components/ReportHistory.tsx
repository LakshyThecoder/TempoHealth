'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { FileText, Loader2 } from 'lucide-react'

type ReportRow = {
  id: string
  created_at: string
  period_start: string
  period_end: string
  narrative: string
  summary_json: { type?: string } | null
}

type Props = {
  patientId: string
}

export function ReportHistory({ patientId }: Props) {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/report?patient_id=${patientId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else {
          setError(null)
          const list = d.reports || []
          setReports(list)
          setOpenId(list[0]?.id ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load reports')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm py-12 justify-center" style={{ color: 'var(--text-3)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading report history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', color: '#f87171' }}>
        {error}
      </div>
    )
  }

  if (!reports.length) {
    return (
      <div className="kg-panel p-8 text-center">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--text-3)' }} />
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
          No saved reports yet
        </p>
        <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Generate reports from advanced monitoring; saved runs appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
        Saved narratives (latest first)
      </p>
      <div className="space-y-2">
        {reports.map(r => {
          const open = openId === r.id
          const kind = r.summary_json?.type === 'previsit' ? 'Pre-visit brief' : 'Weekly / period report'
          return (
            <div key={r.id} className="kg-panel overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--kg-accent)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {kind}
                    </p>
                    <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                      {format(parseISO(r.created_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold shrink-0" style={{ color: 'var(--text-3)' }}>
                  {open ? 'Hide' : 'View'}
                </span>
              </button>
              {open && (
                <div
                  className="px-4 pb-4 pt-0 border-t text-sm leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-y-auto"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                >
                  {r.narrative}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
