import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/validation'
import { detectAnomalies, applyMultiSignalBoost } from '@/lib/anomaly'
import { generateClinicalContext, getRelevantEvidence } from '@/lib/rag'
import { ANOMALY_METRICS } from '@/lib/metrics'

export async function POST(req: NextRequest) {
  const { patient_id } = await req.json()
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const { data: patient } = await supabase
    .from('patients')
    .select('condition')
    .eq('id', patient_id)
    .single()

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const { data: baselines } = await supabase
    .from('baselines')
    .select('metric, rolling_mean, rolling_std')
    .eq('patient_id', patient_id)

  if (!baselines?.length) return NextResponse.json({ error: 'No baselines found' }, { status: 404 })

  const baselineMap = Object.fromEntries(
    baselines.map(b => [b.metric, { mean: b.rolling_mean, std: b.rolling_std }])
  )

  const { data: readings } = await supabase
    .from('wearable_readings')
    .select('*')
    .eq('patient_id', patient_id)
    .order('recorded_at', { ascending: false })
    .limit(14)

  if (!readings?.length) return NextResponse.json({ error: 'No readings found' }, { status: 404 })

  const newAnomalies = []

  for (const reading of readings) {
    const metricReadings = ANOMALY_METRICS.filter(
      m => reading[m as keyof typeof reading] != null && baselineMap[m]
    ).map(m => ({
      metric: m,
      value: reading[m as keyof typeof reading] as number,
      mean: baselineMap[m].mean,
      std: baselineMap[m].std,
    }))

    const detected = detectAnomalies(metricReadings)
    const boosted = applyMultiSignalBoost(detected)
    const flagged = boosted.filter(a => a.isAnomaly && a.severity !== 'low')

    for (const anomaly of flagged) {
      const { data: existing } = await supabase
        .from('anomalies')
        .select('id')
        .eq('patient_id', patient_id)
        .eq('metric', anomaly.metric)
        .eq('triggered_at', reading.recorded_at)
        .single()

      if (existing) continue

      const evidence = await getRelevantEvidence(
        `${anomaly.metric} deviation in ${patient.condition}`
      )
      const context = await generateClinicalContext(
        patient.condition,
        anomaly.metric,
        anomaly.value,
        anomaly.baselineMean,
        anomaly.zScore,
        evidence
      )

      const { data: inserted } = await supabase
        .from('anomalies')
        .insert({
          patient_id,
          metric: anomaly.metric,
          triggered_at: reading.recorded_at,
          z_score: anomaly.zScore,
          severity: anomaly.severity,
          value: anomaly.value,
          baseline_mean: anomaly.baselineMean,
          clinical_context: context,
          evidence_snippets: evidence.map(e => `${e.source}: ${e.content.substring(0, 150)}...`),
          status: 'pending',
        })
        .select()
        .single()

      if (inserted) newAnomalies.push(inserted)
    }
  }

  return NextResponse.json({ success: true, new_anomalies: newAnomalies.length, anomalies: newAnomalies })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patient_id = searchParams.get('patient_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('anomalies')
    .select('*')
    .order('triggered_at', { ascending: false })

  if (patient_id) {
    if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })
    query = query.eq('patient_id', patient_id)
  }
  if (status) query = query.eq('status', status)

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ anomalies: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, status, reviewed_by } = body
  const clinician_note =
    typeof body.clinician_note === 'string' ? body.clinician_note.trim().slice(0, 4000) : undefined

  if (!id || !isUuid(id)) return NextResponse.json({ error: 'valid id (UUID) required' }, { status: 400 })
  if (!status || !['pending', 'reviewed', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'status must be pending, reviewed, or dismissed' }, { status: 400 })
  }

  const reviewed_at =
    status === 'reviewed' || status === 'dismissed' ? new Date().toISOString() : null

  const { data, error } = await supabase
    .from('anomalies')
    .update({
      status,
      reviewed_by: reviewed_by ?? undefined,
      ...(clinician_note !== undefined ? { clinician_note: clinician_note || null } : {}),
      reviewed_at,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ anomaly: data })
}
