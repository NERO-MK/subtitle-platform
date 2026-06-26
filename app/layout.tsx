import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SubMM — Subtitle Translator',
  description: 'Chinese Donghua subtitle translator to Myanmar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="my">
      <body>{children}</body>
    </html>
  )
}
