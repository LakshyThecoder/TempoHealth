import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/validation'
import { generatePreVisitBrief, generateWeeklyReport } from '@/lib/rag'
import { subDays } from 'date-fns'
import { DATASET_PROVENANCE } from '@/lib/metrics'

const TREND_METRICS = [
  'hr',
  'hrv_ms',
  'spo2',
  'steps',
  'sleep_duration_min',
  'sedentary_min',
  'very_active_min',
  'calories',
] as const

function trendDirection(
  metric: string,
  delta: number
): 'stable' | 'improving' | 'worsening' {
  if (Math.abs(delta) < 1e-6) return 'stable'
  const higherIsBetter = ['hrv_ms', 'spo2', 'steps', 'sleep_duration_min', 'very_active_min'].includes(metric)
  const lowerIsBetter = ['hr', 'sedentary_min'].includes(metric)
  if (higherIsBetter) return delta > 0 ? 'improving' : 'worsening'
  if (lowerIsBetter) return delta < 0 ? 'improving' : 'worsening'
  return delta > 0 ? 'worsening' : 'improving'
}

export async function POST(req: NextRequest) {
  const { patient_id, type = 'weekly' } = await req.json()
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patient_id)
    .single()

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const periodDays = type === 'monthly' ? 30 : 7
  const periodStart = subDays(new Date(), periodDays)

  const { data: anomalies } = await supabase
    .from('anomalies')
    .select('*')
    .eq('patient_id', patient_id)
    .gte('triggered_at', periodStart.toISOString())
    .order('triggered_at', { ascending: false })

  const { data: readings } = await supabase
    .from('wearable_readings')
    .select('*')
    .eq('patient_id', patient_id)
    .gte('recorded_at', periodStart.toISOString())
    .order('recorded_at', { ascending: false })

  const trends: Record<string, { mean: number; direction: 'stable' | 'improving' | 'worsening' }> = {}

  if (readings?.length) {
    const half = Math.floor(readings.length / 2)
    const recent = readings.slice(0, half)
    const older = readings.slice(half)

    for (const metric of TREND_METRICS) {
      const rv = recent
        .map(r => r[metric as keyof typeof r])
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
      const ov = older
        .map(r => r[metric as keyof typeof r])
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
      if (rv.length < 2 || ov.length < 2) continue

      const recentMean = rv.reduce((a, b) => a + b, 0) / rv.length
      const olderMean = ov.reduce((a, b) => a + b, 0) / ov.length
      const delta = recentMean - olderMean
      const pctChange = Math.abs(delta / (Math.abs(olderMean) > 1e-6 ? olderMean : 1))

      let direction: 'stable' | 'improving' | 'worsening' = 'stable'
      if (pctChange > 0.05) {
        direction = trendDirection(metric, delta)
      }

      trends[metric] = { mean: recentMean, direction }
    }
  }

  const behavioral_summary = {
    data_source: patient.data_source,
    external_subject_id: patient.external_subject_id,
    cohort_dataset: patient.data_source === 'fitbit_kaggle' ? DATASET_PROVENANCE.name : undefined,
    limitations:
      patient.data_source === 'fitbit_kaggle' ? [...DATASET_PROVENANCE.limitations] : undefined,
    routine_note:
      trends.sedentary_min?.direction === 'worsening' && trends.sleep_duration_min?.direction === 'worsening'
        ? 'Concurrent worsening of sedentary time and sleep duration — behavioral drift pattern.'
        : undefined,
  }

  let narrative: string
  if (type === 'previsit') {
    narrative = await generatePreVisitBrief(
      patient.name,
      patient.condition,
      (anomalies || []).map(a => ({
        metric: a.metric,
        severity: a.severity,
        value: a.value,
        baselineMean: a.baseline_mean,
        zScore: a.z_score,
        clinical_context: a.clinical_context,
        triggered_at: a.triggered_at,
      })),
      periodDays
    )
  } else {
    narrative = await generateWeeklyReport(
      patient.name,
      patient.condition,
      (anomalies || []).map(a => ({
        metric: a.metric,
        severity: a.severity,
        triggered_at: a.triggered_at,
        clinical_context: a.clinical_context,
      })),
      trends
    )
  }

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      patient_id,
      period_start: periodStart.toISOString(),
      period_end: new Date().toISOString(),
      narrative,
      summary_json: {
        type,
        anomaly_count: anomalies?.length || 0,
        high_count: anomalies?.filter(a => a.severity === 'high').length || 0,
        medium_count: anomalies?.filter(a => a.severity === 'medium').length || 0,
        trends,
        behavioral_summary,
      },
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ report })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patient_id = searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('patient_id', patient_id!)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}
