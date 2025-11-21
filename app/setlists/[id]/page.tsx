'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type Setlist = {
  id: string
  name: string
  date: string | null
}

type SetlistSongRow = {
  id: string
  position: number
  key_override: string | null
  song: {
    id: string
    title: string
    original_key: string | null
    tempo: string | null
  }
}

export default function SetlistDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [songs, setSongs] = useState<SetlistSongRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reordering, setReordering] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  // -------- Хэрэглэгч --------
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      try {
        setLoadingUser(true)
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth session load error:', error)
        }

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

  // -------- Сетлист + дуунууд --------
  useEffect(() => {
    if (!user) {
      setSetlist(null)
      setSongs([])
      setLoading(false)
      return
    }
    if (!params?.id) return

    let ignore = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('setlists')
        .select(
          `
          id,
          name,
          date,
          setlist_songs (
            id,
            position,
            key_override,
            song:songs (
              id,
              title,
              original_key,
              tempo
            )
          )
        `,
        )
        .eq('id', params.id)
        .single()

      if (ignore) return

      if (error) {
        console.error(error)
        setError(error.message)
        setSetlist(null)
        setSongs([])
      } else {
        const s: Setlist = {
          id: data.id as string,
          name: data.name as string,
          date: (data.date as string | null) ?? null,
        }
        const rows = ((data as any).setlist_songs || []) as SetlistSongRow[]
        rows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        setSetlist(s)
        setSongs(rows)
      }

      setLoading(false)
    }

    load()

    return () => {
      ignore = true
    }
  }, [user, params?.id])

  // -------- Сетлистээс устгах (❌) --------
  async function handleRemove(rowId: string) {
    if (!window.confirm('Энэ дууг жагсаалтаас хасах уу?')) return

    setRemoving(rowId)
    setError(null)

    const { error } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('id', rowId)

    if (error) {
      console.error(error)
      setError('Дууг жагсаалтаас хасахад алдаа гарлаа.')
      setRemoving(null)
      return
    }

    setSongs((prev) => prev.filter((r) => r.id !== rowId))
    setRemoving(null)
  }

  // -------- Дараалал өөрчлөх (↑ / ↓) --------
  async function moveRow(rowId: string, direction: 'up' | 'down') {
    if (reordering) return

    const index = songs.findIndex((r) => r.id === rowId)
    if (index === -1) return

    const targetIndex =
      direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= songs.length) {
      return
    }

    const current = songs[index]
    const target = songs[targetIndex]
    const currentPos = current.position
    const targetPos = target.position

    const newSongs = [...songs]
    newSongs[index] = { ...target, position: currentPos }
    newSongs[targetIndex] = { ...current, position: targetPos }
    setSongs(newSongs)

    setReordering(true)
    setError(null)

    try {
      let { error } = await supabase
        .from('setlist_songs')
        .update({ position: -1 })
        .eq('id', current.id)

      if (error) {
        console.error(error)
        throw error
      }

      ;({ error } = await supabase
        .from('setlist_songs')
        .update({ position: currentPos })
        .eq('id', target.id))

      if (error) {
        console.error(error)
        throw error
      }

      ;({ error } = await supabase
        .from('setlist_songs')
        .update({ position: targetPos })
        .eq('id', current.id))

      if (error) {
        console.error(error)
        throw error
      }
    } catch (e) {
      console.error(e)
      setError('Дарааллыг хадгалахад алдаа гарлаа.')
      router.refresh()
    } finally {
      setReordering(false)
    }
  }

  // -------- Render --------

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
        <h1 className="text-2xl font-semibold">
          Жагсаалтын дэлгэрэнгүй
        </h1>
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

  if (loading) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Жагсаалтын мэдээлэл ачаалж байна…
      </p>
    )
  }

  if (error && !setlist) {
    return (
      <div className="space-y-3 max-w-md">
        <h1 className="text-2xl font-semibold">
          Жагсаалтын дэлгэрэнгүй
        </h1>
        <p className="text-sm text-red-500 dark:text-red-400">
          Алдаа: {error}
        </p>
        <button
          onClick={() => router.push('/setlists')}
          className="
            inline-flex items-center gap-2
            px-3 py-1 text-xs font-medium rounded border
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700
          "
        >
          ← Жагсаалтруу буцах
        </button>
      </div>
    )
  }

  if (!setlist) {
    return null
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Дээд мөр – буцах товч + баруун талд action-ийн товчнууд */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/setlists')}
          className="
            inline-flex items-center gap-2
            px-3 py-1 text-xs font-medium rounded border
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700
          "
        >
          ← Жагсаалтруу буцах
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() =>
              router.push(`/setlists/${setlist.id}/service`)
            }
            className="
              inline-flex items-center justify-center
              px-3 py-1 text-xs font-medium rounded border
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              hover:bg-slate-100 dark:hover:bg-slate-800
              dark:border-slate-700
            "
          >
            Service view
          </button>

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
      </div>

      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">{setlist.name}</h1>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Огноо: {setlist.date ?? '-'}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {error}
        </p>
      )}

      {songs.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Энэ жагсаалтад одоогоор дуу байхгүй байна.
        </p>
      ) : (
        <div
          className="
            border rounded divide-y
            border-slate-200 divide-slate-200 bg-[var(--background)]
            dark:border-slate-700 dark:divide-slate-700
          "
        >
          {songs.map((row, index) => {
            const effectiveKey =
              row.key_override || row.song.original_key || ''

            return (
              <div
                key={row.id}
                onClick={() => {
                  const keyParam = effectiveKey
                    ? `?key=${encodeURIComponent(effectiveKey)}`
                    : ''
                  router.push(`/songs/${row.song.id}${keyParam}`)
                }}
                className="
                  group flex items-center gap-3 px-3 py-2 text-sm cursor-pointer
                  hover:bg-slate-900 dark:hover:bg-slate-800
                "
              >
                {/* # */}
                <div
                  className="
                    w-8 text-xs text-slate-500 dark:text-slate-400
                    group-hover:text-slate-200
                  "
                >
                  {index + 1}
                </div>

                {/* ↑ / ↓ */}
                <div className="flex flex-col items-center gap-0.5 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveRow(row.id, 'up')
                    }}
                    disabled={reordering || index === 0}
                    className="
                      px-1 py-0.5 rounded border text-xs
                      border-slate-300 bg-[var(--background)]
                      hover:bg-slate-100 dark:hover:bg-slate-800
                      dark:border-slate-700 disabled:opacity-40
                    "
                    title="Дээш зөөх"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveRow(row.id, 'down')
                    }}
                    disabled={reordering || index === songs.length - 1}
                    className="
                      px-1 py-0.5 rounded border text-xs
                      border-slate-300 bg-[var(--background)]
                      hover:bg-slate-100 dark:hover:bg-slate-800
                      dark:border-slate-700 disabled:opacity-40
                    "
                    title="Доош зөөх"
                  >
                    ↓
                  </button>
                </div>

                {/* Дууны мэдээлэл */}
                <div className="flex-1">
                  <div
                    className="
                      font-medium text-[var(--foreground)]
                      group-hover:text-slate-50
                    "
                  >
                    {row.song.title}
                  </div>
                  <div
                    className="
                      text-xs text-slate-600 dark:text-slate-400
                      group-hover:text-slate-200
                    "
                  >
                    Original key:{' '}
                    {row.song.original_key ?? '-'} · Жагсаалтад:{' '}
                    {effectiveKey || '—'} · Tempo:{' '}
                    {row.song.tempo ?? '-'}
                  </div>
                </div>

                {/* ❌ устгах */}
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(row.id)
                    }}
                    disabled={removing === row.id}
                    className="
                      px-2 py-1 rounded border text-xs
                      border-red-500 text-red-600 hover:bg-red-50
                      disabled:opacity-40
                      dark:border-red-500 dark:text-red-400 dark:hover:bg-red-900/30
                    "
                    title="Жагсаалтаас хасах"
                  >
                    ❌
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}