// components/theme-provider.tsx
'use client'

import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function AppThemeProvider({ children }: Props) {
  return (
    <ThemeProvider
      attribute="class"       // <html class="dark"> гэх мэт
      defaultTheme="system"   // анхдагч – системийн theme
      enableSystem
    >
      {children}
    </ThemeProvider>
  )
}