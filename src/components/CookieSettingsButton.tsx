'use client'

import { useCookieConsent } from './CookieConsentProvider'

/**
 * The footer's "Cookies" entry. It is not a page — it reopens the consent
 * banner, which is what makes the choice revisitable. Kept as a separate client
 * component so the footer around it stays a server component.
 */
export default function CookieSettingsButton({ className }: { className?: string }) {
  const { openBanner } = useCookieConsent()
  return (
    <button type="button" onClick={openBanner} className={className}>
      Cookies
    </button>
  )
}
