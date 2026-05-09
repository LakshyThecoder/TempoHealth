'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Sparkles, LayoutGrid, ChevronRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BrandLockup } from '@/components/BrandLockup'

const nav = [
  { href: '/dashboard', label: 'Patients', icon: Users, match: (p: string) => p === '/dashboard' },
  {
    href: '/dashboard/nurse',
    label: 'AI Nurse',
    icon: Sparkles,
    match: (p: string) => p.startsWith('/dashboard/nurse'),
  },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isPatientDetail = pathname.startsWith('/dashboard/') && pathname !== '/dashboard' && !pathname.startsWith('/dashboard/nurse')

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: 'var(--bg)' }}>
      <div className="kg-accent-bar md:hidden" aria-hidden />
      <aside
        className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-b md:border-b-0 md:border-r sticky top-0 md:h-screen md:sticky"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="kg-accent-bar" aria-hidden />
        <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
          <BrandLockup href="/" size="md" subtitle />
          <p className="text-[10px] font-semibold uppercase tracking-wider truncate pl-0.5" style={{ color: 'var(--text-3)' }}>
            Care hub · patient management
          </p>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {nav.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'kg-tab-active' : ''
                }`}
                style={{
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  background: active ? 'var(--bg-card)' : 'transparent',
                  border: active ? '1px solid var(--border-2)' : '1px solid transparent',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: active ? 'var(--kg-accent)' : undefined }} />
                {label}
              </Link>
            )
          })}
        </nav>

      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden kg-dash-header sticky top-0 z-40 flex flex-col">
        <div className="flex items-center justify-between px-4 h-12 gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--text)' }}>
            <LayoutGrid className="w-4 h-4" style={{ color: 'var(--kg-accent)' }} />
            Care hub
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex gap-1 px-2 pb-2 overflow-x-auto">
          <Link
            href="/dashboard"
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              pathname === '/dashboard' ? 'bg-white/10' : ''
            }`}
            style={{ color: pathname === '/dashboard' ? 'var(--text)' : 'var(--text-2)' }}
          >
            Patients
          </Link>
          <Link
            href="/dashboard/nurse"
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              pathname.startsWith('/dashboard/nurse') ? 'bg-white/10' : ''
            }`}
            style={{ color: pathname.startsWith('/dashboard/nurse') ? 'var(--text)' : 'var(--text-2)' }}
          >
            AI Nurse
          </Link>
          {isPatientDetail && (
            <span className="shrink-0 px-3 py-1.5 text-xs font-medium flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <ChevronRight className="w-3 h-3" />
              Record
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex kg-dash-header h-12 items-center justify-end px-6 shrink-0 gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <ThemeToggle />
          <Link href="/" className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            Home
          </Link>
          <Link href="/practice" className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            Table roster
          </Link>
        </header>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 md:py-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
