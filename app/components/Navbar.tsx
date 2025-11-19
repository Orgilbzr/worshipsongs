'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let ignore = false

    async function loadUser() {
      setLoading(true)
      const { data } = await supabase.auth.getUser()
      if (!ignore) {
        setUser(data.user ?? null)
        setLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/login')
    router.refresh()
  }

  function closeAndPush(path: string) {
    setOpen(false)
    router.push(path)
  }

  return (
    <nav className="w-full sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="px-4 py-3 flex items-center justify-between max-w-5xl mx-auto text-slate-900">
        {/* Logo */}
        <button
          onClick={() => closeAndPush('/')}
          className="font-bold text-lg text-slate-900"
        >
          GCCC магтан дууны сан
        </button>

        {/* Desktop menu */}
        <div className="hidden sm:flex items-center gap-4 text-sm">
          <button
            onClick={() => closeAndPush('/songs')}
            className="px-3 py-1 border border-slate-300 rounded text-xs font-medium text-slate-900 hover:bg-slate-100"
          >
            Дууны сан
          </button>

          <button
            onClick={() => closeAndPush('/songs/new')}
            className="px-3 py-1 border border-slate-300 rounded text-xs font-medium text-slate-900 hover:bg-slate-100"
          >
            Шинэ дуу нэмэх
          </button>

          <button
            onClick={() => closeAndPush('/setlists')}
            className="px-3 py-1 border border-slate-300 rounded text-xs font-medium text-slate-900 hover:bg-slate-100"
          >
            Жагсаалт үүсгэх
          </button>

          {loading ? (
            <span className="text-xs text-slate-500">Түр хүлээнэ үү…</span>
          ) : user ? (
            <>
              <span className="text-xs text-slate-700">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 border border-slate-300 rounded text-xs font-medium text-slate-900 hover:bg-slate-100"
              >
                Гарах
              </button>
            </>
          ) : (
            <button
              onClick={() => closeAndPush('/login')}
              className="px-3 py-1 border border-slate-300 rounded text-xs font-medium text-slate-900 hover:bg-slate-100"
            >
              Нэвтрэх
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden inline-flex items-center justify-center w-8 h-8 border border-slate-300 rounded text-xs text-slate-900"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t border-slate-200 bg-white/95">
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-2 text-sm text-slate-900">
            <button
              onClick={() => closeAndPush('/songs')}
              className="block w-full text-left px-3 py-2 border border-slate-300 rounded text-xs font-medium hover:bg-slate-100"
            >
              Дууны сан
            </button>

            <button
              onClick={() => closeAndPush('/songs/new')}
              className="block w-full text-left px-3 py-2 border border-slate-300 rounded text-xs font-medium hover:bg-slate-100"
            >
              Шинэ дуу нэмэх
            </button>

            <button
              onClick={() => closeAndPush('/setlists')}
              className="block w-full text-left px-3 py-2 border border-slate-300 rounded text-xs font-medium hover:bg-slate-100"
            >
              Жагсаалт үүсгэх
            </button>

            {loading ? (
              <p className="text-xs text-slate-500 px-1">
                Түр хүлээнэ үү…
              </p>
            ) : user ? (
              <>
                <p className="text-xs text-slate-700 px-1">
                  {user.email}
                </p>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 border border-slate-300 rounded text-xs font-medium hover:bg-slate-100"
                >
                  Гарах
                </button>
              </>
            ) : (
              <button
                onClick={() => closeAndPush('/login')}
                className="block w-full text-left px-3 py-2 border border-slate-300 rounded text-xs font-medium hover:bg-slate-100"
              >
                Нэвтрэх
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}