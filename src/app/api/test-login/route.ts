import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-server'
import { safeNext } from '@/lib/safe-next'
import { emailMatches, secretMatches, testLoginConfig } from '@/lib/test-login'

/**
 * Magic-link bypass for one configured address.
 *
 * The problem it solves is not that magic links are broken — they work. It is
 * that every sign-in during development costs an inbox round trip, and that
 * PKCE makes an automated sign-in impossible from anything that is not the
 * browser that asked for the link (see docs/auth-setup.md). A Playwright run
 * cannot click a link in a mailbox.
 *
 * What this deliberately is *not*: a second authentication system. It mints a
 * session the same way a magic link does, through the same Supabase endpoint,
 * producing a session indistinguishable from a real one. There is no "test
 * mode" flag downstream, no branch in the proxy, no RLS exemption — a test
 * session is a session, so what you exercise afterwards is the real app. The
 * only thing skipped is the email.
 *
 * How the session is minted, in two steps:
 *
 *   1. `admin.generateLink({ type: 'magiclink' })` asks Supabase for the link
 *      it *would have* emailed, and returns it instead of sending it. It also
 *      creates the user on first use, which is why there is no separate
 *      "create the test account" step anywhere. The useful half of the response
 *      is `properties.hashed_token`.
 *   2. `verifyOtp({ token_hash })` redeems that token for a session on a
 *      request-scoped client, whose cookie writes are buffered and attached to
 *      the response below.
 *
 * Step 2 is the `token_hash` flow docs/auth-setup.md describes as the fix for
 * PKCE's same-browser constraint: no code verifier is involved, so the caller
 * does not need to be the browser that started anything. That is exactly what
 * makes it scriptable — and exactly why the gate in src/lib/test-login.ts has
 * to hold. Read that file before changing this one.
 *
 * Not covered by src/proxy.ts's matcher, so nothing redirects it. Route
 * Handlers are uncached in Next 16 and POST is never cached regardless.
 */

/** Where a successful sign-in lands when the caller did not ask for anywhere. */
const SIGNED_IN_HOME = '/receipts'

/**
 * Best-effort brute-force damping. Honestly labelled: module scope is one
 * server instance, so a serverless deployment can have several of these and
 * a restart clears it. Against a 32-character secret it is not what is keeping
 * anyone out — the secret is. It is here so that a secret that is merely
 * *adequate* is not also unlimited-guess, which is the cheap half of the
 * protection.
 *
 * Counting only failures, and resetting on success, means a tester who fat
 * fingers the secret a few times and then gets it right is never locked out.
 */
const MAX_FAILURES = 10
const FAILURE_WINDOW_MS = 5 * 60 * 1000
let failures = 0
let windowStartedAt = 0

function throttled() {
  const now = Date.now()
  if (now - windowStartedAt > FAILURE_WINDOW_MS) {
    failures = 0
    windowStartedAt = now
  }
  return failures >= MAX_FAILURES
}

export async function POST(request: NextRequest) {
  const config = testLoginConfig()

  // 404, not 403. An environment without the bypass configured should be
  // indistinguishable from one built without this file, so probing production
  // tells an attacker nothing about whether the feature exists at all.
  if (!config) return new NextResponse(null, { status: 404 })

  if (throttled()) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in a few minutes.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }
  const { email, secret, next } = (body ?? {}) as Record<string, unknown>

  // Both checks always run and are combined at the end, rather than returning
  // early on a bad email. Early-returning would make "wrong address" measurably
  // faster than "wrong secret" and turn the endpoint into an oracle for which
  // address is the configured one.
  const emailOk = emailMatches(config.email, email)
  const secretOk = secretMatches(config.secret, secret)

  if (!emailOk || !secretOk) {
    failures += 1
    // One message for both failures, for the same reason.
    return NextResponse.json({ error: 'Invalid test-login credentials.' }, { status: 401 })
  }

  failures = 0

  const admin = createSupabaseAdmin()
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: config.email,
  })

  if (linkError || !link.properties?.hashed_token) {
    // The service role key is the usual suspect: absent, or belonging to a
    // different project than NEXT_PUBLIC_SUPABASE_URL.
    console.error('test-login: generateLink failed', {
      status: linkError?.status,
      code: linkError?.code,
      message: linkError?.message,
    })
    return NextResponse.json({ error: 'Could not mint a test session.' }, { status: 500 })
  }

  const { supabase, applyCookies } = createSupabaseRouteClient(request)

  // `verification_type`, not the `type` we asked for, and the difference is not
  // cosmetic. Asking for a `magiclink` gets you a `magiclink` token only if the
  // user already exists; for an address Supabase has never seen, the same call
  // creates the user and issues a **signup** token instead. GoTrue looks tokens
  // up by (hash, type), so verifying a signup token as a magiclink matches
  // nothing and comes back — misleadingly — as:
  //
  //   403 otp_expired "Email link is invalid or has expired"
  //
  // on a token generated microseconds earlier. Reading the type back off the
  // response is what makes the very first sign-in to a fresh test address work.
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: link.properties.verification_type,
  })

  if (verifyError) {
    console.error('test-login: verifyOtp failed', {
      status: verifyError.status,
      code: verifyError.code,
      message: verifyError.message,
    })
    return NextResponse.json({ error: 'Could not mint a test session.' }, { status: 500 })
  }

  // The session cookie rides on this response, so the caller is signed in by
  // the time it reads the body — the same ordering /auth/callback relies on.
  return applyCookies(
    NextResponse.json({ redirectTo: safeNext(typeof next === 'string' ? next : null) ?? SIGNED_IN_HOME }),
  )
}
