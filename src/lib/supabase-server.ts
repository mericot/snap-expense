import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )
}

/**
 * Supabase client for a Route Handler that ends in a redirect.
 *
 * `createSupabaseServerClient` writes through `cookies()` from next/headers,
 * which is the right tool when Next.js owns the response. It is the wrong tool
 * here: this route decides *where* to send the user based on the outcome of the
 * exchange, so the response object does not exist yet when Supabase asks to
 * write the session cookie.
 *
 * So writes are buffered and replayed onto whichever response we end up
 * returning, via `applyCookies`. Set-Cookie then rides on the 307 itself — the
 * browser stores the session before it issues the follow-up GET, and the proxy
 * sees a signed-in user on the very next request. Nothing depends on how the
 * framework merges `cookies()` mutations into a hand-built `NextResponse`,
 * which is the part of this that has historically been version-sensitive.
 *
 * Cookies are not httpOnly (that is `@supabase/ssr`'s default and it is load
 * bearing) so the browser client in SessionProvider can read the same session.
 */
export function createSupabaseRouteClient(request: NextRequest) {
  const pending: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pending.push(...cookiesToSet)
        },
      },
    }
  )

  function applyCookies<T extends NextResponse>(response: T): T {
    for (const { name, value, options } of pending) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  return { supabase, applyCookies }
}
