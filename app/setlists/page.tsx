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

  // Хэрэглэгч
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      if (!ignore) {
        setUser(data.user ?? null)
        setLoadingUser(false)
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

  // Сетлистүүд
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

  async function handleDeleteSetlist(setlist: Setlist) {
    if (
      !window.confirm(
        `"${setlist.name}" жагсаалтыг бүрмөсөн устгах уу? (Жагсаалтын доторх холбоосууд бүгд устна, дуунууд өөрсдөө үлдэнэ.)`
      )
    ) {
      return
    }

    setDeletingId(setlist.id)
    setError(null)

    try {
      // Эхлээд setlist_songs
      const { error: e1 } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('setlist_id', setlist.id)

      if (e1) {
        console.error(e1)
        throw e1
      }

      // Дараа нь setlists
      const { error: e2 } = await supabase
        .from('setlists')
        .delete()
        .eq('id', setlist.id)

      if (e2) {
        console.error(e2)
        throw e2
      }

      // Local state-ээс авч хаяна
      setSetlists((prev) => prev.filter((s) => s.id !== setlist.id))
      setDeletingId(null)
    } catch (e) {
      setError('Жагсаалтыг устгах үед алдаа гарлаа.')
      setDeletingId(null)
    }
  }

  if (loadingUser) {
    return <p>Хэрэглэгчийн мэдээлэл ачаалж байна…</p>
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Жагсаалтууд</h1>
        <p className="text-sm text-red-500">
          Энэ хуудсыг үзэхийн тулд нэвтэрнэ үү.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 rounded bg-black text-white text-sm"
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
          className="px-4 py-2 rounded bg-white text-black text-sm font-medium"
        >
          Шинэ жагсаалт
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">
          Алдаа: {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">
          Жагсаалтууд ачаалж байна…
        </p>
      ) : setlists.length === 0 ? (
        <p className="text-sm text-gray-400">
          Одоогоор сетлист байхгүй байна.
        </p>
      ) : (
        <div className="space-y-2">
          {setlists.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border rounded px-4 py-3"
            >
              {/* Мөр дээр дарвал дэлгэрэнгүй рүү */}
              <div
                className="flex-1 cursor-pointer"
                onClick={() => router.push(`/setlists/${s.id}`)}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">
                  {s.date || ''}
                </div>
              </div>

              {/* Устгах товч – click bubble-ийг зогсооно */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteSetlist(s)
                }}
                disabled={deletingId === s.id}
                className="ml-3 px-3 py-1 text-xs border rounded border-red-500 text-red-400 hover:bg-red-500 hover:text-black disabled:opacity-50"
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