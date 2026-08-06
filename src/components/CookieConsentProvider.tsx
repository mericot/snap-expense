'use client'

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react'

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
 * on `consent?.analytics === true`. The app loads no such script today, so
 * there is nothing to gate yet; the gate exists so the first one added has an
 * obvious place to hook into.
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

/* ---------------------------------------------------------------------------
   localStorage as an external store.

   Read through useSyncExternalStore rather than an effect: it hydrates without
   a mismatch, and subscribing to `storage` means a choice made in one tab
   applies in the others — which is the behaviour you want from a consent
   record. The snapshot is cached against the raw string so it stays
   referentially stable between renders.
--------------------------------------------------------------------------- */

const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cachedDecision: StoredDecision | null = null

function parseDecision(raw: string | null): StoredDecision | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDecision>
    if (parsed.version !== 1 || typeof parsed.decidedAt !== 'number') return null
    // Decisions expire after a year; an expired record reads as undecided, so
    // the banner comes back. The stale entry is overwritten by the next
    // decision rather than deleted here — reads must stay side-effect free.
    if (Date.now() - parsed.decidedAt > ONE_YEAR_MS) return null
    return { version: 1, decidedAt: parsed.decidedAt, analytics: parsed.analytics === true }
  } catch {
    // Corrupt JSON reads as undecided: for consent, "ask again" is the correct
    // way to fail.
    return null
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getSnapshot(): StoredDecision | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private mode or storage disabled: behave as undecided.
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedDecision = parseDecision(raw)
  }
  return cachedDecision
}

function getServerSnapshot(): StoredDecision | null {
  return null
}

const subscribeToNothing = () => () => {}
const alwaysTrue = () => true
const alwaysFalse = () => false

type CookieConsentValue = {
  /** null until a decision exists (and null on the server). */
  consent: ConsentCategories | null
  /** False during SSR and the hydration render; nothing consent-shaped renders before it flips. */
  hydrated: boolean
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
  const decision = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const hydrated = useSyncExternalStore(subscribeToNothing, alwaysTrue, alwaysFalse)

  // Only the decision is persisted. Whether the banner is on screen is derived:
  // open when nothing is stored, or when the footer link reopened it.
  const [reopened, setReopened] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const record = useCallback((analytics: boolean) => {
    const next: StoredDecision = { version: 1, decidedAt: Date.now(), analytics }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage unavailable — the decision holds for this page view and we ask
      // again next time.
    }
    for (const listener of listeners) listener()
    setReopened(false)
    setPanelOpen(false)
  }, [])

  const consent = useMemo<ConsentCategories | null>(
    () => (decision ? { essential: true, analytics: decision.analytics } : null),
    [decision],
  )

  const value = useMemo<CookieConsentValue>(
    () => ({
      consent,
      hydrated,
      bannerOpen: hydrated && (decision === null || reopened),
      panelOpen,
      openBanner: () => setReopened(true),
      closeBanner: () => {
        setReopened(false)
        setPanelOpen(false)
      },
      setPanelOpen,
      acceptAll: () => record(true),
      essentialOnly: () => record(false),
      saveChoice: record,
    }),
    [consent, hydrated, decision, reopened, panelOpen, record],
  )

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
}
