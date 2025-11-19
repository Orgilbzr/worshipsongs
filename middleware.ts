// middleware.ts  (project root дээр)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  createServerClient,
  type CookieOptions,
} from '@supabase/ssr'

// Supabase middleware client-ийг өөрөө тодорхойлж байна
function createMiddlewareClient(req: NextRequest) {
  // Эхний хоосон response
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // чиний env-д тааруулаад
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // request талын cookie-гээ шинэчилнэ
          req.cookies.set({ name, value, ...options })

          // шинэ response үүсгээд cookie-г нь тааруулна
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options })

          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  return { supabase, res }
}

export async function middleware(req: NextRequest) {
  const { supabase, res } = createMiddlewareClient(req)

  // энд session cookie-г refresh хийж, сервер тал руу зөв дамжуулна
  await supabase.auth.getSession()

  return res
}