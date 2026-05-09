'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Level = 'none' | 'mild' | 'moderate' | 'severe'

const QUESTIONS: Array<{
  key: string
  label: string
  hint: string
}> = [
  { key: 'fatigue', label: 'Fatigue', hint: 'Overall energy vs your usual week' },
  { key: 'dizziness', label: 'Dizziness or lightheadedness', hint: 'Standing up, walking, or at rest' },
  { key: 'breath', label: 'Shortness of breath', hint: 'More than usual for your fitness level' },
  { key: 'pain', label: 'Chest discomfort or palpitations', hint: 'Even brief episodes matter' },
  { key: 'fever', label: 'Fever or infection symptoms', hint: 'Chills, sore throat, cough, etc.' },
  { key: 'stress', label: 'Stress or poor sleep', hint: 'Life load, worry, fragmented sleep' },
  { key: 'meds', label: 'Medication changes', hint: 'Missed doses, new drugs, dose changes' },
]

type Props = {
  patientId: string
}

export function FollowUpIntake({ patientId }: Props) {
  const [open, setOpen] = useState(false)
  const [levels, setLevels] = useState<Record<string, Level>>({})
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function setLevel(key: string, v: Level) {
    setLevels(prev => ({ ...prev, [key]: v }))
  }

  async function submit() {
    setSending(true)
    setErr(null)
    const lines = QUESTIONS.map(q => {
      const lv = levels[q.key] || 'none'
      return `${q.label}: ${lv}`
    })
    const body = `[Follow-up check-in — not a diagnosis]\n${lines.join('\n')}${notes.trim() ? `\n\nNotes: ${notes.trim()}` : ''}`

    try {
      const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          author_role: 'patient',
          body,
          topic: 'follow_up_intake',
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Send failed')
      setDone(true)
      setOpen(false)
    } catch (e) {
      setErr(String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.07] to-slate-900/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25 text-lg shrink-0">
            ✶
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Quick check-in</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Helps your team interpret wearable trends — optional, takes under a minute.
            </p>
          </div>
        </div>
        <span className={`text-slate-500 text-xs shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.06]"
          >
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-[11px] leading-relaxed text-slate-500">
                This does not replace emergency care. For chest pain, severe breathlessness, fainting, or stroke symptoms,
                call emergency services.
              </p>

              <div className="space-y-3">
                {QUESTIONS.map(q => (
                  <div
                    key={q.key}
                    className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-xs font-medium text-slate-200">{q.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{q.hint}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(['none', 'mild', 'moderate', 'severe'] as const).map(lv => (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => setLevel(q.key, lv)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all capitalize ${
                            (levels[q.key] || 'none') === lv
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                              : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                          }`}
                        >
                          {lv}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Anything else?</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional context your clinician should know…"
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>

              {err && <p className="text-xs text-red-400">{err}</p>}

              <button
                type="button"
                disabled={sending}
                onClick={submit}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors shadow-lg shadow-violet-500/15"
              >
                {sending ? 'Sending to care team…' : 'Send to care team'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {done && (
        <div className="px-5 py-3 border-t border-emerald-500/15 bg-emerald-500/[0.06] text-xs text-emerald-300/90">
          Thanks — your clinician can see this in the care thread alongside your charts.
        </div>
      )}
    </div>
  )
}
