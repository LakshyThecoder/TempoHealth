'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarPlus, Layers } from 'lucide-react'

const EVENT_TYPES = [
  { id: 'medication_change', label: 'Medication' },
  { id: 'symptom', label: 'Symptom' },
  { id: 'stress', label: 'Stress' },
  { id: 'illness', label: 'Illness' },
  { id: 'travel', label: 'Travel' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'other', label: 'Other' },
] as const

type EventRow = {
  id: string
  event_type: string
  title: string
  notes: string | null
  occurred_at: string
}

type Props = {
  patientId: string
  events: EventRow[]
  correlationHints: string[]
  onRefresh: () => void
}

export function EventCorrelationPanel({ patientId, events, correlationHints, onRefresh }: Props) {
  const [adding, setAdding] = useState(false)
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]['id']>('medication_change')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveEvent() {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/clinical-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          event_type: eventType,
          title: title.trim(),
          notes: notes.trim() || null,
          occurred_at: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      setTitle('')
      setNotes('')
      setAdding(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Event correlation timeline</h3>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">cause → effect</span>
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          Log event
        </button>
      </div>

      {adding && (
        <div className="px-4 py-3 border-b border-slate-800 space-y-2 bg-slate-950/40">
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value as (typeof EVENT_TYPES)[number]['id'])}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
          >
            {EVENT_TYPES.map(et => (
              <option key={et.id} value={et.id}>
                {et.label}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Short label (e.g. Beta blocker dose increased)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600"
          />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional detail"
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-slate-500 px-2">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !title.trim()}
              onClick={saveEvent}
              className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {correlationHints.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-800 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Automated correlations</p>
          {correlationHints.map((h, i) => (
            <p key={i} className="text-xs text-slate-300 leading-relaxed border-l-2 border-cyan-500/40 pl-3">
              {h}
            </p>
          ))}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80">
        {events.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-500 text-center">
            No logged events yet. Add medications, symptoms, travel, or illness to contextualize wearable shifts.
          </p>
        ) : (
          events.map(ev => (
            <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className="text-[10px] font-mono text-slate-500 shrink-0 mt-0.5">
                {format(parseISO(ev.occurred_at), 'MMM d')}
              </span>
              <div>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{ev.event_type.replace(/_/g, ' ')}</span>
                <p className="text-sm text-slate-200">{ev.title}</p>
                {ev.notes && <p className="text-xs text-slate-500 mt-0.5">{ev.notes}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
