import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Lightweight readiness probe for Vercel / load balancers.
 * Does not expose secrets; only confirms DB reachability.
 */
export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
  const hasKey = Boolean(
    (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim()
  )

  let dbOk = false
  if (hasUrl && hasKey) {
    const { error } = await supabase.from('patients').select('id').limit(1)
    dbOk = !error
  }

  const ok = hasUrl && hasKey && dbOk
  return NextResponse.json(
    {
      ok,
      status: ok ? 'healthy' : 'degraded',
      checks: {
        supabase_config: hasUrl && hasKey,
        supabase_query: dbOk,
      },
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}
