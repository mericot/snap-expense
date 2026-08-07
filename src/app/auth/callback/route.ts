import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-server'
import { AUTH_ERROR_ROUTE, authErrorReason } from '@/app/auth/error/reasons'

/**
 * Magic-link landing route.
 *
 * This was a client component that ran `exchangeCodeForSession` in a
 * `useEffect`. It worked, but it made the browser the only thing that could
 * finish a sign-in: the user arrived signed-out, React hydrated, an effect ran,
 * a network round trip happened, and only then did a session exist. Two ways
 * that goes wrong, both structural rather than observed here. First, `/receipts`
 * is gated in src/proxy.ts, so `router.replace('/receipts')` depended on the
 * session cookie being written before the proxy's `getUser()` read it, and a
 * loser of that race is bounced back to `/login`. Second, `detectSessionInUrl`
 * is on by default in the browser client, so supabase-js was *also* trying to
 * consume the same single-use code as the explicit `exchangeCodeForSession`
 * call — and the code is valid exactly once.
 *
 * Doing the exchange here removes both. Set-Cookie is attached to the redirect
 * response itself, so the session exists before the browser makes any further
 * request, and the code is consumed exactly once by code that is not racing
 * itself.
 *
 * Route Handlers are uncached by default in Next 16 and reading
 * `request.cookies` opts out of prerendering regardless, so no `dynamic` export
 * is needed here.
 */

const SIGNED_IN_HOME = '/receipts'
const SIGNED_OUT_HOME = '/login'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // Every exit from this route goes through here, and it can only ever send the
  // user to a path on the origin they are already on.
  //
  // `Location` is deliberately relative — RFC 9110 allows it and the browser
  // resolves it against the request URL. The obvious alternative,
  // `NextResponse.redirect(request.nextUrl.clone())`, was tried first and is
  // wrong: `nextUrl` reports the address the server is *bound* to, not the host
  // the user asked for. Running `next dev -H 0.0.0.0` and fetching
  // `localhost:3000/auth/callback?error_code=otp_expired` produced
  // `Location: http://0.0.0.0:3000/auth/error?reason=expired`. On Vercel the
  // same inference sits behind a proxy, where guessing the public host is a
  // good way to hand someone a redirect to the wrong origin mid-sign-in.
  //
  // Not inferring a host also means this cannot emit a cross-origin redirect
  // even if something upstream is wrong: the only inputs are constants and
  // `safeNext`, which rejects anything a browser could read as an origin.
  const goTo = (path: string) =>
    new NextResponse(null, { status: 307, headers: { Location: path } })

  const failWith = (reason: string) =>
    goTo(`${AUTH_ERROR_ROUTE}?${new URLSearchParams({ reason })}`)

  // Supabase reports a dead link (expired, already used, user cancelled) as
  // query params on the redirect, not as an exchange failure — there is no code
  // to exchange in that case. Handle it before touching the client.
  const providerError =
    params.get('error_code') ?? params.get('error') ?? params.get('error_description')
  if (providerError) {
    return failWith(authErrorReason(providerError))
  }

  const code = params.get('code')
  const { supabase, applyCookies } = createSupabaseRouteClient(request)

  if (!code) {
    // Someone opened /auth/callback directly, or the proxy forwarded something
    // that turned out not to be an auth redirect after all.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return applyCookies(goTo(user ? SIGNED_IN_HOME : SIGNED_OUT_HOME))
  }

  // PKCE stores the code verifier in a cookie, which is scoped to one host and
  // one browser. If it is missing, the exchange is guaranteed to fail and the
  // reason is worth saying out loud — "invalid request" tells the user nothing
  // actionable, "open it in the browser you asked from" does. See
  // docs/auth-setup.md for why this happens and what would remove it.
  const hasVerifier = request.cookies.getAll().some((c) => c.name.endsWith('-code-verifier'))
  if (!hasVerifier) {
    return failWith('different_browser')
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // A stale link clicked by someone who is already signed in is not a
    // failure worth showing a page for — send them to the app.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) return applyCookies(goTo(SIGNED_IN_HOME))

    return failWith(authErrorReason(error.code ?? error.message))
  }

  return applyCookies(goTo(safeNext(params.get('next')) ?? SIGNED_IN_HOME))
}

/**
 * src/proxy.ts sends signed-out visitors to `/login?next=<where they wanted to
 * go>`, so a login page can round-trip that through `emailRedirectTo` and land
 * the user where they started. Nothing does that yet — task 02 owns the login
 * page — but honouring it here means the open-redirect check lives in one place
 * that has already been reviewed, rather than being written fresh later.
 *
 * Only same-origin *paths* pass: a leading `/`, but not `//host` or `/\host`
 * (both of which browsers read as protocol-relative), and no backslashes or
 * control characters that URL parsers disagree about.
 */
function safeNext(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    if (ch === '\\' || code < 0x20 || code === 0x7f) return null
  }
  return value
}
