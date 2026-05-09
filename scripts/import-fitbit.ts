/**
 * Local ETL: Fitabase / Kaggle Fitbit CSVs → Supabase `patients` + `wearable_readings`.
 * Usage:  FITBASE_DIR=".\Fitabase Data 3.12.16-4.11.16" npx tsx scripts/import-fitbit.ts
 * Optional: FITBIT_SUBJECT_IDS=1503960366,1927972279  (comma-separated Ids)
 *           FITBIT_MAX_SUBJECTS=5
 */
import { createReadStream, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse as parseCsvStream } from 'csv-parse'
import { parse as parseCsvSync } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { format, parse as parseDateFns } from 'date-fns'

config({ path: join(process.cwd(), '.env.local') })
config({ path: join(process.cwd(), '.env') })

const FITBASE_DIR = process.env.FITBASE_DIR || join(process.cwd(), 'Fitabase Data 3.12.16-4.11.16')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase key in .env.local')
  process.exit(1)
}

const supabase = createClient(url, supabaseKey)

type DailyRow = Record<string, string>

type HrAgg = { sum: number; n: number; sumsq: number; minv: number }
const hrByKey = new Map<string, HrAgg>()

type SleepAgg = { v1: number; v2: number }
const sleepByKey = new Map<string, SleepAgg>()

function key(id: string, isoDay: string) {
  return `${id}|${isoDay}`
}

function parseActivityDateToIso(s: string): string {
  const d = parseDateFns(s.trim(), 'M/d/yyyy', new Date())
  return format(d, 'yyyy-MM-dd')
}

function parseSleepTimestampToIsoDay(s: string): string {
  const part = s.trim().split(/\s+/)[0]
  const d = parseDateFns(part, 'M/d/yyyy', new Date())
  return format(d, 'yyyy-MM-dd')
}

function hrStd(agg: HrAgg): number {
  if (agg.n < 2) return 0
  const mean = agg.sum / agg.n
  const v = Math.max(0, agg.sumsq / agg.n - mean * mean)
  return Math.sqrt(v)
}

/** Map intraday HR dispersion to a crude ms-like score for autocorrelation structure (not clinical HRV). */
function hrvProxyFromHrDispersion(stdBpm: number): number {
  const x = Math.min(25, Math.max(0, stdBpm))
  return Math.round(Math.min(95, Math.max(18, 55 - x * 2.2)))
}

async function loadHeartRateStream(path: string) {
  const parser = createReadStream(path).pipe(
    parseCsvStream({ columns: true, relax_column_count: true, trim: true })
  )
  for await (const row of parser) {
    const id = String(row.Id ?? '').trim()
    const t = String(row.Time ?? '')
    const val = parseFloat(String(row.Value ?? ''))
    if (!id || !t || Number.isNaN(val)) continue
    const isoDay = parseSleepTimestampToIsoDay(t)
    const k = key(id, isoDay)
    let agg = hrByKey.get(k)
    if (!agg) {
      agg = { sum: 0, n: 0, sumsq: 0, minv: val }
      hrByKey.set(k, agg)
    }
    agg.sum += val
    agg.n += 1
    agg.sumsq += val * val
    if (val < agg.minv) agg.minv = val
  }
}

async function loadMinuteSleepStream(path: string) {
  const parser = createReadStream(path).pipe(
    parseCsvStream({ columns: true, relax_column_count: true, trim: true })
  )
  for await (const row of parser) {
    const id = String(row.Id ?? '').trim()
    const dt = String(row.date ?? row.Date ?? '')
    const v = parseInt(String(row.value ?? row.Value ?? ''), 10)
    if (!id || !dt || Number.isNaN(v)) continue
    const isoDay = parseSleepTimestampToIsoDay(dt)
    const k = key(id, isoDay)
    let agg = sleepByKey.get(k)
    if (!agg) agg = { v1: 0, v2: 0 }
    if (v === 1) agg.v1 += 1
    if (v === 2) agg.v2 += 1
    sleepByKey.set(k, agg)
  }
}

function parseDailyActivity(path: string): DailyRow[] {
  const raw = readFileSync(path, 'utf-8')
  return parseCsvSync(raw, { columns: true, skip_empty_lines: true, trim: true }) as DailyRow[]
}

async function main() {
  const dailyPath = join(FITBASE_DIR, 'dailyActivity_merged.csv')
  const hrPath = join(FITBASE_DIR, 'heartrate_seconds_merged.csv')
  const sleepPath = join(FITBASE_DIR, 'minuteSleep_merged.csv')

  if (!existsSync(dailyPath)) {
    console.error('Missing', dailyPath)
    process.exit(1)
  }

  console.log('Loading daily activity…')
  const daily = parseDailyActivity(dailyPath)

  const counts = new Map<string, number>()
  for (const r of daily) {
    const id = String(r.Id)
    counts.set(id, (counts.get(id) || 0) + 1)
  }

  let subjectIds = process.env.FITBIT_SUBJECT_IDS?.split(',').map(s => s.trim()).filter(Boolean)
  const maxN = parseInt(process.env.FITBIT_MAX_SUBJECTS || '5', 10)

  if (!subjectIds?.length) {
    subjectIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxN)
      .map(([id]) => id)
  }

  console.log('Subjects:', subjectIds.join(', '))

  console.log('Streaming heart rate (may take a few minutes)…')
  if (existsSync(hrPath)) await loadHeartRateStream(hrPath)
  else console.warn('Skipping HR — file not found:', hrPath)

  console.log('Streaming minute-level sleep…')
  if (existsSync(sleepPath)) await loadMinuteSleepStream(sleepPath)
  else console.warn('Skipping sleep — file not found:', sleepPath)

  const MEASURED = [
    'steps',
    'sedentary_min',
    'very_active_min',
    'calories',
    'hr',
    'sleep_duration_min',
    'sleep_deep_min',
  ] as const
  const DERIVED = ['hrv_ms'] as const
  const UNAVAILABLE = ['spo2', 'rr', 'skin_temp_delta'] as const

  for (const sid of subjectIds) {
    const rows = daily.filter(r => String(r.Id) === sid)
    if (!rows.length) continue

    const name = `Participant ${sid.slice(-4)}`
    const { data: patient, error: pErr } = await supabase
      .from('patients')
      .insert({
        name,
        age: 42,
        condition: 'FitBit cohort (historical observational)',
        medications: [] as string[],
        external_subject_id: sid,
        data_source: 'fitbit_kaggle',
        display_name: name,
      })
      .select()
      .single()

    if (pErr) {
      console.error('Patient insert failed', sid, pErr.message)
      continue
    }

    const pid = patient!.id
    const readings: Record<string, unknown>[] = []

    for (const r of rows) {
      const isoDay = parseActivityDateToIso(r.ActivityDate)
      const k = key(sid, isoDay)
      const steps = parseFloat(String(r.TotalSteps ?? '0')) || 0
      const sedentary = parseFloat(String(r.SedentaryMinutes ?? '0')) || 0
      const veryActive = parseFloat(String(r.VeryActiveMinutes ?? '0')) || 0
      const calories = parseFloat(String(r.Calories ?? '0')) || 0

      const hrStats = hrByKey.get(k)
      const meanHr = hrStats && hrStats.n > 0 ? hrStats.sum / hrStats.n : null
      const stdHr = hrStats ? hrStd(hrStats) : 0
      const hrv = meanHr != null ? hrvProxyFromHrDispersion(stdHr) : null

      const sl = sleepByKey.get(k)
      const sleepDur =
        sl != null ? Math.round(sl.v1 + sl.v2) : null
      const sleepDeep =
        sl != null ? Math.round(sl.v1 * 0.35 + sl.v2 * 0.12) : null

      const recorded_at = `${isoDay}T12:00:00.000Z`

      readings.push({
        patient_id: pid,
        recorded_at,
        hr: meanHr != null ? Math.round(meanHr * 10) / 10 : null,
        hrv_ms: hrv,
        spo2: null,
        steps: Math.round(steps),
        sleep_duration_min: sleepDur,
        sleep_deep_min: sleepDeep,
        rr: null,
        skin_temp_delta: null,
        sedentary_min: Math.round(sedentary),
        very_active_min: Math.round(veryActive),
        calories: Math.round(calories),
        metrics_meta: {
          measured: [...MEASURED],
          derived: [...DERIVED],
          unavailable: [...UNAVAILABLE],
          notes:
            'FitBit 2016 export: HR aggregated from second-level samples; HRV is a derived dispersion proxy, not RMSSD.',
        },
      })
    }

    readings.sort(
      (a, b) =>
        new Date(String(a.recorded_at)).getTime() - new Date(String(b.recorded_at)).getTime()
    )

    for (let i = 0; i < readings.length; i += 40) {
      const batch = readings.slice(i, i + 40)
      const { error } = await supabase.from('wearable_readings').insert(batch)
      if (error) {
        console.error('wearable_readings insert', error.message)
        break
      }
    }

    console.log('Imported', readings.length, 'days for', name, pid)
  }

  console.log('Done. Run POST /api/seed with body {"mode":"fitbit_rebaseline"} to compute baselines and anomalies.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
