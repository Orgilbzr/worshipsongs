'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { ThemeToggle } from './theme-toggle'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // --------- INITIALS (эхний 2 үсэг) ---------
  function getInitials(nameOrEmail: string | null): string {
    if (!nameOrEmail) return ''
    const clean = nameOrEmail.trim()

    // Нэр 2 үгтэй бол
    const parts = clean.split(/\s+/)
    if (parts.length >= 2) {
      return (
        parts[0].charAt(0).toUpperCase() +
        parts[1].charAt(0).toUpperCase()
      )
    }

    // 1 үгтэй бол → эхний 2 үсэг
    if (parts.length === 1 && parts[0].length >= 2) {
      return (
        parts[0].charAt(0).toUpperCase() +
        parts[0].charAt(1).toUpperCase()
      )
    }

    // Нэр байхгүй бол → имэйл
    const email = clean.split('@')[0]
    if (email.length >= 2) {
      return (
        email.charAt(0).toUpperCase() +
        email.charAt(1).toUpperCase()
      )
    }

    return clean.charAt(0).toUpperCase()
  }

  // --------- profile нэр ачаалах ---------
  async function loadProfileName(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle() // мөр олдохгүй бол error биш

      if (error) {
        console.error('Profile query error:', error)
        setProfileName(null)
        return
      }

      if (!data) {
        setProfileName(null)
        return
      }

      setProfileName(data.full_name ?? null)
    } catch (e) {
      console.error('Unexpected profile error:', e)
      setProfileName(null)
    }
  }

  // --------- session + profile sync ---------
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.getSession()

        if (!ignore) {
          const sessionUser = data.session?.user ?? null
          setUser(sessionUser)

          if (sessionUser) {
            await loadProfileName(sessionUser.id)
          } else {
            setProfileName(null)
          }
        }

        setLoading(false)
      } catch (e) {
        if (!ignore) {
          setUser(null)
          setProfileName(null)
          setLoading(false)
        }
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return

      const sessionUser = session?.user ?? null
      setUser(sessionUser)

      if (sessionUser) {
        loadProfileName(sessionUser.id)
      } else {
        setProfileName(null)
      }

      setLoading(false)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  // --------- logout ---------
  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setProfileName(null)
    setOpen(false)
    router.push('/login')
    router.refresh()
  }

  function closeAndPush(path: string) {
    setOpen(false)
    router.push(path)
  }

  const displayName = profileName || user?.email || ''
  const initials = getInitials(displayName)

  return (
    <nav className="w-full sticky top-0 z-50 border-b border-slate-200 bg-white/90 text-slate-900 backdrop-blur
                    dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-50">
      <div className="px-4 py-3 flex items-center justify-between max-w-5xl mx-auto">
        {/* Logo */}
        <button
          onClick={() => closeAndPush('/')}
          className="font-bold text-lg text-slate-900 dark:text-slate-50"
        >
          GCCC магтан дууны сан
        </button>

        {/* Desktop menu */}
        <div className="hidden sm:flex items-center gap-4 text-sm">
          <button onClick={() => closeAndPush('/songs')} className="px-3 py-1 border border-slate-300 rounded text-xs font-medium">Дууны сан</button>

          <button onClick={() => closeAndPush('/songs/new')} className="px-3 py-1 border border-slate-300 rounded text-xs font-medium">Шинэ дуу нэмэх</button>

          <button onClick={() => closeAndPush('/setlists')} className="px-3 py-1 border border-slate-300 rounded text-xs font-medium">Жагсаалт үүсгэх</button>

          {/* MEMBERS menu */}
          <button onClick={() => closeAndPush('/members')} className="px-3 py-1 border border-slate-300 rounded text-xs font-medium">
            Магтаалын баг
          </button>

          {/* Profile / Login */}
          {loading ? (
            <span className="text-xs text-slate-500">Түр хүлээнэ үү…</span>
          ) : user ? (
            <>
              {/* INITIALS badge */}
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-[11px] font-semibold text-slate-900 dark:text-slate-50">
                {initials}
              </div>

              <button onClick={handleLogout} className="px-3 py-1 border border-slate-300 rounded text-xs font-medium">
                Гарах
              </button>
            </>
          ) : (
            <button onClick={() => closeAndPush('/login')} className="px-3 py-1 border border-slate-300 rounded text-xs font-medium">
              Нэвтрэх
            </button>
          )}

          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <div className="sm:hidden flex items-center gap-2">
          <ThemeToggle />
          <button className="inline-flex items-center justify-center w-8 h-8 border border-slate-300 rounded" onClick={() => setOpen(!open)}>
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t border-slate-200 bg-white/95 dark:bg-slate-900/95">
          <div className="px-4 py-3 space-y-2 text-sm">
            <button onClick={() => closeAndPush('/songs')} className="block w-full text-left px-3 py-2 border rounded">Дууны сан</button>
            <button onClick={() => closeAndPush('/songs/new')} className="block w-full text-left px-3 py-2 border rounded">Шинэ дуу нэмэх</button>
            <button onClick={() => closeAndPush('/setlists')} className="block w-full text-left px-3 py-2 border rounded">Жагсаалт үүсгэх</button>
            <button onClick={() => closeAndPush('/members')} className="block w-full text-left px-3 py-2 border rounded">Магтаалын баг</button>

            {loading ? (
              <p className="px-1 text-xs">Түр хүлээнэ үү…</p>
            ) : user ? (
              <>
                {/* Mobile initials */}
                <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>

                <button onClick={handleLogout} className="block w-full text-left px-3 py-2 border rounded">
                  Гарах
                </button>
              </>
            ) : (
              <button onClick={() => closeAndPush('/login')} className="block w-full text-left px-3 py-2 border rounded">
                Нэвтрэх
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}