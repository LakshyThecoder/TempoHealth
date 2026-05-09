import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/validation'
import { isCareStatus } from '@/lib/care-status'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = body.id as string
    if (!id || !isUuid(id)) return NextResponse.json({ error: 'valid id (UUID) required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if ('chart_notes' in body) {
      if (body.chart_notes === null) updates.chart_notes = null
      else if (typeof body.chart_notes === 'string') updates.chart_notes = body.chart_notes.slice(0, 8000)
    }
    if (typeof body.care_status === 'string' && isCareStatus(body.care_status)) updates.care_status = body.care_status

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update (chart_notes, care_status)' }, { status: 400 })
    }

    const { data, error } = await supabase.from('patients').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ patient: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    if (!isUuid(id)) return NextResponse.json({ error: 'id must be a valid UUID' }, { status: 400 })
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ patient: null }, { status: 404 })
    return NextResponse.json({ patient: data })
  }

  const { data, error } = await supabase.from('patients').select(
    'id, name, condition, age, data_source, external_subject_id, display_name'
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ patients: data })
}
