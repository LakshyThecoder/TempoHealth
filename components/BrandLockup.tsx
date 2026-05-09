import Link from 'next/link'

/**
 * TempoHealth × Boston Study Tour Hackathon Challenge — unified brand lockup.
 */
export function BrandLockup({
  href = '/',
  size = 'md',
  subtitle = true,
}: {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  subtitle?: boolean
}) {
  const icon =
    size === 'sm' ? 'w-7 h-7 text-[10px] rounded-lg' : size === 'lg' ? 'w-11 h-11 text-base rounded-2xl' : 'w-9 h-9 text-sm rounded-xl'
  const title = size === 'sm' ? 'text-[14px]' : size === 'lg' ? 'text-xl' : 'text-[15px]'
  const sub = size === 'sm' ? 'text-[8px]' : 'text-[9px]'

  const inner = (
    <>
      <div
        className={`${icon} flex items-center justify-center text-white font-black shrink-0 shadow-lg`}
        style={{
          background: 'linear-gradient(145deg, #0d9488 0%, #2563eb 48%, #7c3aed 100%)',
          boxShadow: '0 8px 32px rgba(13,148,136,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset',
        }}
      >
        T
      </div>
      <div className="min-w-0 flex flex-col gap-0">
        <span className={`font-bold ${title} tracking-tight truncate`} style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
          Tempo<span className="gt-bst">Health</span>
        </span>
        {subtitle && (
          <span className={`brand-bst-sub ${sub} font-bold uppercase tracking-[0.22em] truncate hidden md:block`}>
            Boston Study Tour · Hackathon Challenge
          </span>
        )}
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2.5 min-w-0 group">
        {inner}
      </Link>
    )
  }
  return <div className="flex items-center gap-2.5 min-w-0">{inner}</div>
}

export function HackathonRibbon({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md ${className}`}
      style={{
        borderColor: 'rgba(45, 212, 191, 0.35)',
        background: 'linear-gradient(135deg, rgba(13,148,136,0.2) 0%, rgba(37,99,235,0.12) 50%, rgba(124,58,237,0.1) 100%)',
        boxShadow: '0 0 40px rgba(45, 212, 191, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-40" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400 shadow-[0_0_12px_#2dd4bf]" />
      </span>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-200/95">Boston Study Tour</span>
      <span className="w-px h-3 bg-white/15 hidden sm:block" aria-hidden />
      <span className="text-[10px] font-semibold tracking-wide text-white/90 hidden sm:inline">Hackathon Challenge</span>
    </div>
  )
}
