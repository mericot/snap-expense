'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCookieConsent } from './CookieConsentProvider'
import { Button } from './ui'

/**
 * Cookie consent banner.
 *
 * The three buttons are deliberately the same size, the same order and the same
 * level. "Essential only" is a real button, not a text link, and "Accept all"
 * is not enlarged. Reject has to be as easy to reach as accept — that is a
 * legal requirement, not a style preference, and it is the single thing in this
 * file most likely to get changed by accident.
 */
export default function CookieBanner() {
  const {
    hydrated,
    bannerOpen,
    panelOpen,
    setPanelOpen,
    consent,
    acceptAll,
    essentialOnly,
    saveChoice,
    closeBanner,
  } = useCookieConsent()

  const ref = useRef<HTMLDivElement>(null)

  // The panel's checkbox defaults to whatever is already recorded (the banner
  // is reopenable from the footer) and is only overridden once the user touches
  // it. Deriving it this way avoids an effect that mirrors props into state.
  const [analyticsOverride, setAnalyticsOverride] = useState<boolean | null>(null)
  const analytics = analyticsOverride ?? consent?.analytics ?? false

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
        We use cookies that keep you signed in, and nothing else unless you say yes. Analytics
        helps us see which features get used.{' '}
        <Link href="/legal/cookies" className="underline">
          Cookie policy
        </Link>
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={essentialOnly}>
          Essential only
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={panelOpen}
          aria-controls="cookie-category-panel"
          onClick={() => {
            if (!panelOpen) setAnalyticsOverride(null)
            setPanelOpen(!panelOpen)
          }}
        >
          Choose
        </Button>
        <Button variant="primary" size="sm" onClick={acceptAll}>
          Accept all
        </Button>
      </div>

      {panelOpen && (
        /* SCAFFOLD — the per-category panel has not been designed yet. This is
           the minimum that makes "Choose" honest: a real, keyboard-reachable
           control per category. It needs a design pass before release. */
        <div
          id="cookie-category-panel"
          className="w-full border-t border-border pt-4 text-[13px] text-text-muted"
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Cookie categories</legend>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked
                disabled
                readOnly
                className="mt-[3px]"
                aria-describedby="cookie-cat-essential"
              />
              <span>
                <span className="block font-semibold text-text-title">Essential</span>
                <span id="cookie-cat-essential" className="block text-text-tertiary">
                  Keeps you signed in. Always on, and cannot be turned off.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalyticsOverride(e.target.checked)}
                className="mt-[3px]"
                aria-describedby="cookie-cat-analytics"
              />
              <span>
                <span className="block font-semibold text-text-title">Analytics</span>
                <span id="cookie-cat-analytics" className="block text-text-tertiary">
                  Shows us which features get used. Off until you turn it on.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => saveChoice(analytics)}>
              Save choices
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
