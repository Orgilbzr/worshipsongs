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

export default function SongNewOrEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // --- query string-ээс id авах (засах горим уу, шинэ үү гэдгийг шийднэ) ---
  const songIdParam = searchParams.get('id')
  const songId = songIdParam && songIdParam.trim() !== '' ? songIdParam : null
  const isEditMode = !!songId

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [form, setForm] = useState<SongForm>(EMPTY_FORM)
  const [loadingSong, setLoadingSong] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- Нэвтэрсэн хэрэглэгч ачаалах ---
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

  // --- Засах горимд бол тухайн дууг ачаалж form-ийг бөглөх ---
  useEffect(() => {
    let ignore = false

    async function loadSong() {
      setLoadingSong(true)
      setError(null)

      const { data, error } = await supabase
        .from('songs')
        .select('id, title, original_key, tempo, lyrics, youtube_url')
        .eq('id', songId)
        .single()

      if (ignore) return

      if (error) {
        console.error(error)
        setError('Дууг ачаалах үед алдаа гарлаа.')
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

    if (!songId) {
      // ← ШИНЭ ДУУ НЭМЭХ РҮҮ ОРЖ ИРСЭН ҮЕД ХУУЧИН FORM-ЫГ ЦЭВЭРЛЭНЭ
      setForm(EMPTY_FORM)
      setError(null)
      setLoadingSong(false)
      return
    }

    loadSong()

    return () => {
      ignore = true
    }
  }, [songId])

  // --- Төлөвүүдээр нь дэлгэц шийдье ---
  if (loadingUser || (isEditMode && loadingSong)) {
    return (
      <p className="text-sm text-slate-500">
        Дууны мэдээлэл ачаалж байна…
      </p>
    )
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">
          {isEditMode ? 'Дуу засах' : 'Шинэ дуу нэмэх'}
        </h1>
        <p className="text-sm text-red-500">
          {isEditMode
            ? 'Дуу засахын тулд нэвтэрсэн байх шаардлагатай.'
            : 'Шинэ дуу нэмэхийн тулд нэвтэрсэн байх шаардлагатай.'}
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

  // --- Form талбар шинэчлэх туслагч ---
  function updateField<K extends keyof SongForm>(
    key: K,
    value: SongForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // --- Хадгалах / Шинэчлэх submit ---
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
      setError('Дууны үг / аккордыг оруулна уу.')
      return
    }

    setSaving(true)

    try {
      if (isEditMode && songId) {
        // -------- UPDATE ----------
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
          console.error(error)
          setError('Дуу шинэчлэх үед алдаа гарлаа.')
          setSaving(false)
          return
        }

        const updatedId = (data as { id: string }).id
        router.push(`/songs/${updatedId}`)
      } else {
        // -------- INSERT ----------
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
          console.error(error)
          setError('Хадгалах үед алдаа гарлаа.')
          setSaving(false)
          return
        }

        const newId = (data as { id: string }).id
        router.push(`/songs/${newId}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <button
        onClick={() => router.push('/songs')}
        className="text-sm underline"
        type="button"
      >
        ← Дууны сан руу буцах
      </button>

      <h1 className="text-2xl font-semibold">
        {isEditMode ? 'Дуу засах' : 'Шинэ дуу нэмэх'}
      </h1>

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Дууны нэр */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Дууны нэр<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="Жишээ: Эзэн бол миний хоньчин"
          />
        </div>

        {/* Анхны тон / Темпо */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              placeholder="Жишээ: C, D, F# …"
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
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              placeholder="Жишээ: 72 BPM, Mid, Fast …"
            />
          </div>
        </div>

        {/* Дууны үг / ChordPro */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Дууны үг / ChordPro
            <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.lyrics}
            onChange={(e) => updateField('lyrics', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono min-h-[260px]"
            placeholder={`{Verse 1}
[G]Энд үгээ [C]Chords-оо бичнэ

{Chorus}
[D]Магтаалын [Em]үгс…`}
          />
          <p className="text-xs text-slate-500">
            ChordPro хэлбэрээр аккордыг [] дотор бичиж болно. Жишээ:{' '}
            <code className="font-mono">
              [G]Эзэн минь, би чамайг хайрлана
            </code>
          </p>
        </div>

        {/* Youtube линк */}
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Youtube линк
          </label>
          <input
            type="url"
            value={form.youtube_url}
            onChange={(e) => updateField('youtube_url', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        {/* Хадгалах / Шинэчлэх товч */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving
              ? isEditMode
                ? 'Шинэчилж байна…'
                : 'Хадгалж байна…'
              : isEditMode
              ? 'Шинэчлэх'
              : 'Хадгалах'}
          </button>
        </div>
      </form>
    </div>
  )
}