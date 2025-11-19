'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function SongNewPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [form, setForm] = useState<SongForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- Нэвтэрсэн хэрэглэгч шалгах ---
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error(error)
      }
      if (!ignore) {
        setUser(data.user ?? null)
        setLoadingUser(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ignore) {
        setUser(session?.user ?? null)
      }
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  // --- Нэвтрээгүй бол буцаах / мессеж ---
  if (loadingUser) {
    return (
      <p className="text-sm text-slate-500">
        Нэвтрэлтийг шалгаж байна…
      </p>
    )
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Шинэ дуу нэмэх</h1>
        <p className="text-sm text-red-500">
          Шинэ дуу нэмэхийн тулд нэвтэрсэн байх шаардлагатай.
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

  // --- Input өөрчлөх ---
  function updateField<K extends keyof SongForm>(
    key: K,
    value: SongForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // --- Хадгалах submit ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    setError(null)

    const title = form.title.trim()
    const lyrics = form.lyrics.trim()
    const original_key = form.original_key.trim()
    const tempo = form.tempo.trim()
    const youtube_url = form.youtube_url.trim()

    // Энгийн валидаци
    if (!title) {
      setError('Дууны нэрийг оруулна уу.')
      return
    }
    if (!lyrics) {
      setError('Дууны үг / аккордыг оруулна уу.')
      return
    }

    setSaving(true)

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

    // Амжилттай болсон бол тухайн дууны дэлгэрэнгүй рүү очих
    router.push(`/songs/${newId}`)
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

      <h1 className="text-2xl font-semibold">Шинэ дуу нэмэх</h1>

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
            ChordPro хэлбэрээр аккордыг [] дотор бичиж болно. Жишээ:
            {'  '}
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

        {/* Хадгалах товч */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </form>
    </div>
  )
}