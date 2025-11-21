'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type Setlist = {
  id: string
  name: string
  date: string | null
  created_at: string
}

export default function SetlistsPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ---------------- ХЭРЭГЛЭГЧ АЧААЛАХ ----------------
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      try {
        setLoadingUser(true)
        const { data, error } = await supabase.auth.getSession()

        if (error) console.error('Auth session load error:', error)

        if (!ignore) {
          setUser(data.session?.user ?? null)
          setLoadingUser(false)
        }
      } catch (e) {
        console.error('Unexpected auth error:', e)
        if (!ignore) {
          setUser(null)
          setLoadingUser(false)
        }
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ignore) {
        setUser(session?.user ?? null)
        setLoadingUser(false)
      }
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  // ---------------- СЕТЛИСТҮҮД АЧААЛАХ ----------------
  useEffect(() => {
    if (!user) {
      setSetlists([])
      setLoading(false)
      return
    }

    let ignore = false

    async function loadSetlists() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('setlists')
        .select('id, name, date, created_at')
        .order('date', { ascending: false })

      if (ignore) return

      if (error) {
        console.error(error)
        setError(error.message)
        setSetlists([])
      } else {
        setSetlists((data ?? []) as Setlist[])
      }

      setLoading(false)
    }

    loadSetlists()
    return () => {
      ignore = true
    }
  }, [user])

  // ---------------- СЕТЛИСТ УСТГАХ ----------------
  async function handleDeleteSetlist(setlist: Setlist) {
    if (
      !window.confirm(
        `"${setlist.name}" жагсаалтыг бүрмөсөн устгах уу? (Доторх холбоосууд устна, дуунууд өөрсдөө үлдэнэ.)`,
      )
    ) {
      return
    }

    setDeletingId(setlist.id)
    setError(null)

    try {
      const { error: e1 } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('setlist_id', setlist.id)

      if (e1) throw e1

      const { error: e2 } = await supabase
        .from('setlists')
        .delete()
        .eq('id', setlist.id)

      if (e2) throw e2

      setSetlists((prev) => prev.filter((s) => s.id !== setlist.id))
      setDeletingId(null)
    } catch (e) {
      console.error(e)
      setError('Жагсаалтыг устгах үед алдаа гарлаа.')
      setDeletingId(null)
    }
  }

  // ---------------- RENDER ----------------

  if (loadingUser) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Хэрэглэгчийн мэдээлэл ачаалж байна…
      </p>
    )
  }

  if (!user) {
    return (
      <div className="space-y-3 max-w-md">
        <h1 className="text-2xl font-semibold">Жагсаалтууд</h1>
        <p className="text-sm text-red-500 dark:text-red-400">
          Энэ хуудсыг үзэхийн тулд нэвтэрнэ үү.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="
            inline-flex items-center justify-center
            px-3 py-1 text-xs font-medium rounded border
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700
          "
        >
          Нэвтрэх хуудас руу очих
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Жагсаалтууд</h1>
        <button
          onClick={() => router.push('/setlists/new')}
          className="
            inline-flex items-center justify-center
            px-3 py-1 text-xs font-medium rounded border
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700
          "
        >
          Шинэ жагсаалт
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">
          Алдаа: {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Жагсаалтууд ачаалж байна…
        </p>
      ) : setlists.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Одоогоор сетлист байхгүй байна.
        </p>
      ) : (
        <div className="space-y-2">
          {setlists.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/setlists/${s.id}`)}
              className="
                group flex items-center justify-between px-4 py-3 rounded border cursor-pointer
                border-slate-200 bg-[var(--background)]
                hover:bg-slate-900 dark:hover:bg-slate-800
                dark:border-slate-700
              "
            >
              <div className="flex-1">
                <div
                  className="
                    font-medium text-[var(--foreground)]
                    group-hover:text-slate-50
                  "
                >
                  {s.name}
                </div>
                <div
                  className="
                    text-xs text-slate-600 dark:text-slate-400
                    group-hover:text-slate-200
                  "
                >
                  {s.date || ''}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteSetlist(s)
                }}
                disabled={deletingId === s.id}
                className="
                  ml-3 px-3 py-1 text-xs font-medium rounded border
                  border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700
                  disabled:opacity-50
                  dark:border-red-500 dark:text-red-400 dark:hover:bg-red-900/30
                "
              >
                {deletingId === s.id ? 'Устгаж байна…' : 'Устгах'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}