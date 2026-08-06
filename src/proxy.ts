import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Server-side auth gate. (Next.js 16 renamed `middleware` to `proxy`; same
 * mechanism.)
 *
 * The alternative — gating on the client after hydration — renders the wrong
 * page for a beat before redirecting. On `/` the wrong page is a whole
 * marketing site, so the gate runs here instead, before anything is sent.
 *
 * This is an *optimistic* check, not the authorization boundary. Row-level
 * security in Postgres is what actually protects a user's expenses, and
 * /api/extract authenticates independently. If this file were deleted, no data
 * would leak; visitors would just land on pages that are useless to them.
 */

/** Signed in, but on a page only signed-out visitors need. */
const PUBLIC_ONLY = ['/', '/login']

/** Signed out, but on a page that needs a session. */
const AUTHENTICATED_ONLY = ['/receipts', '/checkout']

const SIGNED_IN_HOME = '/receipts'
const SIGNED_OUT_HOME = '/login'

function matches(pathname: string, routes: string[]) {
  return routes.some((route) =>
    route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`),
  )
}

export async function proxy(request: NextRequest) {
  // `response` is reassigned by setAll below so refreshed auth cookies survive
  // whichever branch we return from.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getUser() revalidates the token with the auth server rather than trusting
  // the cookie. With no cookie at all it fails locally, so anonymous visitors to
  // `/` do not pay for a round trip.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl

  if (user && matches(pathname, PUBLIC_ONLY)) {
    return redirectPreservingCookies(request, response, SIGNED_IN_HOME)
  }

  if (!user && matches(pathname, AUTHENTICATED_ONLY)) {
    // `next` lets task 02 return the visitor to where they were headed once
    // they have signed in.
    const target = `${SIGNED_OUT_HOME}?next=${encodeURIComponent(pathname + search)}`
    return redirectPreservingCookies(request, response, target)
  }

  return response
}

function redirectPreservingCookies(request: NextRequest, source: NextResponse, to: string) {
  const redirect = NextResponse.redirect(new URL(to, request.url))
  for (const cookie of source.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export const config = {
  matcher: ['/', '/login', '/receipts/:path*', '/checkout/:path*'],
}
