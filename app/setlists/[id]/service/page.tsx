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
  'C','C#','D','D#','E','F','F#','G','G#','A','A#','B'
] as const

type Note = (typeof NOTES)[number]

function normalizeNote(input: string): Note | null {
  const up = input.trim().toUpperCase()
  const flat: Record<string, Note> = {
    DB:'C#', EB:'D#', GB:'F#', AB:'G#', BB:'A#'
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
    (NOTES.indexOf(to) - NOTES.indexOf(from) + NOTES.length) % NOTES.length

  const newIndex =
    (NOTES.indexOf(root) + diff + NOTES.length) % NOTES.length

  return NOTES[newIndex] + suf
}

function transposeLyrics(lyrics: string, fromKey: string | null, toKey: string) {
  if (!fromKey || fromKey === toKey) return lyrics

  return lyrics
    .split('\n')
    .map(line => {
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
        .map(part => {
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

// -------- CHORDPRO LUXURY VIEW HELPERS ---------

type ViewLine =
  | { type:'section'; label:string }
  | { type:'comment'; text:string }
  | { type:'chordLyrics'; chords:string; lyrics:string }
  | { type:'chords'; chords:string }
  | { type:'text'; text:string }

function chordProLineToTwoLines(line: string) {
  let chords = ''
  let lyrics = ''
  let i = 0

  while (i < line.length) {
    const c = line[i]
    if (c === '[') {
      const end = line.indexOf(']', i+1)
      if (end === -1) {
        lyrics += c
        chords += ' '
        i++
        continue
      }

      const chordText = line.slice(i+1, end).trim()

      while (chords.length < lyrics.length) chords += ' '
      chords += chordText

      i = end+1
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
      out.push({ type:'text', text:'' })
      continue
    }

    if (t.startsWith('{') && t.endsWith('}')) {
      out.push({ type:'section', label:t.slice(1,-1).trim() })
      continue
    }

    if (t.startsWith('#') || t.startsWith(';')) {
      out.push({ type:'comment', text:t.replace(/^([#;]\s*)/, '') })
      continue
    }

    const tokens = t.split(/\s+/)
    if (tokens.every(x => isChordToken(x))) {
      out.push({ type:'chords', chords:line })
      continue
    }

    if (line.includes('[') && line.includes(']')) {
      const { chords, lyrics } = chordProLineToTwoLines(line)
      if (chords.trim()) {
        out.push({ type:'chordLyrics', chords, lyrics })
        continue
      }
    }

    out.push({ type:'text', text:line })
  }
  return out
}

// ------------------- PAGE -----------------------

export default function SetlistServicePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [user, setUser] = useState<User|null>(null)
  const [setlist, setSetlist] = useState<Setlist|null>(null)
  const [songs, setSongs] = useState<ServiceSongRow[]>([])
  const [loading, setLoading] = useState(true)

  // FONT SIZE CONTROL (+ / –)
  const [fontStep, setFontStep] = useState(1)
  const fontClasses = ['text-xs','text-sm','text-base','text-lg']
  const fontLabels  = ['Жижиг','Дунд','Том','Маш том']

  // Load user (optional)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
    })
    supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null)
    })
  }, [])

  // Load setlist + lyrics
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
        setSetlist(null)
        setSongs([])
        setLoading(false)
        return
      }

      const base = data as any
      setSetlist({
        id: base.id,
        name: base.name,
        date: base.date
      })

      const rows = (base.setlist_songs || []) as ServiceSongRow[]
      rows.sort((a,b) => a.position - b.position)

      setSongs(rows)
      setLoading(false)
    }

    if (params.id) load()
  }, [params.id])

  if (loading) return <p>Service view ачаалж байна…</p>
  if (!setlist) {
    return (
      <div>
        <p className="text-red-500">Жагсаалт олдсонгүй.</p>
        <button onClick={() => router.push('/setlists')} className="underline text-sm">
          Буцах
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/setlists/${setlist.id}`)}
          className="text-sm underline"
        >
          ← Жагсаалтын дэлгэрэнгүй
        </button>

        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>
            {setlist.name} {setlist.date ? `(${setlist.date})` : ''}
          </span>

          {/* FONT SIZE CONTROL */}
          <div className="flex items-center gap-1 text-white">
            <button
              className="w-7 h-7 border rounded flex items-center justify-center disabled:opacity-40"
              disabled={fontStep === 0}
              onClick={() => setFontStep(s => Math.max(0, s - 1))}
            >
              –
            </button>

            <span className="text-xs w-16 text-center">
              {fontLabels[fontStep]}
            </span>

            <button
              className="w-7 h-7 border rounded flex items-center justify-center disabled:opacity-40"
              disabled={fontStep === 3}
              onClick={() => setFontStep(s => Math.min(3, s + 1))}
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
              ? transposeLyrics(row.song.lyrics || '', originalKey, effectiveKey)
              : (row.song.lyrics || '')

          const view = buildChordProView(text)

          return (
            <section
              key={row.id}
              className="border rounded px-4 py-4 bg-black/40 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-500">#{index + 1}</div>
                  <h2 className="text-2xl font-semibold">{row.song.title}</h2>
                  <div className="text-xs text-gray-400">
                    Анхны тон: {originalKey || '-'} · Темпо: {row.song.tempo || '-'}
                  </div>
                </div>

                {/* Tone selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs">Тон:</span>
                  <select
                    value={effectiveKey}
                    onChange={e => {
                      const newKey = e.target.value || null
                      row.key_override = newKey
                      const updated = [...songs]
                      setSongs(updated)
                    }}
                    className="border rounded px-2 py-1 text-xs bg-black"
                  >
                    <option value="">Анхны</option>
                    {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* LUXURY VIEW */}
              <div
                className={[
                  'border rounded px-3 py-3 font-mono bg-black/40 space-y-1',
                  fontClasses[fontStep]
                ].join(' ')}
              >
                {view.map((line, idx) => {

                  if (line.type === 'section') {
                    const s = line.label.toLowerCase()
                    let cls = 'text-gray-300 border-gray-600 bg-gray-900/40'

                    if (s.startsWith('verse')) cls = 'text-emerald-300 border-emerald-600 bg-emerald-900/20'
                    if (s.startsWith('chorus')) cls = 'text-amber-300 border-amber-600 bg-amber-900/20'
                    if (s.startsWith('bridge')) cls = 'text-purple-300 border-purple-600 bg-purple-900/20'
                    if (s.startsWith('intro') || s.startsWith('outro') || s.startsWith('pre-chorus'))
                      cls = 'text-sky-300 border-sky-600 bg-sky-900/20'

                    return (
                      <div key={idx} className="mt-4 mb-1">
                        <span
                          className={[
                            'px-2 py-0.5 border rounded-full text-[10px] font-semibold uppercase',
                            cls
                          ].join(' ')}
                        >
                          {line.label}
                        </span>
                      </div>
                    )
                  }

                  if (line.type === 'comment') {
                    return (
                      <div key={idx} className="text-gray-400 italic text-xs">
                        {line.text}
                      </div>
                    )
                  }

                  if (line.type === 'chordLyrics') {
                    return (
                      <div key={idx}>
                        <div className="whitespace-pre text-blue-300 pl-4">
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
                      <div key={idx} className="whitespace-pre text-blue-300 pl-4">
                        {line.chords}
                      </div>
                    )
                  }

                  return (
                    <div key={idx} className="whitespace-pre">
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