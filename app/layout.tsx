import type { Metadata } from 'next'
import './globals.css'
import Navbar from './components/Navbar'
import { AppThemeProvider } from './components/theme-provider'

export const metadata: Metadata = {
  title: 'Worship Songs',
  description: 'GCCC магтан дууны сан',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <AppThemeProvider>
          <Navbar />
          <main className="max-w-5xl mx-auto px-4 py-6">
            {children}
          </main>
        </AppThemeProvider>
      </body>
    </html>
  )
}