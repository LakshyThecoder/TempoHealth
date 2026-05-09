import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeClinicalInsights } from '@/lib/clinical-patterns'
import { clampInt, isUuid } from '@/lib/validation'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patient_id = searchParams.get('patient_id')
  const days = clampInt(parseInt(searchParams.get('days') || '30', 10), 14, 90, 30)

  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: readings, error: rErr } = await supabase
    .from('wearable_readings')
    .select('*')
    .eq('patient_id', patient_id)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

  const { data: baselineRows } = await supabase
    .from('baselines')
    .select('metric, rolling_mean, rolling_std')
    .eq('patient_id', patient_id)

  const baselines = Object.fromEntries(
    (baselineRows || []).map(b => [b.metric, { mean: b.rolling_mean, std: b.rolling_std }])
  )

  const insight = computeClinicalInsights(readings || [], baselines)

  return NextResponse.json({
    insight,
    reading_days: (readings || []).length,
  })
}
