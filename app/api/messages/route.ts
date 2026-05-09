import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/validation'

/** Care-team thread between clinician view and patient view (demo — no auth). */
export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patient_id')
  if (!patientId) {
    return NextResponse.json({ error: 'patient_id required' }, { status: 400 })
  }
  if (!isUuid(patientId)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })

  const { data, error } = await supabase
    .from('care_messages')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const patient_id = body.patient_id as string
    const author_role = body.author_role as 'clinician' | 'patient'
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    const topic = typeof body.topic === 'string' ? body.topic.trim() : 'general'

    if (!patient_id || !text || (author_role !== 'clinician' && author_role !== 'patient')) {
      return NextResponse.json({ error: 'patient_id, author_role (clinician|patient), body required' }, { status: 400 })
    }
    if (!isUuid(patient_id)) return NextResponse.json({ error: 'patient_id must be a valid UUID' }, { status: 400 })
    if (text.length > 4000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('care_messages')
      .insert({ patient_id, author_role, body: text, topic: topic || 'general' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
