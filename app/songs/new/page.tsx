'use client'

import {
  FormEvent,
  Suspense,
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

// ------------------ ЖИНХЭНЭ ЛОГИК ------------------

function SongNewOrEditPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [form, setForm] = useState<SongForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const songId = searchParams.get('id')
  const mode: 'new' | 'edit' = songId ? 'edit' : 'new'

  // -------- Хэрэглэгч ачаалах --------
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

  // -------- Edit үед дууны мэдээлэл ачаалах --------
  useEffect(() => {
    if (!songId || mode !== 'edit') return
    if (!user) return

    let ignore = false

    async function loadSong() {
      setError(null)

      const { data, error } = await supabase
        .from('songs')
        .select(
          'id, title, original_key, tempo, lyrics, youtube_url'
        )
        .eq('id', songId)
        .single()

      if (ignore) return

      if (error) {
        console.error(error)
        setError('Дууны мэдээлэл ачаалахад алдаа гарлаа.')
        return
      }

      setForm({
        title: data.title ?? '',
        original_key: data.original_key ?? '',
        tempo: data.tempo ?? '',
        lyrics: data.lyrics ?? '',
        youtube_url: data.youtube_url ?? '',
      })
    }

    loadSong()

    return () => {
      ignore = true
    }
  }, [mode, songId, user])

  function handleChange(
    field: keyof SongForm,
    value: string
  ) {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      if (mode === 'new') {
        const { error } = await supabase.from('songs').insert({
          title: form.title.trim(),
          original_key: form.original_key.trim() || null,
          tempo: form.tempo.trim() || null,
          lyrics: form.lyrics,
          youtube_url: form.youtube_url.trim() || null,
        })

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('songs')
          .update({
            title: form.title.trim(),
            original_key: form.original_key.trim() || null,
            tempo: form.tempo.trim() || null,
            lyrics: form.lyrics,
            youtube_url: form.youtube_url.trim() || null,
          })
          .eq('id', songId)

        if (error) throw error
      }

      router.push('/songs')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Хадгалах үед алдаа гарлаа.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingUser) {
    return <p>Хэрэглэгчийн мэдээлэл ачаалж байна…</p>
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">
          {mode === 'new' ? 'Шинэ дуу нэмэх' : 'Дуу засах'}
        </h1>
        <p className="text-sm text-red-500">
          Энэ хуудсыг ашиглахын тулд нэвтэрнэ үү.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 rounded bg-black text.white text-sm"
        >
          Нэвтрэх хуудас руу очих
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <button
        onClick={() => router.push('/songs')}
        className="text-sm underline"
      >
        ← Дууны сан руу буцах
      </button>

      <h1 className="text-2xl font-semibold">
        {mode === 'new' ? 'Шинэ дуу нэмэх' : 'Дуу засах'}
      </h1>

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">
            Дууны нэр *
          </label>
          <input
            required
            value={form.title}
            onChange={e =>
              handleChange('title', e.target.value)
            }
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-sm font-medium">
              Анхны тон
            </label>
            <input
              value={form.original_key}
              onChange={e =>
                handleChange(
                  'original_key',
                  e.target.value
                )
              }
              className="border rounded px-3 py-2 text-sm"
              placeholder="C, D, Eb ..."
            />
          </div>

          <div className="flex-1 flex flex-col gap-1">
            <label className="text-sm font-medium">
              Темпо
            </label>
            <input
              value={form.tempo}
              onChange={e =>
                handleChange('tempo', e.target.value)
              }
              className="border rounded px-3 py-2 text-sm"
              placeholder="Slow, 72 BPM ..."
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">
            Youtube URL
          </label>
          <input
            value={form.youtube_url}
            onChange={e =>
              handleChange(
                'youtube_url',
                e.target.value
              )
            }
            className="border rounded px-3 py-2 text-sm"
            placeholder="https://youtube.com/..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">
            Дууны үг / ChordPro
          </label>
          <textarea
            required
            value={form.lyrics}
            onChange={e =>
              handleChange('lyrics', e.target.value)
            }
            rows={16}
            className="border rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        {/* ЭНД ТОВЧИЙГ ЭНГИЙН БОЛГОСОН ХЭСЭГ */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-60"
          >
            {saving ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ------------- Suspense wrapper ---------------

export default function SongNewOrEditPage() {
  return (
    <Suspense fallback={<p>Форм ачаалж байна…</p>}>
      <SongNewOrEditPageInner />
    </Suspense>
  )
}