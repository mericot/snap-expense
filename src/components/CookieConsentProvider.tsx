'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Cookie consent state, lifted out of the banner so the footer's "Cookies" link
 * can reopen it.
 *
 * The banner is **opt-in**: nothing beyond strictly-necessary cookies may run
 * until a decision is recorded. That is stricter than US state privacy law,
 * which is opt-*out*, and it is deliberate — see the handoff README, "On
 * keeping an opt-in banner in a US product". Do not relax it to opt-out without
 * an explicit product and legal decision.
 *
 * Anything non-essential (analytics, session replay, ad pixels) must be gated
 * on `consent.analytics === true`. Today the app loads no such script, so there
 * is nothing to gate yet; the gate exists so the first one added has an obvious
 * place to hook into.
 */

export type ConsentCategories = {
  /** Sign-in and CSRF cookies. Always on; cannot be declined. */
  essential: true
  analytics: boolean
}

type StoredDecision = {
  version: 1
  decidedAt: number
  analytics: boolean
}

const STORAGE_KEY = 'snapexpense.cookie-consent'
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

function readDecision(): StoredDecision | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDecision>
    if (parsed.version !== 1 || typeof parsed.decidedAt !== 'number') return null
    // The decision is persisted for one year, then we ask again.
    if (Date.now() - parsed.decidedAt > ONE_YEAR_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { version: 1, decidedAt: parsed.decidedAt, analytics: parsed.analytics === true }
  } catch {
    // Private mode, disabled storage, or corrupt JSON: behave as undecided.
    return null
  }
}

function writeDecision(analytics: boolean): StoredDecision | null {
  const decision: StoredDecision = { version: 1, decidedAt: Date.now(), analytics }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decision))
  } catch {
    // Storage unavailable — the decision still applies for this page view, we
    // just have to ask again next time. Failing closed is the right side to
    // fail on for consent.
  }
  return decision
}

type CookieConsentValue = {
  /** null until the stored decision has been read on the client. */
  consent: ConsentCategories | null
  /** True once the client has read localStorage; nothing renders before this. */
  hydrated: boolean
  /** Whether the banner is on screen. */
  bannerOpen: boolean
  /** Whether the per-category panel inside the banner is expanded. */
  panelOpen: boolean
  openBanner: () => void
  closeBanner: () => void
  setPanelOpen: (open: boolean) => void
  acceptAll: () => void
  essentialOnly: () => void
  saveChoice: (analytics: boolean) => void
}

const CookieConsentContext = createContext<CookieConsentValue | null>(null)

export function useCookieConsent(): CookieConsentValue {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) throw new Error('useCookieConsent must be used inside <CookieConsentProvider>')
  return ctx
}

export default function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentCategories | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [bannerOpen, setBannerOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const stored = readDecision()
    if (stored) {
      setConsent({ essential: true, analytics: stored.analytics })
    } else {
      // Show the banner only when no decision is stored. The banner's own
      // visibility is never persisted — only the decision is.
      setBannerOpen(true)
    }
    setHydrated(true)
  }, [])

  const record = useCallback((analytics: boolean) => {
    writeDecision(analytics)
    setConsent({ essential: true, analytics })
    setBannerOpen(false)
    setPanelOpen(false)
  }, [])

  const value = useMemo<CookieConsentValue>(
    () => ({
      consent,
      hydrated,
      bannerOpen,
      panelOpen,
      openBanner: () => setBannerOpen(true),
      closeBanner: () => {
        setBannerOpen(false)
        setPanelOpen(false)
      },
      setPanelOpen,
      acceptAll: () => record(true),
      essentialOnly: () => record(false),
      saveChoice: (analytics: boolean) => record(analytics),
    }),
    [consent, hydrated, bannerOpen, panelOpen, record],
  )

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
}
