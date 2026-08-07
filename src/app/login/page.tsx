'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button, Card, Input, Label } from '@/components/ui'

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
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

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
    if (status === 'loading' || cooldown > 0) return

    setStatus('loading')
    setError(null)

    // Unchanged from the previous implementation. Do not "improve" this: the
    // redirect target is being fixed on another branch.
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
    <main className="flex flex-1 flex-col items-center bg-surface-recessed px-8 pt-[72px] pb-[84px]">
      <h1 className="text-[30px] font-bold tracking-[-0.02em] text-text">snapExpense</h1>
      <p className="mt-2 text-[15px] text-text-tertiary">Sign in to manage your receipts</p>

      {status === 'sent' ? (
        <SentPanel
          email={email}
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

            {status === 'error' && error && (
              // The lead sentence is what carries the meaning; the colour only
              // reinforces it. Supabase's own message follows verbatim — it is
              // usually the actionable half ("Unable to validate email address").
              <p id={EMAIL_ERROR_ID} role="alert" className="text-[13px] leading-[1.5] text-danger">
                <span className="font-semibold">We could not send the link.</span> {error}
              </p>
            )}

            <Button type="submit" fullWidth className="mt-2" disabled={status === 'loading' || cooldown > 0}>
              {status === 'loading'
                ? 'Sending…'
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : 'Send magic link'}
            </Button>

            <ConsentLine />
          </form>
        </Card>
      )}
    </main>
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
  headingRef,
  onUseDifferentEmail,
}: {
  email: string
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
        <p className="text-[13px] leading-[1.5] text-text-tertiary">
          We sent a magic link to <strong className="font-semibold text-text">{email}</strong>. Click
          it to sign in. If you don&apos;t see it, check your spam or junk folder.
        </p>
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
