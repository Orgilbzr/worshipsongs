'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Member = {
  id: string
  full_name: string | null
  phone: string | null
  lead: boolean
  vocal: boolean
  acoustic: boolean
  electric: boolean
  piano: boolean
  bass: boolean
  drum: boolean
  sound: boolean
  visual: boolean
  live: boolean
}

const ROLE_LABELS: { key: keyof Member; label: string }[] = [
  { key: 'lead', label: 'Lead' },
  { key: 'vocal', label: 'Vocal' },
  { key: 'acoustic', label: 'Acoustic' },
  { key: 'electric', label: 'Electric' },
  { key: 'piano', label: 'Piano' },
  { key: 'bass', label: 'Bass' },
  { key: 'drum', label: 'Drum' },
  { key: 'sound', label: 'Sound' },
  { key: 'visual', label: 'Visual' },
  { key: 'live', label: 'Live' },
]

export default function MembersPage() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        // 1) Нэвтэрсэн эсэхийг шалгана
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession()

        if (sessionError) {
          console.error('Auth session error', sessionError)
        }

        const user = sessionData.session?.user ?? null

        if (!user) {
          if (!ignore) {
            router.push('/login')
          }
          return
        }

        // 2) Бүх гишүүдийг profiles-оос татна
        const { data, error } = await supabase
          .from('profiles')
          .select(
            `
            id,
            full_name,
            phone,
            lead,
            vocal,
            acoustic,
            electric,
            piano,
            bass,
            drum,
            sound,
            visual,
            live
          `,
          )
          .order('full_name', { ascending: true })

        if (error) {
          console.error('Load members error', error)
          if (!ignore) {
            setError('Гишүүдийн мэдээлэл ачаалах үед алдаа гарлаа.')
            setMembers([])
          }
          return
        }

        if (!ignore) {
          setMembers((data ?? []) as Member[])
        }
      } catch (e) {
        console.error('Unexpected members load error', e)
        if (!ignore) {
          setError('Гэнэтийн алдаа гарлаа.')
          setMembers([])
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()

    return () => {
      ignore = true
    }
  }, [router])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-2">Магтаалын багийн гишүүд</h1>

      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ачаалж байна…
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && members.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Одоогоор бүртгэлтэй гишүүн алга.
        </p>
      )}

      {!loading && !error && members.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-3 py-2 text-left border-b border-slate-200 dark:border-slate-700">
                  Нэр
                </th>
                <th className="px-3 py-2 text-left border-b border-slate-200 dark:border-slate-700">
                  Утас
                </th>
                <th className="px-3 py-2 text-left border-b border-slate-200 dark:border-slate-700">
                  Үйлчлэлүүд
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const roles = ROLE_LABELS.filter(
                  ({ key }) => m[key] === true,
                ).map((r) => r.label)

                return (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                      {m.full_name || '(нэр байхгүй)'}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                      {m.phone || ''}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                      {roles.length === 0 ? (
                        <span className="text-slate-400 text-xs">
                          Үйлчлэл сонгогоогүй
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {roles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-[11px]
                                         dark:border-slate-600"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}