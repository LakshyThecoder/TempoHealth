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
        className={`${icon} flex items-center justify-center text-white font-black shrink-0`}
        style={{
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          boxShadow: '0 4px 24px rgba(37,99,235,0.28), inset 0 1px 0 rgba(255,255,255,0.12)',
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
        borderColor: 'rgba(99, 102, 241, 0.35)',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(124,58,237,0.12) 100%)',
        boxShadow: '0 0 32px rgba(59, 130, 246, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-35" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" style={{ boxShadow: '0 0 10px rgba(96,165,250,0.8)' }} />
      </span>
      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#93c5fd' }}>
        Boston Study Tour
      </span>
      <span className="w-px h-3 bg-white/15 hidden sm:block" aria-hidden />
      <span className="text-[10px] font-semibold tracking-wide text-slate-200/95 hidden sm:inline">Hackathon Challenge</span>
    </div>
  )
}
