import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { clampInt, isUuid } from '@/lib/validation'
import { computePhysiologicalStability } from '@/lib/stability-score'
import { inferLightPhenotype } from '@/lib/phenotype'
import { computeRecoveryTrend } from '@/lib/recovery-trend'
import { correlateEventsWithSignals } from '@/lib/event-correlation'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patient_id = searchParams.get('patient_id')
  const days = clampInt(parseInt(searchParams.get('days') || '30', 10), 14, 90, 30)

  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const since = new Date()
  since.setDate(since.getDate() - days)

  const [{ data: readings, error: rErr }, { data: baselineRows }, { data: events }] = await Promise.all([
    supabase
      .from('wearable_readings')
      .select('*')
      .eq('patient_id', patient_id)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true }),
    supabase.from('baselines').select('metric, rolling_mean, rolling_std').eq('patient_id', patient_id),
    supabase
      .from('patient_clinical_events')
      .select('id, event_type, title, notes, occurred_at')
      .eq('patient_id', patient_id)
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(40),
  ])

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

  const baselines = Object.fromEntries(
    (baselineRows || []).map(b => [b.metric, { mean: b.rolling_mean, std: b.rolling_std }])
  )

  const stability = computePhysiologicalStability(readings || [], baselines, days)
  const phenotype = inferLightPhenotype(readings || [])
  const recovery = computeRecoveryTrend(readings || [])

  const hrvSeries = (readings || [])
    .map(r => ({
      recorded_at: r.recorded_at,
      value: typeof r.hrv_ms === 'number' ? r.hrv_ms : NaN,
    }))
    .filter(x => !Number.isNaN(x.value))

  const correlationHints =
    events && hrvSeries.length >= 5
      ? correlateEventsWithSignals(events, hrvSeries, 'hrv_ms', 4)
      : []

  return NextResponse.json({
    stability,
    phenotype,
    recovery,
    correlation_hints: correlationHints,
    reading_days: (readings || []).length,
  })
}
