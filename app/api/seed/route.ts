import { readFileSync } from 'fs'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generatePatientData, computeRollingBaselines, type DailyReading } from '@/lib/synthetic'
import { embedKnowledge, generateClinicalContext, getRelevantEvidence, MEDICAL_KNOWLEDGE } from '@/lib/rag'
import { detectAnomalies, applyMultiSignalBoost } from '@/lib/anomaly'
import { ANOMALY_METRICS } from '@/lib/metrics'
import type { PortalFitbitBundle } from '@/lib/portal-fitbit'
import { PORTAL_FITBIT_IDS } from '@/lib/portal-fitbit'
import { assertSeedAllowed } from '@/lib/seed-auth'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Stable demo URLs after seed — avoids random UUIDs in links */
export const SYNTHETIC_IDS = [
  '11111111-1111-4111-8111-111111111101',
  '22222222-2222-4222-8222-222222222202',
] as const

const DEMO_PATIENTS = [
  {
    id: SYNTHETIC_IDS[0],
    name: 'James Okafor',
    age: 64,
    condition: 'Atrial Fibrillation',
    medications: ['Metoprolol 50mg', 'Apixaban 5mg', 'Lisinopril 10mg'],
    data_source: 'synthetic_demo',
  },
  {
    id: SYNTHETIC_IDS[1],
    name: 'Maria Chen',
    age: 58,
    condition: 'Atrial Fibrillation',
    medications: ['Bisoprolol 5mg', 'Rivaroxaban 20mg'],
    data_source: 'synthetic_demo',
  },
]

type SeedMode = 'synthetic' | 'fitbit_rebaseline' | 'portal_fitbit'

async function wipeSyntheticDemo() {
  for (const id of SYNTHETIC_IDS) {
    await supabase.from('anomalies').delete().eq('patient_id', id)
    await supabase.from('reports').delete().eq('patient_id', id)
    await supabase.from('baselines').delete().eq('patient_id', id)
    await supabase.from('wearable_readings').delete().eq('patient_id', id)
  }
  await supabase.from('patients').delete().in('id', [...SYNTHETIC_IDS])
}

async function generateAnomaliesForPatient(
  demo: { condition: string },
  patientId: string,
  readings: DailyReading[],
  baselines: Record<string, { mean: number; std: number }>,
  recentWindow = 30
) {
  const recentReadings = readings.slice(-recentWindow)
  const allFlagged: Array<{
    reading: DailyReading
    anomaly: ReturnType<typeof detectAnomalies>[0]
  }> = []

  for (const reading of recentReadings) {
    const metricReadings = ANOMALY_METRICS.filter(m => {
      const v = reading[m as keyof DailyReading]
      return typeof v === 'number' && !Number.isNaN(v) && baselines[m]
    }).map(m => ({
      metric: m,
      value: reading[m as keyof DailyReading] as number,
      mean: baselines[m].mean,
      std: baselines[m].std,
    }))

    const detected = detectAnomalies(metricReadings)
    const boosted = applyMultiSignalBoost(detected)
    for (const a of boosted) {
      if (a.isAnomaly && a.severity !== 'low') {
        allFlagged.push({ reading, anomaly: a })
      }
    }
  }

  allFlagged.sort((a, b) => {
    const sevScore = { high: 3, medium: 2, low: 1 }
    return (
      sevScore[b.anomaly.severity] - sevScore[a.anomaly.severity] ||
      Math.abs(b.anomaly.zScore) - Math.abs(a.anomaly.zScore)
    )
  })

  const AI_LIMIT = 8
  let aiCallCount = 0

  for (const { reading, anomaly } of allFlagged) {
    let context: string
    let evidenceSnippets: string[]

    if (aiCallCount < AI_LIMIT) {
      try {
        await sleep(16000)
        const evidence = await getRelevantEvidence(`${anomaly.metric} deviation in ${demo.condition}`)
        await sleep(16000)
        context = await generateClinicalContext(
          demo.condition,
          anomaly.metric,
          anomaly.value,
          anomaly.baselineMean,
          anomaly.zScore,
          evidence
        )
        evidenceSnippets = evidence.map(e => `${e.source}: ${e.content.substring(0, 160)}...`)
        aiCallCount++
      } catch {
        const staticEvidence = MEDICAL_KNOWLEDGE.filter(
          k =>
            k.content.toLowerCase().includes(anomaly.metric.replace('_', ' ')) ||
            k.content.toLowerCase().includes(demo.condition.toLowerCase())
        ).slice(0, 2)
        context = `${anomaly.metric} deviation detected (z=${anomaly.zScore.toFixed(1)}). This signal may be clinically relevant in ${demo.condition} patients. Clinician confirmation required.`
        evidenceSnippets = staticEvidence.map(e => `${e.source}: ${e.content.substring(0, 160)}...`)
      }
    } else {
      const staticEvidence = MEDICAL_KNOWLEDGE.filter(
        k =>
          k.content.toLowerCase().includes(anomaly.metric.replace('_', ' ')) ||
          k.content.toLowerCase().includes('atrial fibrillation')
      ).slice(0, 2)
      context = `Personalized baseline deviation detected in ${anomaly.metric} (z-score: ${anomaly.zScore.toFixed(1)}, ${Math.abs(((anomaly.value - anomaly.baselineMean) / (anomaly.baselineMean || 1)) * 100).toFixed(0)}% from personal mean). This pattern warrants clinical review in the context of ${demo.condition}. Clinician confirmation required.`
      evidenceSnippets = staticEvidence.map(e => `${e.source}: ${e.content.substring(0, 160)}...`)
    }

    await supabase.from('anomalies').insert({
      patient_id: patientId,
      metric: anomaly.metric,
      triggered_at: reading.recorded_at,
      z_score: anomaly.zScore,
      severity: anomaly.severity,
      value: anomaly.value,
      baseline_mean: anomaly.baselineMean,
      clinical_context: context,
      evidence_snippets: evidenceSnippets,
      status: 'pending',
    })
  }
}

async function seedSynthetic() {
  await wipeSyntheticDemo()

  try {
    await embedKnowledge()
    await sleep(2000)
  } catch (e: unknown) {
    console.warn('Knowledge embedding skipped (rate limit):', (e as Error)?.message)
  }

  const createdPatients: Array<{ id: string; name: string }> = []

  for (const demo of DEMO_PATIENTS) {
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert({
        id: demo.id,
        name: demo.name,
        age: demo.age,
        condition: demo.condition,
        medications: demo.medications,
        data_source: demo.data_source,
      })
      .select()
      .single()

    if (patientError) throw patientError

    const readings = generatePatientData(patient!.id, 90)

    for (let i = 0; i < readings.length; i += 30) {
      const batch = readings.slice(i, i + 30)
      const { error } = await supabase.from('wearable_readings').insert(batch)
      if (error) throw error
    }

    const baselines = computeRollingBaselines(readings.slice(0, 60), 30)
    const baselineRows = Object.entries(baselines).map(([metric, stats]) => ({
      patient_id: patient!.id,
      metric,
      rolling_mean: stats.mean,
      rolling_std: stats.std,
      window_days: 30,
    }))
    await supabase.from('baselines').upsert(baselineRows)

    await generateAnomaliesForPatient(demo, patient!.id, readings, baselines)

    createdPatients.push({ id: patient!.id, name: patient!.name })
  }

  return createdPatients
}

async function seedFitbitRebaseline() {
  const { data: pts, error } = await supabase
    .from('patients')
    .select('id, name, condition')
    .eq('data_source', 'fitbit_kaggle')

  if (error) throw error
  if (!pts?.length) {
    return { message: 'No FitBit cohort patients found. Run: npx tsx scripts/import-fitbit.ts', patients: [] }
  }

  try {
    await embedKnowledge()
    await sleep(2000)
  } catch (e: unknown) {
    console.warn('Knowledge embedding skipped:', (e as Error)?.message)
  }

  const out: Array<{ id: string; name: string }> = []

  for (const p of pts) {
    const { data: readingsRaw, error: rErr } = await supabase
      .from('wearable_readings')
      .select('*')
      .eq('patient_id', p.id)
      .order('recorded_at', { ascending: true })

    if (rErr || !readingsRaw?.length) continue

    const readings = readingsRaw as DailyReading[]
    const windowLen = Math.min(60, readings.length)
    const baselines = computeRollingBaselines(readings.slice(0, windowLen), 30)

    const baselineRows = Object.entries(baselines).map(([metric, stats]) => ({
      patient_id: p.id,
      metric,
      rolling_mean: stats.mean,
      rolling_std: stats.std,
      window_days: 30,
    }))
    await supabase.from('baselines').upsert(baselineRows)

    await supabase.from('anomalies').delete().eq('patient_id', p.id)

    await generateAnomaliesForPatient(
      { condition: p.condition || 'Wearable cohort monitoring' },
      p.id,
      readings,
      baselines,
      Math.min(30, readings.length)
    )

    out.push({ id: p.id, name: p.name })
  }

  return { message: `Recomputed baselines and anomalies for ${out.length} FitBit cohort participant(s)`, patients: out }
}

async function wipePortalCohort() {
  for (const id of PORTAL_FITBIT_IDS) {
    await supabase.from('anomalies').delete().eq('patient_id', id)
    await supabase.from('reports').delete().eq('patient_id', id)
    await supabase.from('baselines').delete().eq('patient_id', id)
    await supabase.from('wearable_readings').delete().eq('patient_id', id)
    const cm = await supabase.from('care_messages').delete().eq('patient_id', id)
    if (cm.error) console.warn('[portal_fitbit] care_messages wipe:', cm.error.message)
    await supabase.from('patients').delete().eq('id', id)
  }
}

/** Loads bundled Fitabase rows from public/data (CSV-derived JSON — no local CSV required). */
async function seedPortalFitbit() {
  const bundlePath = join(process.cwd(), 'public', 'data', 'fitbit-portal-bundle.json')
  let bundle: PortalFitbitBundle
  try {
    bundle = JSON.parse(readFileSync(bundlePath, 'utf-8')) as PortalFitbitBundle
  } catch {
    return {
      message:
        'Missing public/data/fitbit-portal-bundle.json — run: npx tsx scripts/build-portal-bundle.ts with Fitabase CSVs, commit the JSON, redeploy.',
      patients: [] as Array<{ id: string; name: string }>,
    }
  }

  await wipePortalCohort()

  try {
    await embedKnowledge()
    await sleep(2000)
  } catch (e: unknown) {
    console.warn('Knowledge embedding skipped:', (e as Error)?.message)
  }

  for (const sub of bundle.subjects) {
    const { error: pErr } = await supabase.from('patients').insert({
      id: sub.patient_id,
      name: sub.name,
      age: sub.age,
      condition: sub.condition,
      medications: sub.medications,
      external_subject_id: sub.external_subject_id,
      data_source: 'fitbit_kaggle',
      display_name: sub.name,
    })
    if (pErr) throw pErr

    const rows = sub.readings.map(r => ({
      patient_id: sub.patient_id,
      ...r,
    }))
    for (let i = 0; i < rows.length; i += 30) {
      const { error: wErr } = await supabase.from('wearable_readings').insert(rows.slice(i, i + 30))
      if (wErr) throw wErr
    }
  }

  const out: Array<{ id: string; name: string }> = []

  for (const sub of bundle.subjects) {
    const { data: readingsRaw, error: rErr } = await supabase
      .from('wearable_readings')
      .select('*')
      .eq('patient_id', sub.patient_id)
      .order('recorded_at', { ascending: true })

    if (rErr || !readingsRaw?.length) continue

    const readings = readingsRaw as DailyReading[]
    const windowLen = Math.min(60, readings.length)
    const baselines = computeRollingBaselines(readings.slice(0, windowLen), 30)

    const baselineRows = Object.entries(baselines).map(([metric, stats]) => ({
      patient_id: sub.patient_id,
      metric,
      rolling_mean: stats.mean,
      rolling_std: stats.std,
      window_days: 30,
    }))
    await supabase.from('baselines').upsert(baselineRows)

    await supabase.from('anomalies').delete().eq('patient_id', sub.patient_id)

    await generateAnomaliesForPatient(
      { condition: sub.condition || 'Wearable cohort monitoring' },
      sub.patient_id,
      readings,
      baselines,
      Math.min(30, readings.length)
    )

    out.push({ id: sub.patient_id, name: sub.name })
  }

  try {
    await supabase.from('care_messages').insert([
      {
        patient_id: PORTAL_FITBIT_IDS[0],
        author_role: 'clinician',
        topic: 'welcome',
        body:
          'Your Fitabase-derived wearable stream is connected. Use Care team to coordinate — I will review flagged anomalies before your visit.',
      },
      {
        patient_id: PORTAL_FITBIT_IDS[1],
        author_role: 'clinician',
        topic: 'welcome',
        body:
          'Welcome to TempoHealth. Message here with questions about your trends — your clinical team will review.',
      },
    ])
  } catch (e: unknown) {
    console.warn('care_messages seed skipped (apply migration?):', (e as Error)?.message)
  }

  return {
    message: `Portal Fitabase bundle: ${bundle.subjects.length} subjects, ${bundle.provenance.slice(0, 80)}…`,
    patients: out,
    demoClinicianUrl: `/clinician/${PORTAL_FITBIT_IDS[0]}`,
    demoPatientUrl: `/patient/${PORTAL_FITBIT_IDS[0]}`,
  }
}

export async function POST(req: NextRequest) {
  const denied = assertSeedAllowed(req)
  if (denied) return denied

  try {
    let mode: SeedMode = 'synthetic'
    try {
      const j = await req.json()
      if (j?.mode === 'fitbit_rebaseline') mode = 'fitbit_rebaseline'
      if (j?.mode === 'portal_fitbit') mode = 'portal_fitbit'
    } catch {
      /* empty body */
    }

    if (mode === 'portal_fitbit') {
      const result = await seedPortalFitbit()
      const missingBundle =
        !result.patients?.length && typeof result.message === 'string' && result.message.startsWith('Missing')
      if (missingBundle) {
        return NextResponse.json({ success: false, mode, ...result }, { status: 422 })
      }
      return NextResponse.json({
        success: true,
        mode,
        ...result,
      })
    }

    if (mode === 'fitbit_rebaseline') {
      const result = await seedFitbitRebaseline()
      return NextResponse.json({
        success: true,
        mode,
        ...result,
      })
    }

    const createdPatients = await seedSynthetic()

    return NextResponse.json({
      success: true,
      mode,
      message: `Seeded ${createdPatients.length} synthetic patients with 90 days of wearable data, baselines, and AI-analysed anomalies`,
      patients: createdPatients,
      demoPatientUrl: `/clinician/${SYNTHETIC_IDS[0]}`,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function GET() {
  const { data: patients } = await supabase.from('patients').select('id, name, condition, data_source, external_subject_id')
  return NextResponse.json({
    patients: patients || [],
    synthetic_demo_ids: SYNTHETIC_IDS,
    portal_fitbit_ids: PORTAL_FITBIT_IDS,
    hint:
      'POST {} synthetic · {"mode":"fitbit_rebaseline"} after import-fitbit.ts · {"mode":"portal_fitbit"} loads public/data/fitbit-portal-bundle.json',
  })
}
