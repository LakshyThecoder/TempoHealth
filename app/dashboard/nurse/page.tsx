'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, HeartPulse, Bell, BookOpen, ChevronRight, Stethoscope } from 'lucide-react'
import type { PracticeRosterRow } from '@/lib/practice-roster'

export default function AiNurseHubPage() {
  const [roster, setRoster] = useState<PracticeRosterRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/practice')
      .then(r => r.json())
      .then(d => setRoster(d.roster || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mb-2" style={{ color: 'var(--text)' }}>
          AI Nurse programs
        </h1>
        <p className="text-sm max-w-3xl leading-relaxed" style={{ color: 'var(--text-2)' }}>
          TempoHealth AI Nurse layers education, check-ins, and escalation awareness on top of wearable signals — always
          under clinician oversight. Pick a patient to start a guided session.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {[
          {
            icon: HeartPulse,
            title: 'Proactive rounds',
            body: 'Daily focus areas tied to trends — sleep, activity, recovery — without replacing your protocols.',
          },
          {
            icon: Bell,
            title: 'Red-flag literacy',
            body: 'Clear language on when to call the clinic vs emergency services — reduces anxiety, improves safety.',
          },
          {
            icon: BookOpen,
            title: 'Visit preparation',
            body: 'Suggested questions and summaries patients can bring to cardiology — better shared decision-making.',
          },
        ].map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="kg-panel p-5"
          >
            <c.icon className="w-8 h-8 mb-3" style={{ color: 'var(--kg-accent)' }} />
            <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text)' }}>
              {c.title}
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {c.body}
            </p>
          </motion.div>
        ))}
      </div>

      <div
        className="rounded-2xl border p-6 mb-8 flex flex-col md:flex-row md:items-center gap-6"
        style={{
          borderColor: 'var(--border)',
          background: 'linear-gradient(135deg, rgba(32,190,255,0.07), rgba(124,58,237,0.05))',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--kg-accent), #a855f7)' }}
        >
          <Stethoscope className="w-7 h-7 text-slate-900" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            Start an AI Nurse session
            <Sparkles className="w-4 h-4" style={{ color: 'var(--kg-accent)' }} />
          </h2>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Each patient record includes an AI Nurse tab with quick prompts, free-text chat, and wearable-aware replies.
          </p>
        </div>
      </div>

      <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
        Patients on your roster
      </h3>

      {loading ? (
        <p className="text-sm py-8" style={{ color: 'var(--text-3)' }}>
          Loading…
        </p>
      ) : roster.length === 0 ? (
        <div className="kg-panel p-8 text-center text-sm" style={{ color: 'var(--text-2)' }}>
          No patients on file yet.
        </div>
      ) : (
        <div className="space-y-2">
          {roster.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                href={`/dashboard/${r.id}?tab=ai-nurse`}
                className="kg-panel flex items-center justify-between gap-4 p-4 transition-colors hover:bg-white/[0.03] group"
              >
                <div className="min-w-0">
                  <p className="font-bold truncate" style={{ color: 'var(--text)' }}>
                    {r.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                    {r.condition}
                  </p>
                </div>
                <span className="text-xs font-bold flex items-center gap-1 shrink-0" style={{ color: 'var(--kg-accent)' }}>
                  Open AI Nurse
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
