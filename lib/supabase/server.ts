import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export function createClient() {
  // Next 16 дээр cookies() Promise гэж type-лагдсан тул
  // runtime-д буцаж байгаа объектыг any болгож cast хийж байна.
  const cookieStore = cookies() as any

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // cookieStore.get(...) дээр TypeScript дахиж гомдохгүй
          return cookieStore.get(name)?.value as string | undefined
        },
      },
    }
  )
}