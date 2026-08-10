'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button, Card, Input, Label, cx } from '@/components/ui'
import PurchaseSteps from '@/components/PurchaseSteps'
import { checkoutIntent, type CheckoutIntent } from '@/lib/checkout-intent'
import {
  TRIAL_DAYS,
  chargePerCycleCents,
  chargePeriodLabel,
  billingIntervalMonths,
  formatMoney,
  formatMoneyHeadline,
  headlineAmountCents,
} from '@/lib/plans'

export const dynamic = 'force-dynamic'

/**
 * Sign in — passwordless magic link.
 *
 * This is a restyle, not a rewrite of the auth. The `signInWithOtp` call and
 * its `emailRedirectTo` are carried across from the previous implementation
 * unchanged, deliberately: `fix/auth-callback` owns that behaviour.
 *
 * Signed-in visitors never reach this page — src/proxy.ts sends them to
 * /receipts before anything renders.
 */

/**
 * Supabase's default rate limit for OTP emails is one per 60 seconds per
 * address. Mirroring it here means a second press is refused by the UI with a
 * countdown rather than by the API with an opaque 429. The server-side limit
 * remains the real one; this is only courtesy.
 */
const RESEND_COOLDOWN_SECONDS = 60

const EMAIL_FIELD_ID = 'email'
const EMAIL_ERROR_ID = 'email-error'
const SECRET_FIELD_ID = 'test-login-secret'

/**
 * The one address that can sign in without an emailed link, or `null` in any
 * environment that has not configured one — which must include production.
 *
 * Public on purpose, and safe to be: it is half of a credential, and the half
 * that opens nothing on its own. The secret lives only in `TEST_LOGIN_SECRET`
 * on the server and is typed in by the tester. The gate that actually decides
 * whether the bypass exists is src/lib/test-login.ts; this constant only
 * decides whether the page offers the field, so a stale value here can at worst
 * show a form that the server 401s.
 *
 * Read at module scope because Next inlines NEXT_PUBLIC_* at build time — there
 * is nothing to re-read per render.
 */
const TEST_LOGIN_EMAIL = process.env.NEXT_PUBLIC_TEST_LOGIN_EMAIL?.trim().toLowerCase() || null

type Status = 'idle' | 'loading' | 'sent' | 'error'

/**
 * Supabase's own message is the useful half of most failures ("Unable to
 * validate email address: invalid format" tells the user exactly what to fix),
 * so it is still what gets shown.
 *
 * The exception found while testing: on a 500 the API returned
 * `{"code":"unexpected_failure","message":"Error sending confirmation email"}`
 * but supabase-js handed back an `AuthError` whose `.message` was the literal
 * two-character string `"{}"`, which the page then printed at the user. Any
 * message that is JSON rather than prose is treated as missing. The previous
 * implementation had the same hole — its `error.message || …` chain took `"{}"`
 * as a usable message too.
 */
function userFacingMessage(error: { message?: string; code?: string; status?: number }) {
  const message = error.message?.trim()
  if (message && !message.startsWith('{')) return message
  return `The server rejected the request (${error.code ?? error.status ?? 'no code'}). Please try again in a moment.`
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const [email, setEmail] = useState('')
  const [secret, setSecret] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Typing the configured address swaps the form from "send me a link" to
  // "sign in", in place. No hidden query param or key combination to remember:
  // the address *is* the way in, which is the whole point of it being one
  // specific address rather than a mode.
  const isTestLogin = TEST_LOGIN_EMAIL !== null && email.trim().toLowerCase() === TEST_LOGIN_EMAIL

  // Non-null when `/checkout` sent this visitor here to sign in first. It is
  // what turns the page from "Sign in to manage your receipts" — a true
  // sentence about the wrong subject — into step one of a purchase.
  const intent = checkoutIntent(next)

  const sentHeadingRef = useRef<HTMLHeadingElement>(null)

  // A plain countdown rather than a wall-clock deadline: drift of a few hundred
  // milliseconds is irrelevant when the authoritative limit lives on the server,
  // and this has no hydration mismatch to reason about.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  // Swapping the form out for the confirmation panel moves nothing into the
  // keyboard's path on its own, so focus is placed on the new heading. It is
  // also the aria-live announcement for anyone not watching the screen.
  useEffect(() => {
    if (status === 'sent') sentHeadingRef.current?.focus()
  }, [status])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The cooldown exists to mirror Supabase's OTP send limit, and the test
    // login sends nothing, so it does not apply to it.
    if (status === 'loading' || (cooldown > 0 && !isTestLogin)) return

    setStatus('loading')
    setError(null)

    if (isTestLogin) {
      // Unlike supabase-js, which reports failures in its return value, `fetch`
      // rejects on a network error. Without this the form would sit on
      // "Signing in…" forever with the dev server stopped, which is exactly
      // when someone is most likely to be using this.
      let response: Response
      try {
        response = await fetch('/api/test-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The secret goes in the body, never the query string: URLs end up in
          // server logs, browser history and Referer headers.
          body: JSON.stringify({ email, secret, next }),
        })
      } catch (fetchError) {
        console.error('test-login request failed', fetchError)
        setError('Could not reach the server. Is it running?')
        setStatus('error')
        return
      }

      if (!response.ok) {
        // A 404 means the server has no bypass configured even though this
        // build was given an address for one — worth saying plainly, because
        // the alternative is a tester retyping a correct secret.
        const message =
          response.status === 404
            ? 'Test login is not enabled on this server.'
            : ((await response.json().catch(() => null))?.error ??
              `The server rejected the request (${response.status}).`)
        setError(message)
        setStatus('error')
        return
      }

      const { redirectTo } = await response.json().catch(() => ({}))
      // A full navigation, not router.replace: the session cookie arrived on
      // the response above, and a hard load is the simplest way to guarantee
      // src/proxy.ts reads it on the very next request rather than racing a
      // client-side transition.
      window.location.assign(redirectTo ?? '/receipts')
      return
    }

    // Unchanged from the previous implementation. Do not "improve" this: the
    // redirect target is being fixed on another branch.
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (next) callbackUrl.searchParams.set('next', next)

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    })

    if (signInError) {
      // `AuthError` is a real Error with typed `name`, `status` and `code`, so
      // the `any` cast this replaced was never needed. The log stays — it is
      // how the next person debugs a failing send — but it is now four named
      // fields rather than a getOwnPropertyNames dump of the whole object.
      console.error('signInWithOtp failed', {
        name: signInError.name,
        status: signInError.status,
        code: signInError.code,
        message: signInError.message,
      })
      setError(userFacingMessage(signInError))
      setStatus('error')
      return
    }

    setStatus('sent')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  function handleUseDifferentEmail() {
    setStatus('idle')
    setError(null)
    // The address is kept rather than cleared: the common reason to come back
    // here is a typo, which is quicker to correct than to retype.
    //
    // getElementById rather than a ref because `Input` is task 00's primitive
    // and does not forward one; adding that is its branch's call, not this
    // one's. The id is the same one the <Label> is bound to.
    requestAnimationFrame(() => document.getElementById(EMAIL_FIELD_ID)?.focus())
  }

  return (
    <>
      <header className="border-b border-border bg-surface px-8 py-4">
        <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[17px] font-bold tracking-[-0.01em] text-text no-underline hover:text-text sm:min-h-0"
          >
            snapExpense
          </Link>

          <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]">
            <Link href="/" className="inline-flex min-h-11 items-center text-text-muted hover:text-text sm:min-h-0">
              Home
            </Link>
            <Link href="/pricing" className="inline-flex min-h-11 items-center text-text-muted hover:text-text sm:min-h-0">
              Pricing
            </Link>
            <Link href="/legal/privacy" className="inline-flex min-h-11 items-center text-text-muted hover:text-text sm:min-h-0">
              Privacy
            </Link>
            <Button href="/login" size="sm">
              Try it free
            </Button>
          </nav>
        </div>
      </header>

      <main
        className={cx(
          'flex flex-1 flex-col items-center bg-surface-recessed px-8 pb-[84px]',
          // The stepper takes the top of the page when there is one, so the
          // heading starts lower without the whole panel drifting down.
          intent ? 'pt-[52px]' : 'pt-[72px]',
        )}
      >
        {intent && <PurchaseSteps current={1} className="mb-7" />}

        {/* Deliberately not "Create your account", which the preview used and
            which is wrong for the visitor this most often catches: an existing
            free user, signed out, upgrading. They have an account already, and
            being told to make one is its own kind of "this is broken". The
            magic link covers both cases identically, so the heading names the
            purchase — true either way — and leaves the account out of it. */}
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-text text-balance text-center">
          {intent ? `Set up your ${intent.plan.name} subscription` : 'snapExpense'}
        </h1>
        <p className="mt-2 text-[15px] text-text-tertiary text-balance text-center">
          {intent
            ? 'Confirm your email to continue — nothing is charged yet.'
            : 'Sign in to manage your receipts'}
        </p>

        {intent && <PlanSummary intent={intent} />}

      {status === 'sent' ? (
        <SentPanel
          email={email}
          intent={intent}
          headingRef={sentHeadingRef}
          onUseDifferentEmail={handleUseDifferentEmail}
        />
      ) : (
        <Card className="mt-[28px] w-full max-w-[400px]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2" aria-label="Sign in">
            <Label htmlFor={EMAIL_FIELD_ID}>Email</Label>
            <Input
              id={EMAIL_FIELD_ID}
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-invalid={status === 'error' || undefined}
              aria-describedby={status === 'error' ? EMAIL_ERROR_ID : undefined}
            />

            {isTestLogin && (
              <>
                <Label htmlFor={SECRET_FIELD_ID} className="mt-2">
                  Test secret
                </Label>
                <Input
                  id={SECRET_FIELD_ID}
                  type="password"
                  name="test-login-secret"
                  // Not `current-password`: this is not the account's password
                  // and offering to save it in a password manager alongside
                  // real credentials invites confusion.
                  autoComplete="off"
                  required
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="TEST_LOGIN_SECRET"
                />
              </>
            )}

            {status === 'error' && error && (
              // The lead sentence is what carries the meaning; the colour only
              // reinforces it. Supabase's own message follows verbatim — it is
              // usually the actionable half ("Unable to validate email address").
              <p id={EMAIL_ERROR_ID} role="alert" className="text-[13px] leading-[1.5] text-danger">
                <span className="font-semibold">We could not send the link.</span> {error}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              className="mt-2"
              disabled={status === 'loading' || (cooldown > 0 && !isTestLogin)}
            >
              {isTestLogin
                ? status === 'loading'
                  ? 'Signing in…'
                  : 'Sign in to test account'
                : status === 'loading'
                  ? 'Sending…'
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : intent
                      ? 'Email me a link to continue'
                      : 'Send magic link'}
            </Button>

            <ConsentLine />
          </form>
        </Card>
      )}
    </main>
    </>
  )
}

/**
 * What the visitor is part-way through buying, restated on the page that
 * interrupted them.
 *
 * Every number here is derived through `src/lib/plans.ts`, never retyped —
 * that file opens by insisting on it, because a price typed into copy is a
 * price that will eventually disagree with the one Stripe charges. The
 * headline formatter drops `.00`; the charged amount keeps it, which is the
 * distinction plans.ts draws between a marketing figure and a transactional
 * one.
 */
function PlanSummary({ intent }: { intent: CheckoutIntent }) {
  const { plan } = intent
  const months = billingIntervalMonths(plan)

  return (
    <div className="mt-5 w-full max-w-[400px] rounded-card border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold text-text">{plan.name}</span>
        <span className="text-[14px] text-text tabular-nums">
          {formatMoneyHeadline(headlineAmountCents(plan))}{' '}
          <span className="text-[12.5px] text-text-tertiary">{plan.priceCaption}</span>
        </span>
      </div>

      <div className="my-3 h-px bg-border" />

      <p className="text-[12.5px] leading-[1.5] text-text-tertiary">
        <strong className="font-semibold text-text-title tabular-nums">
          {TRIAL_DAYS} days free
        </strong>
        , then {formatMoney(chargePerCycleCents(plan))}
        {months === null ? '' : ` ${chargePeriodLabel(months)}`}. Cancel any time before then and
        you are not charged.
      </p>
    </div>
  )
}

/**
 * Verbatim, reviewed with the client. It lives inside the card, directly under
 * the button, so it is on screen at the moment of submission. Do not move it
 * into the footer, collapse it behind a link, or reword it.
 */
function ConsentLine() {
  return (
    // text-balance evens the two lines out; without it the wrap leaves
    // "and Privacy Policy." stranded on a short second line.
    <p className="mt-[10px] text-center text-[12px] leading-[1.5] text-balance text-text-tertiary">
      We email you a one-time link. No password stored. See{' '}
      <Link href="/legal/terms" className="underline">
        Terms
      </Link>{' '}
      and{' '}
      <Link href="/legal/privacy" className="underline">
        Privacy Policy
      </Link>
      .
    </p>
  )
}

/**
 * The "check your inbox" state was never designed — the handoff says so
 * explicitly. This is the previous implementation's copy, which is sound
 * (including the spam-folder hint added in c2ca362), moved onto the new tokens.
 * It needs a real design pass.
 */
function SentPanel({
  email,
  intent,
  headingRef,
  onUseDifferentEmail,
}: {
  email: string
  intent: CheckoutIntent | null
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onUseDifferentEmail: () => void
}) {
  return (
    <Card className="mt-[28px] w-full max-w-[400px]">
      {/* No aria-live here on purpose. The whole panel is inserted at once,
          which live regions announce unreliably, and the parent moves focus to
          the heading below — that is the dependable signal. Doing both would
          make a screen reader say it twice. */}
      <div className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-[15px] font-semibold text-text">
          Check your email
        </h2>
        {/* This is the point in the purchase where the buyer leaves the browser
            entirely, so it is where the thread is most easily lost. Two extra
            sentences, only when money is involved: where the link puts them,
            and that nothing has happened to their card. The full redesign this
            panel still needs is a separate piece of work. */}
        <p className="text-[13px] leading-[1.5] text-text-tertiary">
          We sent a magic link to <strong className="font-semibold text-text">{email}</strong>.{' '}
          {intent
            ? `Click it and you will come straight back here to set up ${intent.plan.name}.`
            : 'Click it to sign in.'}{' '}
          If you don&apos;t see it, check your spam or junk folder.
        </p>
        {intent && (
          <p className="text-[13px] leading-[1.5] text-text-faint">
            Nothing has been charged yet.
          </p>
        )}
        <button
          type="button"
          onClick={onUseDifferentEmail}
          className="mt-2 min-h-11 cursor-pointer self-start text-[12px] text-text-tertiary underline hover:text-text sm:min-h-0"
        >
          Use a different email
        </button>
      </div>
    </Card>
  )
}
