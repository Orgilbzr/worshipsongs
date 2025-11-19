'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type SongRow = {
  id: string
  title: string
  original_key: string | null
  tempo: string | null
  lyrics: string
  created_at: string
}

type SortMode =
  | 'newest'
  | 'oldest'
  | 'title_asc'
  | 'title_desc'
  | 'key_asc'
  | 'key_desc'

export default function SongsPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [songs, setSongs] = useState<SongRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  // User
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

  // Songs (public)
  useEffect(() => {
    let ignore = false

    async function loadSongs() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('songs')
        .select(
          'id, title, original_key, tempo, lyrics, created_at'
        )

      if (ignore) return

      if (error) {
        console.error(error)
        setError('Дууны сан ачаалахад алдаа гарлаа.')
        setSongs([])
      } else {
        setSongs((data ?? []) as SongRow[])
      }

      setLoading(false)
    }

    loadSongs()
    return () => {
      ignore = true
    }
  }, [])

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()

    let list = songs
    if (q) {
      list = list.filter((s) => {
        const t = s.title.toLowerCase()
        const l = s.lyrics.toLowerCase()
        return t.includes(q) || l.includes(q)
      })
    }

    list = [...list].sort((a, b) => {
      switch (sortMode) {
        case 'newest':
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          )
        case 'oldest':
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          )
        case 'title_asc':
          return a.title.localeCompare(b.title, 'mn')
        case 'title_desc':
          return b.title.localeCompare(a.title, 'mn')
        case 'key_asc':
          return (a.original_key ?? '').localeCompare(
            b.original_key ?? '',
            'en'
          )
        case 'key_desc':
          return (b.original_key ?? '').localeCompare(
            a.original_key ?? '',
            'en'
          )
        default:
          return 0
      }
    })

    return list
  }, [songs, search, sortMode])

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Дууны сан
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              user
                ? router.push('/songs/new')
                : router.push('/login')
            }
            className="px-3 py-1 text-xs border border-slate-300 rounded bg-white text-slate-900 hover:bg-slate-100"
          >
            Шинэ дуу нэмэх
          </button>
        </div>
      </div>

      {/* Хайлт + эрэмбэлэлт */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span>Хайх:</span>
          <input
            className="border border-slate-300 rounded px-2 py-1 bg-white text-sm text-slate-900 placeholder:text-slate-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Нэр эсвэл үгээр…"
          />
        </div>

        <div className="flex items-center gap-2">
          <span>Эрэмбэлэх:</span>
          <select
            className="border border-slate-300 rounded px-2 py-1 bg-white text-sm text-slate-900"
            value={sortMode}
            onChange={(e) =>
              setSortMode(e.target.value as SortMode)
            }
          >
            <option value="newest">
              Шинээс → хуучин
            </option>
            <option value="oldest">
              Хуучнаас → шинэ
            </option>
            <option value="title_asc">
              Нэр A → Я
            </option>
            <option value="title_desc">
              Нэр Я → A
            </option>
            <option value="key_asc">
              Key A → G#
            </option>
            <option value="key_desc">
              Key G# → A
            </option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">
          Дуунууд ачаалж байна…
        </p>
      ) : filteredAndSorted.length === 0 ? (
        <p className="text-sm text-slate-500">
          Хайлтад тохирох дуу алга.
        </p>
      ) : (
        <div className="border border-slate-200 rounded divide-y divide-slate-200 bg-white">
          {filteredAndSorted.map((song) => (
            <div
              key={song.id}
              onClick={() => router.push(`/songs/${song.id}`)}
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
            >
              <div className="space-y-0.5">
                <div className="font-medium text-slate-900">
                  {song.title}
                </div>
                <div className="text-xs text-slate-600">
                  Key: {song.original_key ?? '-'} · Tempo:{' '}
                  {song.tempo ?? '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}