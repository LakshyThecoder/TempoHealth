import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { PracticeRosterRow } from '@/lib/practice-roster'

/**
 * Practice roster: all patients with wearable + alert aggregates for CRM-style triage.
 */
export async function GET() {
  const { data: patients, error } = await supabase.from('patients').select('*').order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!patients?.length) {
    return NextResponse.json({
      roster: [] as PracticeRosterRow[],
      totals: { patients: 0, pending_sum: 0, urgent_sum: 0, review_queue: 0 },
    })
  }

  const ids = patients.map(p => p.id)

  const [{ data: anomalies }, { data: readings }] = await Promise.all([
    supabase.from('anomalies').select('patient_id, status, severity').in('patient_id', ids),
    supabase.from('wearable_readings').select('patient_id, recorded_at').in('patient_id', ids).order('recorded_at', { ascending: false }),
  ])

  const lastSync = new Map<string, string>()
  for (const r of readings || []) {
    if (!lastSync.has(r.patient_id)) lastSync.set(r.patient_id, r.recorded_at)
  }

  type Agg = { pending: number; urgent: number }
  const agg = new Map<string, Agg>()
  for (const id of ids) agg.set(id, { pending: 0, urgent: 0 })

  for (const a of anomalies || []) {
    const g = agg.get(a.patient_id)
    if (!g) continue
    if (a.status === 'pending') {
      g.pending++
      if (a.severity === 'high') g.urgent++
    }
  }

  const roster: PracticeRosterRow[] = patients.map(p => {
    const g = agg.get(p.id) ?? { pending: 0, urgent: 0 }
    return {
      id: p.id,
      name: p.name,
      age: p.age,
      condition: p.condition,
      medications: p.medications ?? [],
      data_source: p.data_source ?? null,
      external_subject_id: p.external_subject_id ?? null,
      display_name: p.display_name ?? null,
      clinician_id: p.clinician_id ?? null,
      chart_notes: (p as { chart_notes?: string | null }).chart_notes ?? null,
      care_status: (p as { care_status?: string | null }).care_status ?? 'active',
      created_at: p.created_at,
      pending_alerts: g.pending,
      urgent_pending: g.urgent,
      last_wearable_at: lastSync.get(p.id) ?? null,
    }
  })

  return NextResponse.json({
    roster,
    totals: {
      patients: roster.length,
      pending_sum: roster.reduce((s, r) => s + r.pending_alerts, 0),
      urgent_sum: roster.reduce((s, r) => s + r.urgent_pending, 0),
      review_queue: roster.filter(r => (r.care_status || 'active') === 'review_needed').length,
    },
  })
}
