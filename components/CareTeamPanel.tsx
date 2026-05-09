'use client'

import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

export type CareMessage = {
  id: string
  patient_id: string
  author_role: 'clinician' | 'patient'
  body: string
  topic: string
  created_at: string
}

type Props = {
  patientId: string
  perspective: 'clinician' | 'patient'
  pollMs?: number
}

const QUICK_CLINICIAN = [
  'Thanks for uploading data — I reviewed your trends and nothing urgent stood out.',
  "Let's schedule a quick check-in about your activity and sleep pattern this week.",
  'Please confirm you received the Pre-Visit Brief PDF from my office.',
]

const QUICK_PATIENT = [
  'I had more fatigue than usual this week — should I be worried?',
    'Confirming I saw your message about the wearable alerts.',
    'Can we discuss my sedentary time before my appointment?',
]

export function CareTeamPanel({ patientId, perspective, pollMs = 10000 }: Props) {
  const [messages, setMessages] = useState<CareMessage[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const r = await fetch(`/api/messages?patient_id=${patientId}`)
      const d = await r.json()
      if (d.error) {
        setError(d.error)
        return
      }
      setError(null)
      setMessages(d.messages || [])
    } catch {
      setError('Could not load messages')
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, pollMs)
    return () => clearInterval(t)
  }, [patientId, pollMs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    try {
      const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          author_role: perspective,
          body: text,
          topic: 'general',
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error || 'Send failed')
        setSending(false)
        return
      }
      setBody('')
      setMessages(prev => [...prev, d.message])
    } catch {
      setError('Send failed')
    }
    setSending(false)
  }

  const quick = perspective === 'clinician' ? QUICK_CLINICIAN : QUICK_PATIENT

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden h-full min-h-[320px]">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-display text-base font-semibold text-white tracking-tight">Care team channel</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {perspective === 'clinician' ? 'Secure async thread · visible on patient view' : 'Messages sync to your clinical team'}
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[280px]">
        {error && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {error}
            {error.includes('relation') || error.includes('does not exist') ? (
              <span className="block mt-1 text-slate-400">
                Apply the <code className="text-[10px]">care_messages</code> migration in Supabase.
              </span>
            ) : null}
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map(m => {
            const mine = m.author_role === perspective
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    mine
                      ? 'bg-blue-600/90 text-white rounded-br-md'
                      : 'bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1 flex flex-wrap items-center gap-2">
                    <span>
                      {m.author_role === 'clinician' ? 'Clinical team' : 'Patient'} ·{' '}
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </span>
                    {m.topic === 'follow_up_intake' && (
                      <span className="normal-case px-1.5 py-0.5 rounded-md bg-violet-500/25 text-violet-200 border border-violet-500/30">
                        Check-in
                      </span>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[13px]">{m.body}</pre>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-800 p-3 space-y-2 bg-slate-950/40">
        <div className="flex flex-wrap gap-1.5">
          {quick.map(q => (
            <button
              key={q.slice(0, 24)}
              type="button"
              onClick={() => setBody(q)}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700 transition-colors text-left max-w-full truncate"
            >
              {q.slice(0, 42)}…
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={perspective === 'clinician' ? 'Reply to patient…' : 'Message your care team…'}
            rows={2}
            className="flex-1 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-600 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !body.trim()}
            className="self-end px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold shrink-0"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
