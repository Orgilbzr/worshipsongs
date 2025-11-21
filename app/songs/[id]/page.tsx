'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type SongDetail = {
  id: string
  title: string
  original_key: string | null
  tempo: string | null
  lyrics: string
  youtube_url: string | null
  created_at: string
}

type SimpleSetlist = {
  id: string
  name: string
  date: string | null
}

// -------------------- TRANSPOSE HELPERS --------------------

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
  const flats: Record<string, Note> = {
    DB: 'C#',
    EB: 'D#',
    GB: 'F#',
    AB: 'G#',
    BB: 'A#',
  }
  if (NOTES.includes(up as Note)) return up as Note
  if (flats[up]) return flats[up]
  return null
}

function isChordToken(token: string): boolean {
  const t = token.trim()
  if (!t) return false
  const m = t.match(/^([A-Ga-g][b#]?)(.*)$/)
  if (!m) return false
  const suffix = m[2] ?? ''
  if (suffix.length > 4) return false
  if (!suffix) return true
  return /^[a-z0-9]+$/i.test(suffix)
}

function transposeChord(chord: string, fromKey: string, toKey: string): string {
  const from = normalizeNote(fromKey)
  const to = normalizeNote(toKey)
  if (!from || !to) return chord

  const m = chord.match(/^([A-Ga-g][b#]?)(.*)$/)
  if (!m) return chord

  const rootRaw = m[1]
  const suffix = m[2] ?? ''
  const root = normalizeNote(rootRaw)
  if (!root) return chord

  const diff =
    (NOTES.indexOf(to) - NOTES.indexOf(from) + NOTES.length) % NOTES.length
  const newIndex =
    (NOTES.indexOf(root) + diff + NOTES.length) % NOTES.length

  return NOTES[newIndex] + suffix
}

function transposeLyrics(
  lyrics: string,
  fromKey: string | null,
  toKey: string
): string {
  if (!fromKey || fromKey.trim() === '' || fromKey === toKey) return lyrics

  return lyrics
    .split('\n')
    .map((line) => {
      if (line.includes('[') && line.includes(']')) {
        return line.replace(/\[([^\]]+)\]/g, (full, inner) => {
          const parts = String(inner).split('/')
          const mapped = parts.map((part) => {
            const trimmed = part.trim()
            if (!isChordToken(trimmed)) return trimmed
            return transposeChord(trimmed, fromKey, toKey)
          })
          return '[' + mapped.join('/') + ']'
        })
      }

      const parts = line.split(/(\s+)/)
      const mapped = parts.map((part) => {
        const trimmed = part.trim()
        if (!trimmed) return part
        if (!isChordToken(trimmed)) return part
        const newChord = transposeChord(trimmed, fromKey, toKey)
        return part.replace(trimmed, newChord)
      })
      return mapped.join('')
    })
    .join('\n')
}

// -------------------- CHORDPRO VIEW --------------------

type ViewLine =
  | { type: 'section'; label: string }
  | { type: 'comment'; text: string }
  | { type: 'chordLyrics'; chords: string; lyrics: string }
  | { type: 'chords'; chords: string }
  | { type: 'text'; text: string }

function chordProLineToTwoLines(line: string): {
  chords: string
  lyrics: string
} {
  let chords = ''
  let lyrics = ''
  let i = 0

  while (i < line.length) {
    const ch = line[i]
    if (ch === '[') {
      const end = line.indexOf(']', i + 1)
      if (end === -1) {
        lyrics += ch
        chords += ' '
        i++
        continue
      }
      const chordText = line.slice(i + 1, end).trim()

      while (chords.length < lyrics.length) chords += ' '
      chords += chordText

      i = end + 1
    } else {
      lyrics += ch
      chords += ch === '\t' ? '\t' : ' '
      i++
    }
  }

  return { chords, lyrics }
}

function buildChordProView(lyrics: string): ViewLine[] {
  const lines = lyrics.split('\n')
  const result: ViewLine[] = []

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    const trimmed = line.trim()

    if (trimmed === '') {
      result.push({ type: 'text', text: '' })
      continue
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim()
      result.push({ type: 'section', label: inner })
      continue
    }

    if (trimmed.startsWith('#') || trimmed.startsWith(';')) {
      result.push({
        type: 'comment',
        text: trimmed.replace(/^([#;]\s*)/, ''),
      })
      continue
    }

    const tokens = trimmed.split(/\s+/)
    if (tokens.length > 0 && tokens.every((t) => isChordToken(t))) {
      result.push({ type: 'chords', chords: line })
      continue
    }

    if (line.includes('[') && line.includes(']')) {
      const { chords, lyrics } = chordProLineToTwoLines(line)
      if (chords.trim().length > 0) {
        result.push({ type: 'chordLyrics', chords, lyrics })
        continue
      }
    }

    result.push({ type: 'text', text: line })
  }

  return result
}

// -------------------- PAGE COMPONENT --------------------

export default function SongDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [song, setSong] = useState<SongDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentKey, setCurrentKey] = useState<string | null>(null)

  // Фонтын хэмжээ: 0=жижиг, 1=дунд, 2=том, 3=маш том
  const [fontStep, setFontStep] = useState<number>(1)
  const fontClasses = ['text-xs', 'text-sm', 'text-base', 'text-lg']
  const fontLabels = ['Жижиг', 'Дунд', 'Том', 'Маш том']

  // Сүүлийн сетлистүүд
  const [setlists, setSetlists] = useState<SimpleSetlist[]>([])
  const [targetSetlistId, setTargetSetlistId] = useState<string>('')
  const [addingToSetlist, setAddingToSetlist] = useState(false)
  const [addSetlistError, setAddSetlistError] = useState<string | null>(null)
  const [addSetlistMessage, setAddSetlistMessage] = useState<string | null>(
    null
  )

  // Хэрэглэгч
  useEffect(() => {
    let ignore = false

    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      if (!ignore) {
        setUser(data.user ?? null)
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

  // Дууг ачаалах – нэвтрээгүй ч ачаална
  useEffect(() => {
    let ignore = false

    async function loadSong() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('songs')
        .select(
          'id, title, original_key, tempo, lyrics, youtube_url, created_at'
        )
        .eq('id', params.id)
        .single()

      if (ignore) return

      if (error) {
        console.error(error)
        setError(error.message)
        setSong(null)
      } else {
        const s = data as SongDetail
        const keyFromQuery = searchParams.get('key')
        setSong(s)
        setCurrentKey(
          keyFromQuery && keyFromQuery.trim()
            ? keyFromQuery
            : s.original_key ?? null
        )
      }
      setLoading(false)
    }

    if (params?.id) {
      loadSong()
    }

    return () => {
      ignore = true
    }
  }, [params?.id, searchParams])

  // Сүүлийн сетлистүүдийг ачаалах (зөвхөн нэвтэрсэн үед)
  useEffect(() => {
    if (!user) {
      setSetlists([])
      setTargetSetlistId('')
      return
    }

    let ignore = false

    async function loadSetlists() {
      const { data, error } = await supabase
        .from('setlists')
        .select('id, name, date')
        .order('date', { ascending: false })
        .limit(10)

      if (ignore) return
      if (error) {
        console.error(error)
        return
      }

      const list = (data ?? []) as SimpleSetlist[]
      setSetlists(list)

      if (!list.length) {
        setTargetSetlistId('')
      } else if (!targetSetlistId) {
        setTargetSetlistId(list[0].id)
      }
    }

    loadSetlists()

    return () => {
      ignore = true
    }
  }, [user, targetSetlistId])

  if (loading) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Дууны мэдээлэл ачаалж байна…
      </p>
    )
  }

  if (error || !song) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Дууны дэлгэрэнгүй</h1>
        <p className="text-sm text-red-500 dark:text-red-400">
          {error ? `Алдаа: ${error}` : 'Ийм дуу олдсонгүй.'}
        </p>
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
          ← Дууны сан руу буцах
        </button>
      </div>
    )
  }

  const effectiveKey = currentKey ?? song.original_key ?? ''
  const baseLyrics =
    effectiveKey && song.original_key
      ? transposeLyrics(song.lyrics, song.original_key, effectiveKey)
      : song.lyrics

  const viewLines = buildChordProView(baseLyrics)

  // --- Жагсаалт руу нэмэх handler ---
  async function handleAddToSetlist() {
    if (!user) {
      setAddSetlistError(
        'Жагсаалт руу нэмэхийн тулд нэвтэрсэн байх шаардлагатай.'
      )
      return
    }
    if (!targetSetlistId) {
      setAddSetlistError('Жагсаалт сонгоно уу.')
      return
    }
    if (!song) {
      setAddSetlistError('Дуу ачаалагдаагүй байна.')
      return
    }

    setAddingToSetlist(true)
    setAddSetlistError(null)
    setAddSetlistMessage(null)

    let nextPosition = 1
    const { data: posRows, error: posError } = await supabase
      .from('setlist_songs')
      .select('position')
      .eq('setlist_id', targetSetlistId)
      .order('position', { ascending: false })
      .limit(1)

    if (!posError && posRows && posRows.length > 0) {
      const p = (posRows[0] as any).position as number | null
      nextPosition = (p ?? 0) + 1
    }

    const { error: insertError } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: targetSetlistId,
        song_id: song.id,
        position: nextPosition,
        key_override: effectiveKey || song.original_key,
      })

    if (insertError) {
      console.error(insertError)
      setAddSetlistError('Жагсаалт руу нэмэхэд алдаа гарлаа.')
    } else {
      setAddSetlistMessage('Жагсаалт руу амжилттай нэмлээ.')
    }

    setAddingToSetlist(false)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Буцах товч – нэг загвар */}
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

      {/* Гарчиг + 'Засах' товч */}
      <div className="flex items-start justify_between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">{song.title}</h1>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Анхны тон: {song.original_key ?? '-'} · Темпо:{' '}
            {song.tempo ?? '-'}
          </div>
        </div>

        {user && (
          <button
            type="button"
            onClick={() => router.push(`/songs/new?id=${song.id}`)}
            className="
              inline-flex items-center justify-center
              px-3 py-1 text-xs font-medium rounded border
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              hover:bg-slate-100 dark:hover:bg-slate-800
              dark:border-slate-700
            "
          >
            Засах
          </button>
        )}
      </div>

      {/* Тон + фонт */}
      <div className="flex flex_wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font_medium">Одоогийн тон:</span>
          <select
            value={effectiveKey || ''}
            onChange={(e) => setCurrentKey(e.target.value || null)}
            className="
              border rounded px-2 py-1 text-sm
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              dark:border-slate-700
            "
          >
            <option value="">Анхны тон</option>
            {NOTES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Фонтын хэмжээ */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Фонт:</span>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setFontStep((s) => Math.max(0, s - 1))
              }
              disabled={fontStep === 0}
              className="
                w-7 h-7 flex items-center justify-center text-sm rounded border
                border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                hover:bg-slate-100 dark:hover:bg-slate-800
                dark:border-slate-700 disabled:opacity-40
              "
              title="Жижигрүүлэх"
            >
              –
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[70px] text-center">
              {fontLabels[fontStep]}
            </span>
            <button
              type="button"
              onClick={() =>
                setFontStep((s) => Math.min(3, s + 1))
              }
              disabled={fontStep === 3}
              className="
                w-7 h-7 flex items-center justify-center text-sm rounded border
                border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                hover:bg-slate-100 dark:hover:bg-slate-800
                dark:border-slate-700 disabled:opacity-40
              "
              title="Томруулах"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Youtube линк */}
      {song.youtube_url && (
        <div>
          <p className="text-sm font-medium mb-1">Youtube:</p>
          <a
            href={song.youtube_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 underline break-all"
          >
            {song.youtube_url}
          </a>
        </div>
      )}

      {/* ChordPro view */}
      <div
        className={[
          'border rounded px-3 py-3 font-mono space-y-1 w-full overflow-x-auto',
          'border-slate-200 bg-[var(--background)] dark:border-slate-700',
          fontClasses[fontStep],
        ].join(' ')}
      >
        {viewLines.map((line, idx) => {
          if (line.type === 'section') {
            const lower = line.label.toLowerCase()

            // Default (үл танигдсан секц) – light дээр илүү тод, цэвэр
            let badgeClass =
              'text-slate-900 border-slate-400 bg-white ' +
              'dark:text-slate-200 dark:border-slate-500 dark:bg-slate-800'

            if (lower.startsWith('verse')) {
              // VERSE – ногоон, light дээр цагаан фон + тод border
              badgeClass =
                'text-emerald-800 border-emerald-500 bg-white ' +
                'dark:text-emerald-200 dark:border-emerald-500 dark:bg-emerald-900/30'
            } else if (lower.startsWith('chorus')) {
              // CHORUS – улбар шар, цэвэр фон
              badgeClass =
                'text-amber-800 border-amber-500 bg-white ' +
                'dark:text-amber-200 dark:border-amber-500 dark:bg-amber-900/30'
            } else if (lower.startsWith('bridge')) {
              // BRIDGE – ягаан
              badgeClass =
                'text-purple-800 border-purple-500 bg-white ' +
                'dark:text-purple-200 dark:border-purple-500 dark:bg-purple-900/30'
            } else if (
              lower.startsWith('intro') ||
              lower.startsWith('outro') ||
              lower.startsWith('pre-chorus')
            ) {
              // INTRO / OUTRO / PRE-CHORUS – цэнхэр
              badgeClass =
                'text-sky-800 border-sky-500 bg-white ' +
                'dark:text-sky-200 dark:border-sky-500 dark:bg-sky-900/30'
            }

            return (
              <div key={idx} className="mt-4 mb-1">
                <span
                  className={[
                    'inline-flex items-center px-2 py-0.5 border rounded-full text-[12px] font-semibold tracking-wide uppercase',
                    badgeClass,
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
              <div key={idx} className="mb-1">
                <div className="whitespace-pre text-blue-800 dark:text-blue-300 pl-0">
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
                className="whitespace-pre text-blue-800 dark:text-blue-300 pl-0"
              >
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

      {/* --- Жагсаалт руу нэмэх блок --- */}
      {user && (
        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
          <h2 className="text-sm font-semibold">
            Жагсаалт руу нэмэх
          </h2>
          {setlists.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>Танд одоогоор сетлист алга байна.</p>
              <button
                type="button"
                onClick={() => router.push('/setlists/new')}
                className="text-xs underline"
              >
                Шинэ жагсаалт үүсгэх
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Сүүлийн үүсгэсэн жагсаалтуудаас сонгоод энэ дууг
                нэмнэ.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <select
                  value={targetSetlistId}
                  onChange={(e) =>
                    setTargetSetlistId(e.target.value)
                  }
                  className="
                    border rounded px-2 py-1 text-sm
                    border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                    dark:border-slate-700
                  "
                >
                  {setlists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.date ? `(${s.date})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAddToSetlist}
                  disabled={addingToSetlist || !targetSetlistId}
                  className="
                    inline-flex items-center justify-center
                    px-3 py-1 text-xs font-medium rounded border
                    border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                    hover:bg-slate-100 dark:hover:bg-slate-800
                    dark:border-slate-700 disabled:opacity-50
                  "
                >
                  {addingToSetlist
                    ? 'Нэмэж байна…'
                    : 'Жагсаалт руу нэмэх'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/setlists/new')}
                  className="text-xs underline"
                >
                  Шинэ жагсаалт үүсгэх
                </button>
              </div>

              {addSetlistError && (
                <p className="text-xs text-red-500 dark:text-slate-400">
                  {addSetlistError}
                </p>
              )}
              {addSetlistMessage && (
                <p className="text-xs text-emerald-600">
                  {addSetlistMessage}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}