'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  // ───────── Profile нэмэлт талбарууд ─────────
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  const [roles, setRoles] = useState({
    lead: false,
    vocal: false,
    acoustic: false,
    electric: false,
    piano: false,
    bass: false,
    drum: false,
    sound: false,
    visual: false,
    live: false,
  })

  function toggleRole(key: keyof typeof roles) {
    setRoles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // ───────── Ерөнхий state ─────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()

    // Signup валидаци
    if (mode === 'signup') {
      if (!trimmedEmail) {
        setError('Имэйл хаяг оруулна уу.')
        return
      }

      if (!fullName.trim()) {
        setError('Нэр заавал оруулна.')
        return
      }

      if (password.length < 6) {
        setError('Нууц үг дор хаяж 6 тэмдэгт байх ёстой.')
        return
      }

      if (password !== passwordConfirm) {
        setError('Нууц үг хоорондоо таарахгүй байна.')
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        // ───────── Нэвтрэх ─────────
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (error) throw error

        router.push('/')
        router.refresh()
        return
      }

      // ───────── Бүртгүүлэх + profiles insert ─────────
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      })
      if (signUpError) throw signUpError

      const user = data.user
      if (!user) {
        throw new Error('Хэрэглэгч үүссэнгүй.')
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: fullName.trim(),
          phone: phone.trim() || null,

          lead: roles.lead,
          vocal: roles.vocal,
          acoustic: roles.acoustic,
          electric: roles.electric,
          piano: roles.piano,
          bass: roles.bass,
          drum: roles.drum,
          sound: roles.sound,
          visual: roles.visual,
          live: roles.live,
        })

      if (profileError) throw profileError

      router.push('/')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Алдаа гарлаа.')
    } finally {
      setLoading(false)
    }
  }

  function switchTo(modeValue: 'login' | 'signup') {
    setMode(modeValue)
    setError(null)
    setPassword('')
    setPasswordConfirm('')
    // Signup-ээс login руу шилжихэд форм цэвэр болгоё
    if (modeValue === 'login') {
      setFullName('')
      setPhone('')
      setRoles({
        lead: false,
        vocal: false,
        acoustic: false,
        electric: false,
        piano: false,
        bass: false,
        drum: false,
        sound: false,
        visual: false,
        live: false,
      })
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">
        {mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="
          space-y-4 rounded border px-4 py-4
          border-slate-200 bg-[var(--background)]
          dark:border-slate-700
        "
      >
        {/* Имэйл */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Имэйл</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="
              rounded border px-3 py-2 text-sm
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              placeholder:text-slate-400
              dark:border-slate-700 dark:placeholder:text-slate-500
            "
            autoComplete={mode === 'login' ? 'email' : 'new-email'}
          />
        </div>

        {/* Signup үед нэмэлт талбарууд */}
        {mode === 'signup' && (
          <>
            {/* Нэр */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Нэр</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="
                  rounded border px-3 py-2 text-sm
                  border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                  placeholder:text-slate-400
                  dark:border-slate-700 dark:placeholder:text-slate-500
                "
              />
            </div>

            {/* Утас */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Утас</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="
                  rounded border px-3 py-2 text-sm
                  border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                  placeholder:text-slate-400
                  dark:border-slate-700 dark:placeholder:text-slate-500
                "
              />
            </div>

            {/* Үйлчлэлүүд */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Үйлчлэл (role) – холбогдох бүхийгээ сонго
              </label>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.lead}
                    onChange={() => toggleRole('lead')}
                  />
                  <span>Lead</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.vocal}
                    onChange={() => toggleRole('vocal')}
                  />
                  <span>Vocal</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.acoustic}
                    onChange={() => toggleRole('acoustic')}
                  />
                  <span>Acoustic</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.electric}
                    onChange={() => toggleRole('electric')}
                  />
                  <span>Electric</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.piano}
                    onChange={() => toggleRole('piano')}
                  />
                  <span>Piano</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.bass}
                    onChange={() => toggleRole('bass')}
                  />
                  <span>Bass</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.drum}
                    onChange={() => toggleRole('drum')}
                  />
                  <span>Drum</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.sound}
                    onChange={() => toggleRole('sound')}
                  />
                  <span>Sound</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.visual}
                    onChange={() => toggleRole('visual')}
                  />
                  <span>Visual</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.live}
                    onChange={() => toggleRole('live')}
                  />
                  <span>Live</span>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Нууц үг */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Нууц үг</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="
              rounded border px-3 py-2 text-sm
              border-slate-300 bg-[var(--background)] text-[var(--foreground)]
              placeholder:text-slate-400
              dark:border-slate-700 dark:placeholder:text-slate-500
            "
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
          />
        </div>

        {/* Нууц үг баталгаажуулах – зөвхөн signup */}
        {mode === 'signup' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              Нууц үгээ давтан оруулна уу
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="
                rounded border px-3 py-2 text-sm
                border-slate-300 bg-[var(--background)] text-[var(--foreground)]
                placeholder:text-slate-400
                dark:border-slate-700 dark:placeholder:text-slate-500
              "
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full inline-flex items-center justify-center
            rounded border px-3 py-2 text-sm font-medium
            border-slate-300 bg-[var(--background)] text-[var(--foreground)]
            hover:bg-slate-100 dark:hover:bg-slate-800
            dark:border-slate-700 disabled:opacity-60
          "
        >
          {loading
            ? 'Түр хүлээнэ үү...'
            : mode === 'login'
            ? 'Нэвтрэх'
            : 'Бүртгүүлэх'}
        </button>
      </form>

      <div className="mt-2 text-sm">
        {mode === 'login' ? (
          <button
            type="button"
            className="underline"
            onClick={() => switchTo('signup')}
          >
            Шинэ хэрэглэгч үү? Бүртгүүлэх
          </button>
        ) : (
          <button
            type="button"
            className="underline"
            onClick={() => switchTo('login')}
          >
            Аль хэдийн бүртгэлтэй юу? Нэвтрэх
          </button>
        )}
      </div>
    </div>
  )
}