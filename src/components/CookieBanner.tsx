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

  // Publish the bar's height so the page can pad itself out from under it.
  //
  // The bar is `fixed` (see the class list below), so it takes no space in
  // normal flow — but it does cover the bottom of the viewport, footer
  // included. Padding <body> by exactly the bar's height puts the footer back
  // within reach without reserving a slot that would sit empty.
  //
  // Measured rather than hardcoded: the height depends on how the paragraph
  // wraps, which moves with viewport width and with the reader's text-size
  // setting. A fixed value is correct on one phone and wrong on the next.
  useEffect(() => {
    const node = ref.current
    if (!node) return

    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--cookie-banner-height', `${node.getBoundingClientRect().height}px`)
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
      root.style.removeProperty('--cookie-banner-height')
    }
  }, [bannerOpen])

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
      // `fixed`, not `sticky`. As a sticky flex child of <body> this bar kept
      // its slot in normal flow, so the document ran a bar-height past the
      // footer. Reported from a phone as scrolling off the end of the page into
      // white, and confirmed by dismissing the bar, which removed the band.
      //
      // Desktop never showed it: sticky un-sticks exactly at max scroll and the
      // bar lands in its own slot, covering it. The most likely reason mobile
      // differs is that iOS resolves sticky offsets against the layout viewport
      // (URL bar collapsed) while you are seeing the shorter visual one — that
      // part is inference, not something reproduced here; headless Chrome has no
      // dynamic toolbar to test it with. What is measured is that `fixed` sits
      // flush at the viewport bottom with no gap above it at every scroll
      // position, on both a 390px phone and a 1440px desktop.
      className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-between gap-[14px] border-t border-border-strong bg-surface px-6 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
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
