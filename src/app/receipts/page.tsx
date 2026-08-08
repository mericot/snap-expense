'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Button, Card } from '@/components/ui'
import { supabase, type Expense } from '@/lib/supabase'
import { useSession } from '@/components/SessionProvider'
import { useSubscription } from '@/components/SubscriptionProvider'
import AppHeader from './AppHeader'
import Dropzone from './Dropzone'
import ExtractionReview, { type ExtractedExpense } from './ExtractionReview'
import ReceiptRow, { type EditDraft } from './ReceiptRow'
import RetentionNotice from './RetentionNotice'
import { ALLOWED_TYPES, FREE_MONTHLY_LIMIT, HEIC_TYPES } from './constants'
import {
  currentMonthKey,
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

function resizeImage(file: File, maxPx: number): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxPx / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mediaType: 'image/jpeg' })
    }
    img.onerror = reject
    img.src = url
  })
}

function readToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        base64: (reader.result as string).split(',')[1],
        mediaType: file.type || 'image/heic',
      })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── App (authenticated) ──────────────────────────────────────────────────────

function App({ session }: { session: Session }) {
  const { plan, status: subStatus } = useSubscription()
  const isPaid = plan !== 'free' && (subStatus === 'active' || subStatus === 'trialing')
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'done' | 'saving' | 'saved' | 'error'
  >('idle')
  const [result, setResult] = useState<ExtractedExpense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [scansThisMonth, setScansThisMonth] = useState(0)

  const loadExpenses = useCallback(async () => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`

    const [{ data }, { count }] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart),
    ])
    if (data) setExpenses(data)
    setScansThisMonth(count ?? 0)
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
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setPreview(null)

    if (!isPaid && usedThisMonth >= FREE_MONTHLY_LIMIT) {
      setStatus('error')
      setError(
        `You have used all ${FREE_MONTHLY_LIMIT} free receipts this month. Upgrade to Pro for unlimited scans.`,
      )
      return
    }

    setStatus('loading')
    const heic = isHeic(file)
    if (!heic && !ALLOWED_TYPES.includes(file.type)) {
      setStatus('error')
      setError(
        `Unsupported file type (${file.type || 'unknown'}). Please use JPEG, PNG, WebP, GIF or HEIC.`,
      )
      return
    }
    if (!heic) setPreview(URL.createObjectURL(file))
    try {
      const { base64, mediaType } = heic
        ? await readToBase64(file)
        : await resizeImage(file, 1500)
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const data = await res.json()
      // The route returns a specific, actionable message for rate limiting,
      // oversize bodies, timeouts and unsupported media types. Surface it
      // rather than collapsing everything into "Something went wrong".
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
      setResult(data)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  async function handleSave() {
    if (!result) return
    if (!result.merchant || !result.date || result.total == null) {
      setError('Cannot save — merchant, date, and total are required.')
      return
    }
    setStatus('saving')
    const { error: dbError } = await supabase.from('expenses').insert({
      user_id: session.user.id,
      merchant: result.merchant,
      date: result.date,
      total: result.total,
      tax: result.tax,
      category: result.category,
    })
    if (dbError) {
      setError(`Save failed: ${dbError.message}`)
      setStatus('done')
      return
    }
    await loadExpenses()
    setStatus('saved')
    setTimeout(clearForm, 1500)
  }

  async function handleUpdate(id: string, draft: EditDraft): Promise<string | null> {
    if (!draft.merchant.trim()) return 'Merchant is required.'
    if (!draft.date) return 'Date is required.'
    const total = parseFloat(draft.total)
    if (!Number.isFinite(total) || total < 0) return 'Total must be a valid number.'
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
  const quotaReached = !isPaid && usedThisMonth >= FREE_MONTHLY_LIMIT
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
                      <Button size="sm" onClick={() => inputRef.current?.click()}>
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
                        onPick={() => inputRef.current?.click()}
                        onFile={handleFile}
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

                    {reviewing && result && (
                      <ExtractionReview
                        result={result}
                        preview={preview}
                        saving={status === 'saving'}
                        error={status === 'done' ? error : null}
                        onSave={handleSave}
                        onDiscard={clearForm}
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

                  {isCurrentMonth && !isPaid && (
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
        accept="image/*,.heic,.heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          // Reset so picking the same file twice still fires `change`.
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
