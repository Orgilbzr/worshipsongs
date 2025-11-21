'use client'

import {
  FormEvent,
  useEffect,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type SongForm = {
  title: string
  original_key: string
  tempo: string
  lyrics: string
  youtube_url: string
}

const EMPTY_FORM: SongForm = {
  title: '',
  original_key: '',
  tempo: '',
  lyrics: '',
  youtube_url: '',
}

export default function SongNewOrEditPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const songIdParam = searchParams.get('id')
  const songId =
    songIdParam && songIdParam.trim() !== '' ? songIdParam : null
  const isEditMode = !!songId

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [form, setForm] = useState<SongForm>(EMPTY_FORM)
  const [loadingSong, setLoadingSong] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // -------------------------------
  // USER SESSION
  // -------------------------------
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      try {
        setLoadingUser(true)
        const { data } = await supabase.auth.getSession()

        if (!ignore) {
          setUser(data.session?.user ?? null)
          setLoadingUser(false)
        }
      } catch (_) {
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

  // -------------------------------
  // LOAD SONG (edit mode)
  // -------------------------------
  useEffect(() => {
    let ignore = false

    if (!songId) {
      setForm(EMPTY_FORM)
      setError(null)
      setLoadingSong(false)
      return
    }

    async function loadSong() {
      setLoadingSong(true)

      const { data, error } = await supabase
        .from('songs')
        .select(
          'id, title, original_key, tempo, lyrics, youtube_url'
        )
        .eq('id', songId)
        .single()

      if (ignore) return

      if (error) {
        setError('Дуу ачаалахад алдаа гарлаа.')
      } else if (data) {
        setForm({
          title: data.title ?? '',
          original_key: data.original_key ?? '',
          tempo: data.tempo ?? '',
          lyrics: data.lyrics ?? '',
          youtube_url: data.youtube_url ?? '',
        })
      }

      setLoadingSong(false)
    }

    loadSong()
    return () => {
      ignore = true
    }
  }, [songId])

  // -------------------------------
  // SCREEN LOGIC
  // -------------------------------
  if (loadingUser || (isEditMode && loadingSong)) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Ачаалж байна…
      </p>
    )
  }

  if (!user) {
    return (
      <div className="space-y-3 max-w-2xl">
        <h1 className="text-2xl font-semibold">
          {isEditMode ? 'Дуу засах' : 'Шинэ дуу нэмэх'}
        </h1>
        <p className="text-sm text-red-500 dark:text-red-400">
          Нэвтэрсэн байх шаардлагатай.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="text-sm underline"
        >
          Нэвтрэх хуудас руу очих
        </button>
      </div>
    )
  }

  function updateField<K extends keyof SongForm>(
    key: K,
    value: SongForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // -------------------------------
  // SUBMIT
  // -------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    setError(null)

    const title = form.title.trim()
    const lyrics = form.lyrics.trim()
    const original_key = form.original_key.trim()
    const tempo = form.tempo.trim()
    const youtube_url = form.youtube_url.trim()

    if (!title) {
      setError('Дууны нэрийг оруулна уу.')
      return
    }
    if (!lyrics) {
      setError('Дууны үг / аккорд оруулна уу.')
      return
    }

    setSaving(true)

    try {
      if (isEditMode && songId) {
        const { data, error } = await supabase
          .from('songs')
          .update({
            title,
            lyrics,
            original_key: original_key || null,
            tempo: tempo || null,
            youtube_url: youtube_url || null,
          })
          .eq('id', songId)
          .select('id')
          .single()

        if (error) {
          setError('Шинэчлэх үед алдаа гарлаа.')
          return
        }

        router.push(`/songs/${data.id}`)
      } else {
        const { data, error } = await supabase
          .from('songs')
          .insert({
            title,
            lyrics,
            original_key: original_key || null,
            tempo: tempo || null,
            youtube_url: youtube_url || null,
          })
          .select('id')
          .single()

        if (error) {
          setError('Хадгалах үед алдаа гарлаа.')
          return
        }

        router.push(`/songs/${data.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------
  // RENDER FORM
  // -------------------------------
  return (
    <div className="space-y-4 max-w-2xl">

      {/* Бусад page-тэй адил "Буцах" товч */}
      <button
        onClick={() => router.push('/songs')}
        className="
          inline-flex items-center gap-2
          px-3 py-1 text-xs font-medium rounded border
          border-slate-300 bg-[var(--background)] text-[var(--foreground)]
          hover:bg-slate-100 dark:hover:bg-slate-800
          dark:border-slate-700
        "
      >
        Дууны сан руу буцах
      </button>

      <h1 className="text-2xl font-semibold">
        {isEditMode ? 'Дуу засах' : 'Шинэ дуу нэмэх'}
      </h1>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Дууны нэр *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="
              w-full rounded border px-3 py-2 text-sm
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              placeholder:text-slate-400
              dark:border-slate-700 dark:placeholder:text-slate-500
            "
          />
        </div>

        {/* Key + Tempo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Анхны тон
            </label>
            <input
              type="text"
              value={form.original_key}
              onChange={(e) =>
                updateField('original_key', e.target.value.toUpperCase())
              }
              className="
                w-full rounded border px-3 py-2 text-sm
                border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                dark:border-slate-700
              "
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Темпо
            </label>
            <input
              type="text"
              value={form.tempo}
              onChange={(e) => updateField('tempo', e.target.value)}
              className="
                w-full rounded border px-3 py-2 text-sm
                border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                dark:border-slate-700
              "
            />
          </div>
        </div>

        {/* Lyrics */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Дууны үг / ChordPro *
          </label>
          <textarea
            value={form.lyrics}
            onChange={(e) => updateField('lyrics', e.target.value)}
            className="
              w-full min-h-[240px] rounded border px-3 py-2 text-sm font-mono
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              dark:border-slate-700
            "
          />
        </div>

        {/* Youtube */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Youtube линк
          </label>
          <input
            type="url"
            value={form.youtube_url}
            onChange={(e) => updateField('youtube_url', e.target.value)}
            className="
              w-full rounded border px-3 py-2 text-sm
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              placeholder:text-slate-400
              dark:border-slate-700 dark:placeholder:text-slate-500
            "
          />
        </div>

        {/* Save – бусад товчтой адил загвар */}
        <button
          type="submit"
          disabled={saving}
          className="
            inline-flex items-center justify-center
            px-3 py-1 text-xs font-medium rounded border
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700 disabled:opacity-50
          "
        >
          {saving
            ? isEditMode
              ? 'Шинэчилж байна…'
              : 'Хадгалж байна…'
            : isEditMode
            ? 'Шинэчлэх'
            : 'Хадгалах'}
        </button>
      </form>
    </div>
  )
}