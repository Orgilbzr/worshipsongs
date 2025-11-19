'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()

    if (mode === 'signup') {
      if (!trimmedEmail) {
        setError('Имэйл хаяг оруулна уу.')
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
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        })
        if (error) throw error
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
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
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">
        {mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 border border-slate-200 rounded px-4 py-4 bg-white"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Имэйл</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm bg-white"
            autoComplete={mode === 'login' ? 'email' : 'new-email'}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Нууц үг</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm bg-white"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

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
              className="border border-slate-300 rounded px-3 py-2 text-sm bg-white"
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded border border-slate-300 bg-white text-slate-900 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60"
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