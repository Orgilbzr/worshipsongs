'use client'

import { useEffect, useState } from 'react'
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
  const editId = searchParams.get('id') // байвал засах горим

  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [form, setForm] = useState<SongForm>(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState<SongForm>(EMPTY_FORM)

  const [loadingSong, setLoadingSong] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(initialForm)

  // ---------------------------
  // Хэрэглэгчийг ачаалах
  // ---------------------------
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

  // ---------------------------
  // Дууг ачаалах (edit горим)
  // ---------------------------
  useEffect(() => {
    let ignore = false
    setError(null)
    setSuccess(null)

    if (!editId) {
      // ШИНЭ дуу – form-ыг цэвэрлэнэ
      setForm(EMPTY_FORM)
      setInitialForm(EMPTY_FORM)
      setLoadingSong(false)
      return
    }

    async function loadSong() {
      setLoadingSong(true)

      const { data, error } = await supabase
        .from('songs')
        .select(
          'title, original_key, tempo, lyrics, youtube_url'
        )
        .eq('id', editId)
        .single()

      if (ignore) return

      if (error) {
        console.error(error)
        setError(error.message)
        setForm(EMPTY_FORM)
        setInitialForm(EMPTY_FORM)
      } else {
        const f: SongForm = {
          title: data?.title ?? '',
          original_key: data?.original_key ?? '',
          tempo: data?.tempo ?? '',
          lyrics: data?.lyrics ?? '',
          youtube_url: data?.youtube_url ?? '',
        }
        setForm(f)
        setInitialForm(f)
      }

      setLoadingSong(false)
    }

    loadSong()

    return () => {
      ignore = true
    }
  }, [editId])

  // ---------------------------
  // Tab хаах / refresh хийхэд асуух
  // ---------------------------
  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [isDirty])

  function updateField<K extends keyof SongForm>(
    key: K,
    value: SongForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function safeNavigate(path: string) {
    if (
      isDirty &&
      !window.confirm('Хадгалахгүйгээр гарах уу?')
    ) {
      return
    }
    router.push(path)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      if (!user) {
        setError('Нэвтэрсэн байх шаардлагатай.')
        setSaving(false)
        return
      }

      if (!form.title.trim() || !form.lyrics.trim()) {
        setError('Нэр болон дууны үгийг заавал бөглөнө үү.')
        setSaving(false)
        return
      }

      if (editId) {
        // UPDATE
        const { error } = await supabase
          .from('songs')
          .update({
            title: form.title.trim(),
            original_key: form.original_key.trim() || null,
            tempo: form.tempo.trim() || null,
            lyrics: form.lyrics,
            youtube_url:
              form.youtube_url.trim() || null,
          })
          .eq('id', editId)

        if (error) {
          console.error(error)
          setError('Шинэчлэхэд алдаа гарлаа.')
        } else {
          setInitialForm(form)
          setSuccess('Амжилттай шинэчлэгдлээ.')
          router.push(`/songs/${editId}`)
          router.refresh()
        }
      } else {
        // INSERT
        const { data, error } = await supabase
          .from('songs')
          .insert({
            title: form.title.trim(),
            original_key:
              form.original_key.trim() || null,
            tempo: form.tempo.trim() || null,
            lyrics: form.lyrics,
            youtube_url:
              form.youtube_url.trim() || null,
          })
          .select('id')
          .single()

        if (error) {
          console.error(error)
          setError('Хадгалахад алдаа гарлаа.')
        } else if (data?.id) {
          setInitialForm(form)
          setSuccess('Амжилттай нэмэгдлээ.')
          router.push(`/songs/${data.id}`)
          router.refresh()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------
  // Render
  // ---------------------------

  if (loadingUser) {
    return <p>Хэрэглэгчийн мэдээлэл ачаалж байна…</p>
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">
          Дуу нэмэх / засах
        </h1>
        <p className="text-sm text-red-500">
          Энэ хуудсыг ашиглахын тулд нэвтэрнэ үү.
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

  if (loadingSong) {
    return <p>Дууны өгөгдөл ачаалж байна…</p>
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {editId ? 'Дуу засах' : 'Шинэ дуу нэмэх'}
        </h1>

        <button
          type="button"
          onClick={() => safeNavigate('/songs')}
          className="text-sm underline"
        >
          ← Дууны сан руу буцах
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-400">
          {success}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm mb-1">
            Нэр *
          </label>
          <input
            className="w-full border rounded px-3 py-2 bg-black"
            value={form.title}
            onChange={(e) =>
              updateField('title', e.target.value)
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">
              Orginal Key
            </label>
            <input
              className="w-full border rounded px-3 py-2 bg-black"
              value={form.original_key}
              onChange={(e) =>
                updateField(
                  'original_key',
                  e.target.value
                )
              }
              placeholder="C, D, F# ..."
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Tempo
            </label>
            <input
              className="w-full border rounded px-3 py-2 bg-black"
              value={form.tempo}
              onChange={(e) =>
                updateField('tempo', e.target.value)
              }
              placeholder="80 bpm, Medium..."
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Youtube URL
            </label>
            <input
              className="w-full border rounded px-3 py-2 bg-black"
              value={form.youtube_url}
              onChange={(e) =>
                updateField(
                  'youtube_url',
                  e.target.value
                )
              }
              placeholder="https://youtube.com/..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">
            Дууны үг / ChordPro *
          </label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-black font-mono text-sm min-h-[260px]"
            value={form.lyrics}
            onChange={(e) =>
              updateField('lyrics', e.target.value)
            }
            placeholder={`{verse 1}
[C]Сур жавхлант магтаалын
[F]Танд бид өргөдөг...

{chorus}
Gaihamshigiig buteech...`}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-60"
          >
            {saving
              ? 'Хадгалж байна…'
              : editId
              ? 'Шинэчлэх'
              : 'Хадгалах'}
          </button>

          {isDirty && (
            <span className="text-xs text-yellow-300">
              Хадгалаагүй өөрчлөлт байгаа.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}