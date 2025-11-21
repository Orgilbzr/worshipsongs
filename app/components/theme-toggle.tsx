// components/theme-toggle.tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const currentTheme = theme === 'system' ? systemTheme : theme
  const isDark = currentTheme === 'dark'

  function handleToggle() {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm
                 border-slate-300 bg-slate-100 hover:bg-slate-200
                 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
    >
      {isDark ? 'Light mode' : 'Dark mode'}
      <span aria-hidden="true">{isDark ? '🌞' : '🌙'}</span>
    </button>
  )
}