'use client'

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type Song = {
  id: string
  title: string
  original_key: string | null
  tempo: string | null
  lyrics: string
}

export default function NewSetlistPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [name, setName] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loadingSongs, setLoadingSongs] = useState(true)

  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([])
  const [keyOverrides, setKeyOverrides] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ------------------------
  // Хэрэглэгч авах
  // ------------------------
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

  // ------------------------
  // Дуунуудыг ачаалах
  // ------------------------
  useEffect(() => {
    if (!user) {
      setSongs([])
      setLoadingSongs(false)
      return
    }

    let ignore = false

    async function loadSongs() {
      setLoadingSongs(true)
      setError(null)

      const { data, error } = await supabase
        .from('songs')
        .select('id, title, original_key, tempo, lyrics')
        .order('title', { ascending: true })

      if (ignore) return

      if (error) {
        console.error(error)
        setError('Дууны сан ачаалахад алдаа гарлаа.')
        setSongs([])
      } else {
        setSongs((data ?? []) as Song[])
      }

      setLoadingSongs(false)
    }

    loadSongs()

    return () => {
      ignore = true
    }
  }, [user])

  // ------------------------
  // Хайлт – дууны нэр + үгээр шүүх
  // ------------------------
  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return songs

    return songs.filter((s) => {
      const inTitle = s.title.toLowerCase().includes(q)
      const inLyrics = s.lyrics.toLowerCase().includes(q)
      return inTitle || inLyrics
    })
  }, [songs, search])

  function toggleSong(id: string) {
    setSelectedSongIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id],
    )
  }

  function changeKey(id: string, value: string) {
    setKeyOverrides((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  // ------------------------
  // Хадгалах
  // ------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('Нэвтэрсэн байх шаардлагатай.')
      return
    }

    if (!name.trim()) {
      setError('Жагсаалтын нэрээ оруулна уу.')
      return
    }

    if (selectedSongIds.length === 0) {
      setError('Ядаж нэг дуу сонгоно уу.')
      return
    }

    setSaving(true)

    try {
      const today = new Date()
      const dateStr = today.toISOString().slice(0, 10)

      const { data: setlist, error: e1 } = await supabase
        .from('setlists')
        .insert({
          name: name.trim(),
          date: dateStr,
        })
        .select('id')
        .single()

      if (e1 || !setlist?.id) {
        console.error(e1)
        setError('Жагсаалт үүсгэхэд алдаа гарлаа.')
        setSaving(false)
        return
      }

      const setlistId = setlist.id as string

      const rows = selectedSongIds.map((songId, index) => {
        const song = songs.find((s) => s.id === songId)
        const override = keyOverrides[songId]?.trim()

        return {
          setlist_id: setlistId,
          song_id: songId,
          position: index + 1,
          key_override:
            override &&
            song?.original_key &&
            override !== song.original_key
              ? override
              : null,
        }
      })

      const { error: e2 } = await supabase
        .from('setlist_songs')
        .insert(rows)

      if (e2) {
        console.error(e2)
        setError(
          'Жагсаалтад дуу нэмэх үед алдаа гарлаа. (Өгөгдлийн бааз руу орсон байж магадгүй, шалгаж үзээрэй.)',
        )
        setSaving(false)
        return
      }

      router.push(`/setlists/${setlistId}`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ------------------------
  // Render
  // ------------------------

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
          Шинэ жагсаалт үүсгэх
        </h1>
        <p className="text-sm text-red-500 dark:text-red-400">
          Энэ хуудсыг ашиглахын тулд нэвтэрнэ үү.
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
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          Шинэ жагсаалт үүсгэх
        </h1>
        <button
          type="button"
          onClick={() => router.push('/setlists')}
          className="
            inline-flex items-center gap-2
            px-3 py-1 text-xs font-medium rounded border
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700
          "
        >
          Жагсаалтруу буцах
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm mb-1">
            Жагсаалтын нэр *
          </label>
          <input
            className="
              w-full rounded border px-3 py-2 text-sm
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              placeholder:text-slate-400
              dark:border-slate-700 dark:placeholder:text-slate-500
            "
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunday Service, Youth Night…"
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-sm font-medium">
              Дуу сонгох (дарааллаар нь сонго)
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span>Хайх:</span>
              <input
                className="
                  border rounded px-2 py-1 text-sm
                  border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                  placeholder:text-slate-400
                  dark:border-slate-700 dark:placeholder:text-slate-500
                "
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Нэр эсвэл үгээр хайх…"
              />
            </div>
          </div>

          {loadingSongs ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Дууны сан ачаалж байна…
            </p>
          ) : filteredSongs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Хайлтад таарах дуу алга.
            </p>
          ) : (
            <div
              className="
                border rounded max-h-[420px] overflow-auto divide-y
                border-slate-200 divide-slate-200 bg-[var(--background)]
                dark:border-slate-700 dark:divide-slate-700
              "
            >
              {filteredSongs.map((song) => {
                const checked = selectedSongIds.includes(song.id)
                const currentKey =
                  keyOverrides[song.id] ??
                  song.original_key ??
                  ''

                return (
                  <label
                    key={song.id}
                    className="
                      group flex items-center gap-3 px-3 py-2 text-sm cursor-pointer
                      hover:bg-slate-900 dark:hover:bg-slate-800
                    "
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSong(song.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div
                        className="
                          font-medium text-[var(--foreground)]
                          group-hover:text-slate-50
                        "
                      >
                        {song.title}
                      </div>
                      <div
                        className="
                          text-xs text-slate-600 dark:text-slate-400
                          group-hover:text-slate-200
                        "
                      >
                        Key: {song.original_key ?? '-'} · Tempo:{' '}
                        {song.tempo ?? '-'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="
                          text-xs text-slate-500 dark:text-slate-400
                          group-hover:text-slate-200
                        "
                      >
                        Key:
                      </span>
                      <input
                        className="
                          w-16 rounded border px-1 py-0.5 text-xs
                          border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                          dark:border-slate-700
                        "
                        value={currentKey}
                        onChange={(e) =>
                          changeKey(song.id, e.target.value)
                        }
                        placeholder={song.original_key ?? ''}
                      />
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {selectedSongIds.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Сонгосон {selectedSongIds.length} дуу. Дарааллын
              дагуу хадгалагдана.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="
              inline-flex items-center justify-center
              px-3 py-1 text-xs font-medium rounded border
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              hover:bg-slate-100 dark:hover:bg-slate-800
              dark:border-slate-700 disabled:opacity-60
            "
          >
            {saving
              ? 'Хадгалж байна…'
              : 'Жагсаалт үүсгэх'}
          </button>
        </div>
      </form>
    </div>
  )
}