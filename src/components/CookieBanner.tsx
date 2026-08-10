'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useCookieConsent } from './CookieConsentProvider'
import { Button } from './ui'

/**
 * Cookie notice.
 *
 * This used to offer an Analytics category — a checkbox, an "Accept all" and an
 * "Essential only". It was asking permission for something that does not exist:
 * no analytics script is loaded anywhere in the app, and no analytics cookie is
 * ever set. Consenting and declining produced exactly the same behaviour, which
 * makes the choice theatre, and a consent UI that does nothing is worse than no
 * consent UI — it teaches people their choice is meaningless.
 *
 * So while only strictly-necessary cookies exist, this is a notice rather than a
 * chooser, and dismissing it records the same decision "Essential only" always
 * did. Strictly-necessary cookies do not require consent, so nothing is lost.
 *
 * CookieConsentProvider is deliberately left intact, analytics gate and all.
 * It documents itself as the hook the first non-essential script should use, and
 * that is still the right design — when analytics genuinely ships, the category
 * UI comes back here and the provider is already waiting for it.
 *
 * The rule that used to be flagged here still applies to whatever replaces this:
 * reject must be as easy to reach as accept. That is a legal requirement, not a
 * style preference. It is trivially satisfied while there is nothing to reject.
 */
export default function CookieBanner() {
  const { hydrated, bannerOpen, consent, essentialOnly, closeBanner } = useCookieConsent()

  const ref = useRef<HTMLDivElement>(null)

  // Announce the dialog and put the keyboard inside it when it appears.
  useEffect(() => {
    if (bannerOpen) ref.current?.focus()
  }, [bannerOpen])

  useEffect(() => {
    if (!bannerOpen) return
    function onKeyDown(event: KeyboardEvent) {
      // Escape dismisses only when a decision already exists — otherwise it
      // would look like a way to close the banner without choosing.
      if (event.key === 'Escape' && consent) closeBanner()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [bannerOpen, consent, closeBanner])

  // Nothing renders server-side: the decision lives in localStorage, so the
  // server cannot know whether the banner belongs on the page.
  if (!hydrated || !bannerOpen) return null

  return (
    <div
      ref={ref}
      role="dialog"
      // Non-modal on purpose. A focus trap over the whole page would make the
      // site unusable for anyone who cannot see the banner to dismiss it, and
      // trapping is not required for a bar that sits outside the main content.
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-body"
      tabIndex={-1}
      className="sticky bottom-0 z-50 flex flex-wrap items-center justify-between gap-[14px] border-t border-border-strong bg-surface px-6 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
    >
      <h2 id="cookie-banner-title" className="sr-only">
        Cookie choices
      </h2>

      <p id="cookie-banner-body" className="max-w-[520px] text-[13px] leading-[1.5] text-text-muted">
        We use cookies that keep you signed in, and nothing else. No analytics, no tracking, no
        advertising cookies.{' '}
        {/* Was /legal/cookies, which has never existed — a second 404 in the
            legal links, alongside the retention one. Points at the privacy
            policy, which now states the cookie position directly. */}
        <Link href="/legal/privacy" className="underline">
          Privacy policy
        </Link>
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Records the same decision the old "Essential only" button did, so
            the stored consent shape is unchanged and the provider needs no
            migration. */}
        <Button variant="primary" size="sm" onClick={essentialOnly}>
          Got it
        </Button>
      </div>
    </div>
  )
}
