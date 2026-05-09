'use client'

import { useState } from 'react'
import {
  HeartPulse,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Send,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

const QUICK_PROMPTS = [
  'How should I interpret fatigue this week alongside my wearable trends?',
  'What vitals or symptoms mean I should call my clinic urgently?',
  'Help me prepare questions for my next cardiology visit.',
  'Explain what “personal baseline” means for my alerts.',
]

type Props = {
  patientId: string
  patientName: string
}

export function AiNursePanel({ patientId, patientName }: Props) {
  const [input, setInput] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(custom?: string) {
    const text = (custom ?? input).trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setReply(null)
    try {
      const r = await fetch('/api/ai-nurse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, message: text }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Request failed')
      setReply(d.reply as string)
      if (!custom) setInput('')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const first = patientName.split(' ')[0] || 'there'

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div
          className="relative overflow-hidden rounded-2xl border p-5"
          style={{
            borderColor: 'var(--border)',
            background:
              'linear-gradient(145deg, rgba(32,190,255,0.08) 0%, rgba(124,58,237,0.06) 50%, var(--bg-card) 100%)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--kg-accent), #a855f7)',
              }}
            >
              <Stethoscope className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                AI Nurse
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--kg-accent)' }} />
              </h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Proactive education and check-in support for {first}. Answers use your recent wearable context when
                available — always paired with your clinician&apos;s judgment.
              </p>
            </div>
          </div>
        </div>

        <div className="kg-panel p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
            <HeartPulse className="w-3.5 h-3.5" />
            Today&apos;s focus
          </p>
          <ul className="text-xs space-y-2.5" style={{ color: 'var(--text-2)' }}>
            <li className="flex gap-2">
              <span style={{ color: 'var(--kg-accent)' }}>·</span>
              Review sleep and activity balance — consistency beats spikes.
            </li>
            <li className="flex gap-2">
              <span style={{ color: 'var(--kg-accent)' }}>·</span>
              Note any new symptoms alongside alerts (fatigue, breathlessness, palpitations).
            </li>
            <li className="flex gap-2">
              <span style={{ color: 'var(--kg-accent)' }}>·</span>
              Keep medications as prescribed; bring questions to your care team.
            </li>
          </ul>
        </div>

        <div className="kg-panel p-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400/90" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-1">Escalate urgently</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
              Chest pain, severe shortness of breath, fainting, sudden weakness, or stroke-like symptoms — seek emergency
              care or call emergency services. AI Nurse does not replace emergency assessment.
            </p>
          </div>
        </div>

        <div className="kg-panel p-4 flex gap-3 items-start">
          <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: 'var(--green)' }} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
              Privacy & supervision
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
              Conversations support education under clinician oversight. Critical decisions belong to your medical team.
            </p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col min-h-[420px]">
        <div className="kg-panel flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
            <MessageCircleHeart className="w-4 h-4" style={{ color: 'var(--kg-accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Ask your AI Nurse
            </span>
          </div>

          <div className="flex flex-wrap gap-2 p-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {QUICK_PROMPTS.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={loading}
                className="text-left text-[11px] font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 hover:bg-white/[0.04]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
            {reply ? (
              <div
                className="rounded-xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              >
                {reply}
              </div>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>
                Choose a prompt or type your own question. Responses include wearable context when available.
              </p>
            )}
            {error && (
              <p className="text-xs text-center" style={{ color: '#f87171' }}>
                {error}
              </p>
            )}
          </div>

          <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={`Message as ${first}'s care team…`}
              className="flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/25"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="kg-btn-primary px-4 disabled:opacity-45"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
