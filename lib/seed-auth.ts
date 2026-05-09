import { NextRequest, NextResponse } from 'next/server'

/**
 * When SEED_SECRET is set in the environment, POST /api/seed must send:
 *   Authorization: Bearer <SEED_SECRET>
 * or
 *   x-seed-secret: <SEED_SECRET>
 * When unset (local hackathon / judge demos), seed remains open — document in README.
 */
export function seedUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Seed denied — set SEED_SECRET and send Authorization: Bearer … or x-seed-secret header.' },
    { status: 403 }
  )
}

export function assertSeedAllowed(req: NextRequest): NextResponse | null {
  const secret = process.env.SEED_SECRET?.trim()
  if (!secret) return null

  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = req.headers.get('x-seed-secret')?.trim() ?? ''

  if (bearer === secret || header === secret) return null
  return seedUnauthorizedResponse()
}
