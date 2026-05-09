import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { clampInt, isUuid } from '@/lib/validation'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patient_id = searchParams.get('patient_id')
  const days = clampInt(parseInt(searchParams.get('days') || '30', 10), 1, 365, 30)

  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: readings, error } = await supabase
    .from('wearable_readings')
    .select('*')
    .eq('patient_id', patient_id)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: baselines } = await supabase
    .from('baselines')
    .select('*')
    .eq('patient_id', patient_id)

  const baselineMap = Object.fromEntries(
    (baselines || []).map(b => [b.metric, { mean: b.rolling_mean, std: b.rolling_std }])
  )

  return NextResponse.json({ readings, baselines: baselineMap })
}
