import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-server'
import { AUTH_ERROR_ROUTE, authErrorReason } from '@/app/auth/error/reasons'
import { safeNext } from '@/lib/safe-next'
import { track } from '@/lib/analytics'

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

  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // A stale link clicked by someone who is already signed in is not a
    // failure worth showing a page for — send them to the app.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) return applyCookies(goTo(SIGNED_IN_HOME))

    return failWith(authErrorReason(error.code ?? error.message))
  }

  // Signup or return visit?
  //
  // Supabase does not say. Magic-link sign-in and magic-link registration are
  // the same exchange against the same endpoint, and the session it hands back
  // looks identical either way — so the account's own age is the only thing
  // here that can tell them apart.
  //
  // The window is generous because it is spanning a human action: the account
  // row is created when the link is *requested*, and the event is recorded when
  // it is *clicked*, with an email delivery and someone finding it in their
  // inbox in between. A minute would misfile most real signups as returning
  // users. Anyone whose first click is more than an hour after requesting the
  // link is counted as returning, which is wrong, and wrong in the direction
  // that understates signups rather than inventing them.
  const createdAt = exchanged.user?.created_at
  const isNew =
    createdAt !== undefined && Date.now() - new Date(createdAt).getTime() < 60 * 60 * 1000

  if (exchanged.user) {
    track(isNew ? 'signed_up' : 'signed_in', { userId: exchanged.user.id })
  }

  return applyCookies(goTo(safeNext(params.get('next')) ?? SIGNED_IN_HOME))
}
