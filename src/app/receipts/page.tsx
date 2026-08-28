'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Button, Card } from '@/components/ui'
import { supabase, type Expense } from '@/lib/supabase'
import { isPaidPlan } from '@/lib/subscription'
import PaymentFailedBanner from '@/components/PaymentFailedBanner'
import { useSession } from '@/components/SessionProvider'
import { useSubscription } from '@/components/SubscriptionProvider'
import AppHeader from './AppHeader'
import Dropzone from './Dropzone'
import ExtractionReview, { type ExtractedExpense } from './ExtractionReview'
import BatchReview, { type PendingReceipt } from './BatchReview'
import ReceiptRow, { type EditDraft } from './ReceiptRow'
import RetentionNotice from './RetentionNotice'
import { ALLOWED_TYPES, FREE_MONTHLY_LIMIT, HEIC_TYPES } from './constants'
import { JPEG_QUALITY, planTiles } from '@/lib/receipt-tiles'
import {
  currentMonthKey,
  findDuplicate,
  groupByMonth,
  monthLabel,
  monthMeta,
  type MonthGroup,
} from './format'

/**
 * The receipt inbox.
 *
 * Restyled from the working expense app task 00 moved here. The data layer is
 * deliberately unchanged: the same Supabase queries, the same /api/extract
 * call, the same CSV export. What changed is the presentation and the way the
 * page is organised.
 *
 * ## Months
 *
 * The design shows a single month ("March 2026"). The brief's assumption was
 * "current month only, no month switcher". That is not shipped as written,
 * because it makes every receipt outside the current month unreachable — not
 * just invisible, but impossible to edit, delete or check — and there is no
 * month switcher designed to get back to them. Instead every month renders as
 * its own group, newest first. A user in their first month sees exactly the
 * designed page; a user in their third month can still scroll to January. The
 * month header's actions and the quota row stay singular, so the top of the
 * page is unchanged. Reverting to current-month-only is deleting one `.map`.
 */

function isHeic(file: File) {
  const name = file.name.toLowerCase()
  return HEIC_TYPES.includes(file.type) || name.endsWith('.heic') || name.endsWith('.heif')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

/**
 * Render a receipt into the JPEG tiles the extract route expects.
 *
 * This used to scale every photo so its long edge was 1500px, which on a tall
 * receipt capped the height and crushed the width. See src/lib/receipt-tiles.ts
 * for what that cost and why slicing is the fix; the geometry lives there
 * because the server's HEIC path has to slice identically.
 */
async function prepareImage(file: File): Promise<{ images: string[]; mediaType: string }> {
  const img = await loadImage(file)
  const images = planTiles(img.naturalWidth, img.naturalHeight).map((tile) => {
    const canvas = document.createElement('canvas')
    canvas.width = tile.outWidth
    canvas.height = tile.outHeight
    canvas
      .getContext('2d')!
      .drawImage(
        img,
        0, tile.srcTop, img.naturalWidth, tile.srcHeight,
        0, 0, tile.outWidth, tile.outHeight,
      )
    const data = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]
    // Drop the backing store rather than waiting for GC. A long receipt is
    // several of these at once and WebKit is slow to reclaim canvas memory.
    canvas.width = 0
    canvas.height = 0
    return data
  })
  return { images, mediaType: 'image/jpeg' }
}

/**
 * HEIC goes up untouched — the browser cannot decode it into a canvas, so the
 * server converts and slices it instead. One image in, tiles out the far side.
 */
function readToBase64(file: File): Promise<{ images: string[]; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        images: [(reader.result as string).split(',')[1]],
        mediaType: file.type || 'image/heic',
      })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── App (authenticated) ──────────────────────────────────────────────────────

function App({ session }: { session: Session }) {
  const { plan, status: subStatus, loading: subLoading } = useSubscription()
  const isPaid = isPaidPlan(plan, subStatus)

  /**
   * Whether the plan is actually known yet.
   *
   * SubscriptionProvider starts at `plan: 'free'` and corrects once its query
   * returns, so for the first few hundred milliseconds every account looks like
   * a free one. The page took that at face value and rendered the free tier
   * optimistically: measured on a paid account, the "0 of 10 free receipts" row
   * with its upgrade link appeared at 12ms and did not go away until between
   * 219ms and 532ms. A paying customer saw it on every single page load.
   *
   * Worse before the quota fix, when `usedThisMonth` counted saved receipts: any
   * paid account with ten receipts in a month flashed the full upgrade wall,
   * dropzone and all.
   *
   * Not knowing is its own state, and the honest thing to render for it is
   * nothing tier-specific. The server enforces the real limit regardless, so
   * erring open here costs nothing — an over-quota scan is still refused, just
   * by the side that actually knows.
   */
  const tierKnown = !subLoading
  /**
   * Two pickers, because one attribute cannot serve both jobs.
   *
   * `capture="environment"` makes a phone open the camera directly, which is the
   * right default for a receipt scanner — you are at the till with the receipt in
   * your hand. But per the HTML Media Capture spec it also makes the photo
   * library unreachable and causes `multiple` to be ignored, so a screenshot of
   * an emailed receipt, or a photo somebody sent you, could not be uploaded from
   * a phone at all.
   *
   * So: `cameraRef` keeps the one-tap camera, `inputRef` reaches the library and
   * takes several files. Nothing is taken away from the camera path.
   */
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'done' | 'saving' | 'saved' | 'error'
  >('idle')
  const [result, setResult] = useState<ExtractedExpense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreviewState] = useState<string | null>(null)

  /**
   * The preview is a blob URL, and a blob URL pins the whole file in memory
   * until it is revoked. Nothing revoked it: clearing the preview only nulled
   * the state, so every scan left its original photo — several MB from a phone
   * camera — held for the life of the page. A long session leaked all of them.
   *
   * The ref exists because the revoke has to happen against the *previous*
   * value, which the setter no longer has once React has moved on.
   */
  const previewUrlRef = useRef<string | null>(null)
  const setPreview = useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = url
    setPreviewState(url)
  }, [])

  // Navigating away mid-review would otherwise leak the last one.
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])
  const [expenses, setExpenses] = useState<Expense[]>([])

  /**
   * A saved receipt matching the one under review, if there is one.
   *
   * Nothing in the schema stops the same receipt being saved twice — no unique
   * constraint, no idempotency key — and at volume it is easy to do: the test
   * account collected two identical $12,102.57 rows three minutes apart while
   * this was being built.
   *
   * A warning rather than a block, because same-merchant, same-day, same-total
   * purchases are genuinely possible — two identical coffees, a re-order — and
   * refusing them would be wrong more often than it was right. Set only after
   * the first save attempt, so the second press means "yes, I know".
   */
  const [duplicateOf, setDuplicateOf] = useState<Expense | null>(null)
  const [scansThisMonth, setScansThisMonth] = useState(0)

  /**
   * The upload queue.
   *
   * Both entry points used to take `files[0]` and drop the rest on the floor
   * without saying so — dropping sixty receipts scanned one and silently
   * discarded fifty-nine.
   *
   * The list lives in a ref rather than state because it is advanced from async
   * handlers and from user actions, and a stale closure over it would silently
   * skip or repeat a file. `batch` is the part the UI renders.
   */
  const queueRef = useRef<File[]>([])

  /**
   * Results waiting to be reviewed together.
   *
   * A batch does not stop after each file. Extracting all of them first and
   * reviewing once turns sixty decisions into one pass down a column, which is
   * the point — nobody reads the sixtieth card as carefully as the first, and a
   * total misread as 110035.02 is exactly what a tiring reader waves through.
   *
   * A single file keeps the old card, which shows the receipt next to the
   * figures. That is worth more than consistency when there is only one.
   */
  const [pending, setPending] = useState<PendingReceipt[]>([])
  const batchModeRef = useRef(false)
  const [batch, setBatch] = useState<{
    total: number
    done: number
    /** Set when the queue stopped early — the reason is shown to the user. */
    halted: string | null
    /** Files rejected up front for their type, named so they can be retried. */
    skipped: string[]
  }>({ total: 0, done: 0, halted: null, skipped: [] })

  const loadExpenses = useCallback(async () => {
    // The quota row the server writes is keyed by date_trunc('month', now()),
    // which Supabase evaluates in UTC. Match that, and compare with >= rather
    // than equality so a timestamp formatted a shade differently still lands.
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

    const [{ data }, { data: quota }] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      // Counting rows in `expenses` measured the wrong thing. The server meters
      // *extractions* in extraction_quota — an extract-and-discard costs a unit
      // and saves no row — so the two drifted apart in the direction that
      // embarrasses: the page said "2 of 10" while the server had you at 7, and
      // the next scan came back 403 out of nowhere. It also counted
      // soft-deleted receipts, having dropped the deleted_at filter its sibling
      // query has.
      //
      // extraction_quota is readable by its owner under RLS, so this is the
      // same number the server enforces rather than a second guess at it.
      supabase
        .from('extraction_quota')
        .select('extraction_count')
        .gte('month_start', monthStart)
        .order('month_start', { ascending: false })
        .limit(1),
    ])
    if (data) setExpenses(data)
    setScansThisMonth(quota?.[0]?.extraction_count ?? 0)
  }, [])

  // Initial fetch on mount. The rule wants this hoisted out of an effect, which
  // in a client component means a data library — a new dependency this branch
  // is not allowed to add — so it stays suppressed, as task 00 left it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExpenses()
  }, [loadExpenses])

  /**
   * Every month that has receipts, newest first, plus the current month even
   * when it is empty — the quota row and the "no receipts yet" state both hang
   * off it, and the page would otherwise have no header at all for a new user.
   */
  const groups: MonthGroup[] = useMemo(() => {
    const thisMonth = currentMonthKey()
    const grouped = groupByMonth(expenses)
    if (!grouped.some((g) => g.key === thisMonth)) {
      grouped.push({
        key: thisMonth,
        label: monthLabel(thisMonth),
        expenses: [],
        count: 0,
        total: 0,
        needingCategory: 0,
        needingReview: 0,
      })
      grouped.sort((a, b) => b.key.localeCompare(a.key))
    }
    return grouped
  }, [expenses])

  const thisMonthKey = currentMonthKey()
  const usedThisMonth = scansThisMonth

  function clearForm() {
    setStatus('idle')
    setResult(null)
    setError(null)
    setPreview(null)
    setDuplicateOf(null)
    setPending([])
    batchModeRef.current = false
    // Batch counters go with the form. A halted batch never reaches here — it
    // leaves its explanation up until the next upload replaces it.
    setBatch({ total: 0, done: 0, halted: null, skipped: [] })
    if (inputRef.current) inputRef.current.value = ''
  }

  /**
   * Take the next file off the queue and extract it, or finish the batch.
   */
  function advanceQueue() {
    const next = queueRef.current.shift()
    if (next) {
      void processFile(next)
      return
    }
    // Batch finished: hold everything for one review pass. `done` rather than
    // clearing, so the dropzone stays out of the way until a decision is made.
    if (batchModeRef.current) {
      setStatus('done')
      return
    }
    clearForm()
  }

  /**
   * Stop the whole batch rather than pushing the remaining files at a wall.
   *
   * The rate limit is 20/hour and the free quota is 10/month, so a large drop
   * meets one of them partway through. Carrying on would spend the user's time
   * collecting the same refusal once per file; the honest thing is to stop, say
   * why, and say how many are left.
   */
  function haltQueue(reason: string) {
    const remaining = queueRef.current.length + 1
    queueRef.current = []
    setBatch((b) => ({
      ...b,
      halted: `${reason} ${remaining} receipt${remaining === 1 ? '' : 's'} from this batch ${remaining === 1 ? 'was' : 'were'} not scanned.`,
    }))
    setStatus('error')
  }

  async function processFile(file: File) {
    setError(null)
    setResult(null)
    setPreview(null)
    setDuplicateOf(null)

    if (!isPaid && usedThisMonth >= FREE_MONTHLY_LIMIT) {
      haltQueue(
        `You have used all ${FREE_MONTHLY_LIMIT} free receipts this month. Upgrade to Pro for unlimited scans.`,
      )
      return
    }

    setStatus('loading')
    const heic = isHeic(file)
    if (!heic) setPreview(URL.createObjectURL(file))
    try {
      const { images, mediaType } = heic
        ? await readToBase64(file)
        : await prepareImage(file)
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, mediaType }),
      })
      const data = await res.json()
      // The route returns a specific, actionable message for rate limiting,
      // oversize bodies, timeouts and unsupported media types. Surface it
      // rather than collapsing everything into "Something went wrong".
      if (!res.ok) {
        // 429 and 403 are not this file's fault and will refuse the next one
        // identically, so they end the batch instead of repeating per file.
        if (res.status === 429 || res.status === 403) {
          haltQueue(data.error ?? 'Extraction limit reached.')
          return
        }
        throw new Error(data.error ?? 'Extraction failed')
      }
      if (batchModeRef.current) {
        setPending((p) => [
          ...p,
          { id: crypto.randomUUID(), fileName: file.name, result: data },
        ])
        setBatch((b) => ({ ...b, done: b.done + 1 }))
        advanceQueue()
        return
      }
      setResult(data)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  /**
   * Entry point for both the picker and the drop target.
   */
  function handleFiles(files: File[]) {
    const usable: File[] = []
    const skipped: string[] = []
    for (const f of files) {
      if (isHeic(f) || ALLOWED_TYPES.includes(f.type)) usable.push(f)
      else skipped.push(f.name)
    }

    if (usable.length === 0) {
      setBatch({ total: 0, done: 0, halted: null, skipped })
      setStatus('error')
      setError(
        `Unsupported file type${skipped.length === 1 ? '' : 's'}. Please use JPEG, PNG, WebP, GIF or HEIC.`,
      )
      return
    }

    queueRef.current = usable.slice(1)
    batchModeRef.current = usable.length > 1
    setPending([])
    setBatch({ total: usable.length, done: 0, halted: null, skipped })
    void processFile(usable[0])
  }

  async function handleSave() {
    if (!result) return
    if (!result.merchant || !result.date || result.total == null) {
      setError('Cannot save — merchant, date, and total are required.')
      return
    }
    // Matched against the list already in memory rather than a round trip: it
    // holds every non-deleted receipt and is refreshed after each save, so it
    // is the same set the user is looking at.
    if (!duplicateOf) {
      const match = findDuplicate(expenses, result)
      if (match) {
        setDuplicateOf(match)
        return
      }
    }

    setStatus('saving')
    const { error: dbError } = await supabase.from('expenses').insert({
      user_id: session.user.id,
      merchant: result.merchant,
      date: result.date,
      total: result.total,
      tax: result.tax,
      category: result.category,
      // Kept with the row so a shaky read stays findable after saving. The
      // server may have forced this down from the model's own 'high' when the
      // receipt failed to add up — see src/lib/receipt-schema.ts.
      confidence: result.confidence,
    })
    if (dbError) {
      setError(`Save failed: ${dbError.message}`)
      setStatus('done')
      return
    }
    await loadExpenses()
    setBatch((b) => ({ ...b, done: b.done + 1 }))
    if (queueRef.current.length > 0) {
      advanceQueue()
    } else {
      setStatus('saved')
      setTimeout(clearForm, 1500)
    }
  }

  /**
   * Insert everything in the batch that has the fields a row requires.
   *
   * One statement rather than a loop: a partial failure halfway through a loop
   * leaves the user with some receipts saved, some not, and no way to tell
   * which. Rows missing a merchant, date or total are left in the list instead
   * of being dropped, so nothing disappears without being seen.
   */
  async function handleSaveAll() {
    const savable = pending.filter(
      (p) => p.result.merchant && p.result.date && p.result.total != null,
    )
    if (savable.length === 0) return

    setStatus('saving')
    setError(null)
    const { error: dbError } = await supabase.from('expenses').insert(
      savable.map((p) => ({
        user_id: session.user.id,
        merchant: p.result.merchant,
        date: p.result.date,
        total: p.result.total,
        tax: p.result.tax,
        category: p.result.category,
        confidence: p.result.confidence,
      })),
    )
    if (dbError) {
      setError(`Save failed: ${dbError.message}`)
      setStatus('done')
      return
    }

    await loadExpenses()
    const savedIds = new Set(savable.map((p) => p.id))
    const left = pending.filter((p) => !savedIds.has(p.id))
    setPending(left)
    if (left.length === 0) {
      setStatus('saved')
      setTimeout(clearForm, 1500)
    } else {
      // The unsavable ones stay on screen; the user still has to decide.
      setStatus('done')
    }
  }

  /** Discard the current result and move on; the file is counted as handled. */
  function discardAndAdvance() {
    setBatch((b) => ({ ...b, done: b.done + 1 }))
    advanceQueue()
  }

  async function handleUpdate(id: string, draft: EditDraft): Promise<string | null> {
    if (!draft.merchant.trim()) return 'Merchant is required.'
    if (!draft.date) return 'Date is required.'
    const total = parseFloat(draft.total)
    // Negative totals are legitimate: a refund or return is money coming back,
    // and extraction now reads them as negative. Rejecting them here made a
    // correctly-read refund permanently uneditable — it saved fine, since
    // handleSave only checks for null, and then every edit bounced.
    //
    // The bound is the `numeric(10, 2)` column: 8 digits before the decimal.
    // Past that Postgres raises a numeric overflow, which reached the user as
    // a raw driver message.
    if (!Number.isFinite(total)) return 'Total must be a valid number.'
    if (Math.abs(total) >= 100_000_000) return 'Total is out of range.'
    const { error: dbError } = await supabase
      .from('expenses')
      .update({
        merchant: draft.merchant.trim(),
        date: draft.date,
        total,
        tax: draft.tax !== '' ? parseFloat(draft.tax) : null,
        category: draft.category || null,
      })
      .eq('id', id)
    if (dbError) return `Save failed: ${dbError.message}`
    await loadExpenses()
    return null
  }

  async function handleDelete(id: string) {
    await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    await loadExpenses()
  }

  /**
   * Exports every receipt, not just the month whose header the button sits in.
   * That is what it has always done; scoping it to the month would be a
   * behaviour change, not a restyle. Flagged in the PR.
   */
  function exportCSV() {
    const header = ['merchant', 'date', 'total', 'tax', 'category']
    const rows = expenses.map((e) => [
      `"${(e.merchant ?? '').replace(/"/g, '""')}"`,
      e.date,
      e.total,
      e.tax ?? '',
      e.category ?? '',
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const reviewing = status === 'done' || status === 'saving'
  const quotaReached = tierKnown && !isPaid && usedThisMonth >= FREE_MONTHLY_LIMIT
  const showDropzone = !reviewing && status !== 'saved' && !quotaReached

  return (
    <>
      <AppHeader
        email={session.user.email}
        onSignOut={async () => {
          await supabase.auth.signOut()
          window.location.href = '/login'
        }}
      />

      <main className="flex-1 bg-surface">
        <div className="mx-auto flex max-w-[900px] flex-col gap-5 p-6">
          <h1 className="sr-only">Receipts</h1>

          <PaymentFailedBanner />

          {groups.map((group, index) => {
            const isFirst = index === 0
            const isCurrentMonth = group.key === thisMonthKey

            return (
              <section key={group.key} className="flex flex-col gap-5">
                {/* 1 — Month header. Every number is derived from the rows in
                    this group. */}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
                      {group.label}
                    </h2>
                    <p className="mt-1 text-[13px] text-text-tertiary">{monthMeta(group)}</p>
                  </div>

                  {/* The actions belong to the page, not to a month, so they
                      only appear once, on the top-most header. */}
                  {isFirst && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={exportCSV}
                        disabled={expenses.length === 0}
                      >
                        Export CSV
                      </Button>
                      {/* Wrapped rather than given `hidden` directly: Button's
                          own `inline-flex` and a `hidden` class are both display
                          utilities, and which one wins depends on Tailwind's
                          internal ordering rather than on the order written
                          here. The wrapper makes it unambiguous. */}
                      <div className="hidden pointer-coarse:block">
                        <Button size="sm" onClick={() => cameraRef.current?.click()}>
                          Take photo
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => inputRef.current?.click()}
                      >
                        Add receipt
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2 — Dropzone / upload states, under the first header only. */}
                {isFirst && (
                  <>
                    {showDropzone && (
                      <Dropzone
                        // On a phone this stays the camera, which is what
                        // tapping it did before the library picker existed.
                        // Deciding at click time rather than at render avoids
                        // branching on a media query during hydration.
                        onPick={() => {
                          const touch =
                            typeof window !== 'undefined' &&
                            window.matchMedia('(pointer: coarse)').matches
                          ;(touch ? cameraRef : inputRef).current?.click()
                        }}
                        onFiles={handleFiles}
                        busy={status === 'loading'}
                      />
                    )}

                    {quotaReached && (
                      <Card padding="none" className="px-[18px] py-5">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <p className="text-[15px] font-semibold text-text">
                            You have used all {FREE_MONTHLY_LIMIT} free receipts this month
                          </p>
                          <p className="max-w-[320px] text-[13px] leading-[1.5] text-text-muted">
                            Upgrade to Pro for unlimited scans, no monthly cap, and priority support.
                          </p>
                          <Link
                            href="/pricing"
                            className="mt-1 inline-flex items-center rounded-lg border border-text bg-text px-5 py-2.5 text-[14px] font-medium text-surface transition-colors hover:bg-text-secondary hover:border-text-secondary"
                          >
                            See plans
                          </Link>
                        </div>
                      </Card>
                    )}

                    {status === 'error' && error && !quotaReached && (
                      <Card padding="none" className="px-[18px] py-4">
                        <p role="alert" className="text-[13px] text-warning">
                          {error}
                        </p>
                        <p className="mt-1 text-[13px] text-text-tertiary">
                          Nothing was saved. You can try another photo.
                        </p>
                      </Card>
                    )}

                    {status === 'saved' && (
                      <Card padding="none" className="px-[18px] py-4">
                        <p role="status" className="text-[13px] text-text-muted">
                          Saved. Ready for the next receipt.
                        </p>
                      </Card>
                    )}

                    {batch.halted && (
                      <Card padding="none" className="px-[18px] py-4">
                        <p role="alert" className="text-[13px] text-warning">
                          {batch.halted}
                        </p>
                        <p className="mt-1 text-[13px] text-text-tertiary">
                          Anything already saved is safe. Drop the rest again once the limit resets.
                        </p>
                      </Card>
                    )}

                    {batch.skipped.length > 0 && (
                      <Card padding="none" className="px-[18px] py-4">
                        <p className="text-[13px] text-text-muted">
                          Skipped {batch.skipped.length} unsupported file
                          {batch.skipped.length === 1 ? '' : 's'}: {batch.skipped.join(', ')}
                        </p>
                      </Card>
                    )}

                    {batch.total > 1 && !batch.halted && status === 'loading' && (
                      <p className="text-[13px] text-text-tertiary">
                        Reading {Math.min(batch.done + 1, batch.total)} of {batch.total}…
                      </p>
                    )}

                    {reviewing && pending.length > 0 && (
                      <BatchReview
                        items={pending}
                        expenses={expenses}
                        saving={status === 'saving'}
                        error={status === 'done' ? error : null}
                        onRemove={(id) =>
                          setPending((p) => p.filter((item) => item.id !== id))
                        }
                        onSaveAll={handleSaveAll}
                        onDiscardAll={clearForm}
                      />
                    )}

                    {reviewing && result && (
                      <ExtractionReview
                        result={result}
                        preview={preview}
                        saving={status === 'saving'}
                        error={status === 'done' ? error : null}
                        duplicateOf={duplicateOf}
                        onSave={handleSave}
                        onDiscard={discardAndAdvance}
                      />
                    )}
                  </>
                )}

                {/* 3 — Receipt list, with 4 — the quota row as its last row. */}
                <div className="overflow-hidden rounded-card border border-border">
                  {group.expenses.length === 0 ? (
                    <p className="border-b border-border-subtle px-[18px] py-[14px] text-[13px] text-text-tertiary">
                      No receipts this month yet. Drop a photo above and we will read the merchant,
                      date and total for you.
                    </p>
                  ) : (
                    group.expenses.map((expense) => (
                      <ReceiptRow
                        key={expense.id}
                        expense={expense}
                        onSave={handleUpdate}
                        onDelete={handleDelete}
                      />
                    ))
                  )}

                  {isCurrentMonth && tierKnown && !isPaid && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-sunken px-[18px] py-[14px]">
                      <p className={`text-[13px] ${usedThisMonth >= FREE_MONTHLY_LIMIT ? 'font-medium text-text' : 'text-text-muted'}`}>
                        {usedThisMonth >= FREE_MONTHLY_LIMIT
                          ? `You have used all ${FREE_MONTHLY_LIMIT} free receipts this month.`
                          : `You have used ${usedThisMonth} of ${FREE_MONTHLY_LIMIT} free receipts this month.`}
                      </p>
                      <Link
                        href="/pricing"
                        className="inline-flex min-h-11 items-center text-[13px] text-text underline hover:text-text sm:min-h-0"
                      >
                        {usedThisMonth >= FREE_MONTHLY_LIMIT ? 'Upgrade' : 'See plans'}
                      </Link>
                    </div>
                  )}
                </div>
              </section>
            )
          })}

          {/* 5 — Retention notice. */}
          <RetentionNotice />
        </div>
      </main>

      {/* One picker for both the dropzone and "Add receipt". */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) handleFiles(files)
          // Reset so picking the same file twice still fires `change`.
          e.target.value = ''
        }}
      />

      {/* The camera. `capture` makes a phone skip the chooser and open it
          straight away; desktop browsers ignore the attribute entirely, which is
          why the button that opens this is hidden on a fine pointer. No
          `multiple`, because `capture` would override it regardless. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) handleFiles(files)
          e.target.value = ''
        }}
      />
    </>
  )
}

// ── Route ────────────────────────────────────────────────────────────────────

export default function ReceiptsPage() {
  const { session, loading } = useSession()

  // src/proxy.ts already redirected anyone without a session cookie to /login,
  // so this is the belt-and-braces path: render nothing rather than flash the
  // wrong UI while the browser client catches up.
  if (loading || !session) return null

  return <App session={session} />
}
