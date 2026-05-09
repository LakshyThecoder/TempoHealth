/** Loose UUID check for route params (Supabase uses uuid). */
export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())
}

export function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}
