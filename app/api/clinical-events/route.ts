import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/validation'

const EVENT_TYPES = [
  'medication_change',
  'symptom',
  'stress',
  'illness',
  'travel',
  'lifestyle',
  'other',
] as const

export async function GET(req: NextRequest) {
  const patient_id = new URL(req.url).searchParams.get('patient_id')
  if (!patient_id) return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const { data, error } = await supabase
    .from('patient_clinical_events')
    .select('*')
    .eq('patient_id', patient_id)
    .order('occurred_at', { ascending: false })
    .limit(80)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const patient_id = body.patient_id as string
    const event_type = body.event_type as string
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) : null
    const occurred_at =
      typeof body.occurred_at === 'string' && body.occurred_at ? body.occurred_at : new Date().toISOString()

    if (!patient_id || !isUuid(patient_id)) {
      return NextResponse.json({ error: 'valid patient_id required' }, { status: 400 })
    }
    if (!EVENT_TYPES.includes(event_type as (typeof EVENT_TYPES)[number])) {
      return NextResponse.json({ error: `event_type must be one of: ${EVENT_TYPES.join(', ')}` }, { status: 400 })
    }
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const { data, error } = await supabase
      .from('patient_clinical_events')
      .insert({
        patient_id,
        event_type,
        title,
        notes,
        occurred_at,
        metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {},
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
