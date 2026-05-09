import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Providers } from './providers'
import './globals.css'

/** Display headings use `--font-display` from globals (system serif stack). Avoids build-time fetch to Google Fonts (offline / locked-down CI). To use Fraunces again: `next/font/google` + network at build time. */

export const metadata: Metadata = {
  title: 'TempoHealth — Boston Study Tour Hackathon Challenge',
  description:
    'Boston Study Tour Hackathon Challenge submission — AI-powered wearable-to-clinical intelligence: personalized anomaly detection, human-in-the-loop learning, RAG-grounded context, and clinician-ready Pre-Visit Briefs.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
