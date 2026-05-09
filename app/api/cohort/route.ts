import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { subDays } from 'date-fns'
import { clampInt, isUuid } from '@/lib/validation'

function percentileRank(value: number, sortedAsc: number[]): number {
  if (!sortedAsc.length) return 50
  let below = 0
  for (const v of sortedAsc) {
    if (v < value) below++
    else break
  }
  return Math.round((below / sortedAsc.length) * 100)
}

/** Cohort analytics for FitBit-imported subjects (same data_source). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patient_id = searchParams.get('patient_id')
  const days = clampInt(parseInt(searchParams.get('days') || '14', 10), 1, 90, 14)

  if (patient_id && !isUuid(patient_id)) {
    return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })
  }

  const since = subDays(new Date(), days)

  const { data: cohortPatients, error: pErr } = await supabase
    .from('patients')
    .select('id, name, external_subject_id')
    .eq('data_source', 'fitbit_kaggle')

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!cohortPatients?.length) {
    return NextResponse.json({
      cohort_size: 0,
      message: 'Import FitBit cohort first (scripts/import-fitbit.ts)',
      percentiles: null,
      sedentary_burden_index: null,
      rhythm_stability: null,
    })
  }

  const ids = cohortPatients.map(p => p.id)

  const { data: readings, error: rErr } = await supabase
    .from('wearable_readings')
    .select('patient_id, recorded_at, steps, sleep_duration_min, sedentary_min, very_active_min')
    .in('patient_id', ids)
    .gte('recorded_at', since.toISOString())

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

  type Agg = { steps: number[]; sleep: number[]; sed: number[]; active: number[] }
  const byPatient = new Map<string, Agg>()

  for (const r of readings || []) {
    const pid = r.patient_id as string
    if (!byPatient.has(pid)) {
      byPatient.set(pid, { steps: [], sleep: [], sed: [], active: [] })
    }
    const g = byPatient.get(pid)!
    if (r.steps != null) g.steps.push(Number(r.steps))
    if (r.sleep_duration_min != null) g.sleep.push(Number(r.sleep_duration_min))
    if (r.sedentary_min != null) g.sed.push(Number(r.sedentary_min))
    if (r.very_active_min != null) g.active.push(Number(r.very_active_min))
  }

  const means = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

  const cohortSteps: number[] = []
  const cohortSleep: number[] = []
  const cohortSed: number[] = []

  const subjectStats: Record<
    string,
    { mean_steps: number | null; mean_sleep_min: number | null; mean_sedentary_min: number | null }
  > = {}

  for (const p of cohortPatients) {
    const g = byPatient.get(p.id)
    const ms = g ? means(g.steps) : null
    const sl = g ? means(g.sleep) : null
    const sd = g ? means(g.sed) : null
    subjectStats[p.id] = {
      mean_steps: ms,
      mean_sleep_min: sl,
      mean_sedentary_min: sd,
    }
    if (ms != null) cohortSteps.push(ms)
    if (sl != null) cohortSleep.push(sl)
    if (sd != null) cohortSed.push(sd)
  }

  cohortSteps.sort((a, b) => a - b)
  cohortSleep.sort((a, b) => a - b)
  cohortSed.sort((a, b) => a - b)

  let percentiles: {
    steps?: number
    sleep_duration_min?: number
    sedentary_min?: number
  } | null = null

  let sedentary_burden_index: 'low' | 'moderate' | 'high' | null = null
  let rhythm_stability: number | null = null

  if (patient_id && subjectStats[patient_id]) {
    const st = subjectStats[patient_id]
    percentiles = {}
    if (st.mean_steps != null && cohortSteps.length) {
      percentiles.steps = percentileRank(st.mean_steps, cohortSteps)
    }
    if (st.mean_sleep_min != null && cohortSleep.length) {
      percentiles.sleep_duration_min = percentileRank(st.mean_sleep_min, cohortSleep)
    }
    if (st.mean_sedentary_min != null && cohortSed.length) {
      percentiles.sedentary_min = percentileRank(st.mean_sedentary_min, cohortSed)
    }

    const sed = st.mean_sedentary_min
    if (sed != null) {
      if (sed >= 850) sedentary_burden_index = 'high'
      else if (sed >= 650) sedentary_burden_index = 'moderate'
      else sedentary_burden_index = 'low'
    }

    const g = byPatient.get(patient_id)
    if (g && g.active.length >= 7) {
      const meanA = means(g.active)!
      const variance =
        g.active.reduce((a, v) => a + Math.pow(v - meanA, 2), 0) / g.active.length
      const cv = meanA > 0 ? Math.sqrt(variance) / meanA : 0
      rhythm_stability = Math.max(0, Math.min(100, Math.round((1 - Math.min(cv, 1)) * 100)))
    }
  }

  return NextResponse.json({
    cohort_size: cohortPatients.length,
    window_days: days,
    percentiles,
    subject_means: patient_id ? subjectStats[patient_id] : null,
    sedentary_burden_index,
    rhythm_stability,
    cohort_reference: 'FitBit Fitness Tracker Data (Fitabase export, CC0)',
  })
}
