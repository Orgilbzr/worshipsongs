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
        `
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

    // UI дээр эхлээд сольж үзүүлнэ
    const newSongs = [...songs]
    newSongs[index] = { ...target, position: currentPos }
    newSongs[targetIndex] = { ...current, position: targetPos }
    setSongs(newSongs)

    setReordering(true)
    setError(null)

    try {
      // 1. current -> түр -1
      let { error } = await supabase
        .from('setlist_songs')
        .update({ position: -1 })
        .eq('id', current.id)

      if (error) {
        console.error(error)
        throw error
      }

      // 2. target -> currentPos
      ;({ error } = await supabase
        .from('setlist_songs')
        .update({ position: currentPos })
        .eq('id', target.id))

      if (error) {
        console.error(error)
        throw error
      }

      // 3. current -> targetPos
      ;({ error } = await supabase
        .from('setlist_songs')
        .update({ position: targetPos })
        .eq('id', current.id))

      if (error) {
        console.error(error)
        throw error
      }
    } catch (e) {
      setError('Дарааллыг хадгалахад алдаа гарлаа.')
      router.refresh()
    } finally {
      setReordering(false)
    }
  }

  // -------- Render --------

  if (loadingUser) {
    return (
      <p className="text-sm text-slate-500">
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
        <p className="text-sm text-red-500">
          Энэ хуудсыг үзэхийн тулд нэвтэрнэ үү.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-900 text-sm hover:bg-slate-100"
        >
          Нэвтрэх хуудас руу очих
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-500">
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
        <p className="text-sm text-red-500">
          Алдаа: {error}
        </p>
        <button
          onClick={() => router.push('/setlists')}
          className="text-sm underline"
        >
          Жагсаалтууд руу буцах
        </button>
      </div>
    )
  }

  if (!setlist) {
    return null
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/setlists')}
          className="text-sm underline"
        >
          ← Жагсаалтууд руу буцах
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              router.push(`/setlists/${setlist.id}/service`)
            }
            className="px-3 py-1 text-xs border border-slate-300 rounded bg-white text-slate-900 hover:bg-slate-100"
          >
            Service view
          </button>

          <button
            onClick={() => router.push('/setlists/new')}
            className="px-3 py-1 text-xs border border-slate-300 rounded bg-white text-slate-900 hover:bg-slate-100"
          >
            Шинэ жагсаалт
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">{setlist.name}</h1>
        <div className="text-sm text-slate-600">
          Огноо: {setlist.date ?? '-'}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}

      {songs.length === 0 ? (
        <p className="text-sm text-slate-500">
          Энэ жагсаалтад одоогоор дуу байхгүй байна.
        </p>
      ) : (
        <div className="border border-slate-200 rounded divide-y divide-slate-200 bg-white">
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
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
              >
                {/* # */}
                <div className="w-8 text-xs text-slate-500">
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
                    className="px-1 py-0.5 border border-slate-300 rounded disabled:opacity-40"
                    title="Дээш зөөх"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveRow(row.id, 'down')
                    }}
                    disabled={
                      reordering || index === songs.length - 1
                    }
                    className="px-1 py-0.5 border border-slate-300 rounded disabled:opacity-40"
                    title="Доош зөөх"
                  >
                    ↓
                  </button>
                </div>

                {/* Дууны мэдээлэл */}
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {row.song.title}
                  </div>
                  <div className="text-xs text-slate-600">
                    Original key:{' '}
                    {row.song.original_key ?? '-'} · Жагсаалтанд:{' '}
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
                    className="px-2 py-1 border border-red-500 rounded text-red-600 disabled:opacity-40 hover:bg-red-50"
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