import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateAiNurseReply } from '@/lib/ai-nurse'
import { isUuid } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const patient_id = body.patient_id as string
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!patient_id || !message) {
      return NextResponse.json({ error: 'patient_id and message required' }, { status: 400 })
    }
    if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })
    if (message.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 })

    const { data: patient, error: pe } = await supabase.from('patients').select('*').eq('id', patient_id).single()
    if (pe || !patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const since = new Date(Date.now() - 14 * 864e5).toISOString()
    const [{ data: anomalies }, { data: readings }] = await Promise.all([
      supabase
        .from('anomalies')
        .select('metric, severity, triggered_at, status')
        .eq('patient_id', patient_id)
        .gte('triggered_at', since)
        .order('triggered_at', { ascending: false })
        .limit(12),
      supabase
        .from('wearable_readings')
        .select('recorded_at, hr, steps, sleep_duration_min, hrv_ms')
        .eq('patient_id', patient_id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
        .limit(30),
    ])

    const pending =
      anomalies?.filter(a => (a as { status?: string }).status === 'pending').length ?? 0
    const wearableSummary = [
      `${readings?.length ?? 0} recent readings (14d window).`,
      anomalies?.length ? `${anomalies.length} anomaly flags in period; ~${pending} may need review.` : 'No recent anomaly flags.',
      patient.data_source === 'fitbit_kaggle' ? 'Data source: Fitbit cohort export.' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const reply = await generateAiNurseReply({
      patientName: patient.name,
      condition: patient.condition,
      userMessage: message,
      wearableSummary,
    })

    return NextResponse.json({ reply })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
