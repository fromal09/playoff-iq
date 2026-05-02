import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Playoff IQ — NBA Playoff Database',
  description: 'Every NBA playoff game since 1947. Game Score analytics, GOAT rankings, career records.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav/>
        <main style={{ minHeight:'calc(100vh - 54px)' }}>{children}</main>
      </body>
    </html>
  )
}
