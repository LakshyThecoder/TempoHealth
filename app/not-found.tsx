import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      <div className="max-w-md text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white font-black text-lg mx-auto"
          style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
          T
        </div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
          Page not found
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
          That link may be wrong or the patient record was removed. Return home and open a dashboard from the landing page.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center btn btn-primary text-sm px-6 py-2.5 rounded-xl"
        >
          Back to TempoHealth
        </Link>
      </div>
    </div>
  )
}
