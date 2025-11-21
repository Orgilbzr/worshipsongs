'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

// ---------------- TYPES ----------------

type Setlist = {
  id: string
  name: string
  date: string | null
}

type ServiceSongRow = {
  id: string
  position: number
  key_override: string | null
  song: {
    id: string
    title: string
    original_key: string | null
    tempo: string | null
    lyrics: string | null
  }
}

// --------------- TRANSPOSE HELPERS ------------------

const NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

type Note = (typeof NOTES)[number]

function normalizeNote(input: string): Note | null {
  const up = input.trim().toUpperCase()
  const flat: Record<string, Note> = {
    DB: 'C#',
    EB: 'D#',
    GB: 'F#',
    AB: 'G#',
    BB: 'A#',
  }
  if (NOTES.includes(up as Note)) return up as Note
  return flat[up] ?? null
}

function isChordToken(str: string) {
  const s = str.trim()
  if (!s) return false
  const m = s.match(/^([A-Ga-g][b#]?)(.*)$/)
  if (!m) return false
  const suf = m[2] ?? ''
  if (suf.length > 4) return false
  if (!suf) return true
  return /^[a-z0-9]+$/i.test(suf)
}

function transposeChord(ch: string, fromKey: string, toKey: string) {
  const from = normalizeNote(fromKey)
  const to = normalizeNote(toKey)
  if (!from || !to) return ch

  const m = ch.match(/^([A-Ga-g][b#]?)(.*)$/)
  if (!m) return ch

  const root = normalizeNote(m[1])
  const suf = m[2] ?? ''
  if (!root) return ch

  const diff =
    (NOTES.indexOf(to) - NOTES.indexOf(from) + NOTES.length) %
    NOTES.length

  const newIndex =
    (NOTES.indexOf(root) + diff + NOTES.length) % NOTES.length

  return NOTES[newIndex] + suf
}

function transposeLyrics(
  lyrics: string,
  fromKey: string | null,
  toKey: string
) {
  if (!fromKey || fromKey === toKey) return lyrics

  return lyrics
    .split('\n')
    .map((line) => {
      if (line.includes('[')) {
        return line.replace(/\[([^\]]+)\]/g, (full, inside) => {
          const parts = inside.split('/')
          return (
            '[' +
            parts
              .map((p: string) =>
                isChordToken(p.trim())
                  ? transposeChord(p.trim(), fromKey, toKey)
                  : p
              )
              .join('/') +
            ']'
          )
        })
      }

      return line
        .split(/(\s+)/)
        .map((part) => {
          const t = part.trim()
          if (!t) return part
          return isChordToken(t)
            ? part.replace(t, transposeChord(t, fromKey, toKey))
            : part
        })
        .join('')
    })
    .join('\n')
}

// -------- CHORDPRO VIEW HELPERS ---------

type ViewLine =
  | { type: 'section'; label: string }
  | { type: 'comment'; text: string }
  | { type: 'chordLyrics'; chords: string; lyrics: string }
  | { type: 'chords'; chords: string }
  | { type: 'text'; text: string }

function chordProLineToTwoLines(line: string) {
  let chords = ''
  let lyrics = ''
  let i = 0

  while (i < line.length) {
    const c = line[i]
    if (c === '[') {
      const end = line.indexOf(']', i + 1)
      if (end === -1) {
        lyrics += c
        chords += ' '
        i++
        continue
      }

      const chordText = line.slice(i + 1, end).trim()

      while (chords.length < lyrics.length) chords += ' '
      chords += chordText

      i = end + 1
    } else {
      lyrics += c
      chords += ' '
      i++
    }
  }

  return { chords, lyrics }
}

function buildChordProView(text: string): ViewLine[] {
  const out: ViewLine[] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r/, '')
    const t = line.trim()

    if (t === '') {
      out.push({ type: 'text', text: '' })
      continue
    }

    if (t.startsWith('{') && t.endsWith('}')) {
      out.push({ type: 'section', label: t.slice(1, -1).trim() })
      continue
    }

    if (t.startsWith('#') || t.startsWith(';')) {
      out.push({
        type: 'comment',
        text: t.replace(/^([#;]\s*)/, ''),
      })
      continue
    }

    const tokens = t.split(/\s+/)
    if (tokens.every((x) => isChordToken(x))) {
      out.push({ type: 'chords', chords: line })
      continue
    }

    if (line.includes('[') && line.includes(']')) {
      const { chords, lyrics } = chordProLineToTwoLines(line)
      if (chords.trim()) {
        out.push({ type: 'chordLyrics', chords, lyrics })
        continue
      }
    }

    out.push({ type: 'text', text: line })
  }
  return out
}

// ------------------- PAGE -----------------------

export default function SetlistServicePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [songs, setSongs] = useState<ServiceSongRow[]>([])
  const [loading, setLoading] = useState(true)

  // FONT SIZE CONTROL (+ / –)
  const [fontStep, setFontStep] = useState(1)
  const fontClasses = ['text-xs', 'text-sm', 'text-base', 'text-lg']
  const fontLabels = ['Жижиг', 'Дунд', 'Том', 'Маш том']

  // Хэрэглэгч
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth session load error:', error)
        }

        if (!ignore) {
          setUser(data.session?.user ?? null)
        }
      } catch (e) {
        console.error('Unexpected auth error:', e)
        if (!ignore) {
          setUser(null)
        }
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!ignore) {
        setUser(s?.user ?? null)
      }
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  // Setlist + songs
  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data, error } = await supabase
        .from('setlists')
        .select(`
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
              tempo,
              lyrics
            )
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) {
        console.error(error)
        setSetlist(null)
        setSongs([])
        setLoading(false)
        return
      }

      const base = data as any
      setSetlist({
        id: base.id,
        name: base.name,
        date: base.date,
      })

      const rows = (base.setlist_songs || []) as ServiceSongRow[]
      rows.sort((a, b) => a.position - b.position)

      setSongs(rows)
      setLoading(false)
    }

    if (params.id) load()
  }, [params.id])

  if (loading) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Service view ачаалж байна…
      </p>
    )
  }

  if (!setlist) {
    return (
      <div className="space-y-2 max-w-md">
        <p className="text-sm text-red-500 dark:text-red-400">
          Жагсаалт олдсонгүй.
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

  return (
    <div className="max-w-5xl space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push(`/setlists/${setlist.id}`)}
          className="
            inline-flex items-center gap-2
            px-3 py-1 text-xs font-medium rounded border
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700
          "
        >
          ← Жагсаалтын дэлгэрэнгүй
        </button>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            {setlist.name}{' '}
            {setlist.date ? `(${setlist.date})` : ''}
          </span>

          {/* FONT SIZE CONTROL */}
          <div className="flex items-center gap-1">
            <button
              className="
                w-7 h-7 flex items-center justify-center text-sm rounded border
                border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                hover:bg-slate-100 dark:hover:bg-slate-800
                dark:border-slate-700 disabled:opacity-40
              "
              disabled={fontStep === 0}
              onClick={() =>
                setFontStep((s) => Math.max(0, s - 1))
              }
            >
              –
            </button>

            <span className="text-xs w-16 text-center text-slate-600 dark:text-slate-400">
              {fontLabels[fontStep]}
            </span>

            <button
              className="
                w-7 h-7 flex items-center justify-center text-sm rounded border
                border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                hover:bg-slate-100 dark:hover:bg-slate-800
                dark:border-slate-700 disabled:opacity-40
              "
              disabled={fontStep === 3}
              onClick={() =>
                setFontStep((s) => Math.min(3, s + 1))
              }
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Songs list */}
      <div className="space-y-10">
        {songs.map((row, index) => {
          const originalKey = row.song.original_key ?? ''
          const effectiveKey = row.key_override || originalKey
          const text =
            originalKey && effectiveKey
              ? transposeLyrics(
                  row.song.lyrics || '',
                  originalKey,
                  effectiveKey
                )
              : row.song.lyrics || ''

          const view = buildChordProView(text)

          return (
            <section
              key={row.id}
              className="
                border rounded px-4 py-4 space-y-3
                border-slate-200 bg-[var(--background)]
                dark:border-slate-700
              "
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    #{index + 1}
                  </div>
                  <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                    {row.song.title}
                  </h2>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Анхны тон: {originalKey || '-'} · Темпо:{' '}
                    {row.song.tempo || '-'}
                  </div>
                </div>

                {/* Tone selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Тон:
                  </span>
                  <select
                    value={effectiveKey}
                    onChange={(e) => {
                      const newKey = e.target.value || null
                      setSongs((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? {
                                ...r,
                                key_override: newKey,
                              }
                            : r
                        )
                      )
                    }}
                    className="
                      border rounded px-2 py-1 text-xs
                      border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                      dark:border-slate-700
                    "
                  >
                    <option value="">Анхны</option>
                    {NOTES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ChordPro view */}
              <div
                className={[
                  'border rounded px-3 py-3 font-mono space-y-1 w-full overflow-x-auto',
                  'border-slate-200 bg-[var(--background)] dark:border-slate-700',
                  fontClasses[fontStep],
                ].join(' ')}
              >
                {view.map((line, idx) => {
                  if (line.type === 'section') {
                    const s = line.label.toLowerCase()
                    let cls =
                      'text-slate-700 border-slate-300 bg-slate-100 dark:text-slate-200 dark:border-slate-500 dark:bg-slate-800'

                    if (s.startsWith('verse')) {
                      cls =
                        'text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-200 dark:border-emerald-500 dark:bg-emerald-900/30'
                    } else if (s.startsWith('chorus')) {
                      cls =
                        'text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-200 dark:border-amber-500 dark:bg-amber-900/30'
                    } else if (s.startsWith('bridge')) {
                      cls =
                        'text-purple-700 border-purple-300 bg-purple-50 dark:text-purple-200 dark:border-purple-500 dark:bg-purple-900/30'
                    } else if (
                      s.startsWith('intro') ||
                      s.startsWith('outro') ||
                      s.startsWith('pre-chorus')
                    ) {
                      cls =
                        'text-sky-700 border-sky-300 bg-sky-50 dark:text-sky-200 dark:border-sky-500 dark:bg-sky-900/30'
                    }

                    return (
                      <div key={idx} className="mt-4 mb-1">
                        <span
                          className={[
                            'px-2 py-0.5 border rounded-full text-[10px] font-semibold uppercase',
                            cls,
                          ].join(' ')}
                        >
                          {line.label}
                        </span>
                      </div>
                    )
                  }

                  if (line.type === 'comment') {
                    return (
                      <div
                        key={idx}
                        className="text-xs text-slate-500 dark:text-slate-400 italic"
                      >
                        {line.text}
                      </div>
                    )
                  }

                  if (line.type === 'chordLyrics') {
                    return (
                      <div key={idx}>
                        <div className="whitespace-pre text-blue-700 dark:text-blue-300 pl-4">
                          {line.chords}
                        </div>
                        <div className="whitespace-pre">
                          {line.lyrics}
                        </div>
                      </div>
                    )
                  }

                  if (line.type === 'chords') {
                    return (
                      <div
                        key={idx}
                        className="whitespace-pre text-blue-700 dark:text-blue-300 pl-4"
                      >
                        {line.chords}
                      </div>
                    )
                  }

                  return (
                    <div
                      key={idx}
                      className="whitespace-pre"
                    >
                      {line.text}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}