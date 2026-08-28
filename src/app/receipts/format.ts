import type { Expense } from '@/lib/supabase'

/**
 * Formatting and grouping helpers for the receipt inbox.
 *
 * ## Dates are never parsed with `new Date(iso)`
 *
 * `expenses.date` is a Postgres `date` and arrives as a bare "YYYY-MM-DD".
 * `new Date("2026-03-18")` is parsed as **UTC midnight**, so every timezone
 * west of Greenwich renders it as March 17 — an off-by-one on every receipt for
 * most of the US, which is the market. The helpers below split the string
 * instead, so a date is treated as the calendar date it is rather than an
 * instant in time.
 */

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "YYYY-MM-DD" → { year, month (1-12), day }, or null if it is not that shape. */
function dateParts(iso: string | null | undefined) {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  return { year, month, day }
}

/**
 * "$1,284.60" — comma thousands separators, two decimals, as specified.
 *
 * Display only. The CSV export and every write to Supabase use the raw numeric
 * value, so this never touches stored data.
 */
const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function money(value: number | string) {
  const n = Number(value)
  return Number.isFinite(n) ? MONEY.format(n) : '—'
}

/** US convention, month-first abbreviated: "Mar 18". */
export function shortDate(iso: string) {
  const parts = dateParts(iso)
  return parts ? `${MONTHS_SHORT[parts.month - 1]} ${parts.day}` : iso
}

/** "YYYY-MM" — the grouping key. */
export function monthKey(iso: string) {
  const parts = dateParts(iso)
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : 'unknown'
}

/** "YYYY-MM" → "March 2026". */
export function monthLabel(key: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (!match) return 'Undated'
  const month = Number(match[2])
  if (month < 1 || month > 12) return 'Undated'
  return `${MONTHS_LONG[month - 1]} ${match[1]}`
}

/** The user's current calendar month, in local time, as a "YYYY-MM" key. */
export function currentMonthKey(now: Date = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export type MonthGroup = {
  key: string
  label: string
  expenses: Expense[]
  /** Derived from the rows in this group — never a sample value. */
  count: number
  total: number
  needingCategory: number
  needingReview: number
}

/** A receipt with no category is the "Needs category" status. */
export function needsCategory(expense: Expense) {
  return expense.category == null || expense.category === ''
}

/**
 * A receipt the extraction was not sure about.
 *
 * Only an explicit 'low' counts. `null` means the row predates the column and
 * was never assessed, which is not the same as a bad read — treating it as one
 * would flag every historical receipt at once and make the signal worthless on
 * the day it shipped.
 */
export function needsReview(expense: Expense) {
  return expense.confidence === 'low'
}

/**
 * The fields that decide whether two receipts are the same one.
 *
 * Deliberately narrower than `Expense`: the batch review compares rows that
 * have not been saved yet and so have no id or timestamps, and casting those
 * into an `Expense` shape just to satisfy the signature would be a lie the
 * compiler happened to accept.
 */
export type ReceiptLike = {
  merchant: string | null
  date: string | null
  total: number | null
}

/**
 * An already-saved receipt that looks like the one being saved.
 *
 * Merchant, date and total together. Merchant is compared case-insensitively
 * because the extraction is not consistent about it — "The Home Depot" and
 * "THE HOME DEPOT" both occur in real rows, and a case-sensitive match would
 * miss exactly the duplicates it exists to catch.
 *
 * Totals are compared as numbers: Postgres returns `numeric` as a string, so
 * "227.50" and 227.5 are the same receipt and a `===` would disagree.
 *
 * A null merchant, date or total never matches. Those receipts cannot be saved
 * anyway, and treating null as equal to null would make every incomplete scan
 * look like a duplicate of every other.
 */
export function findDuplicate<T extends ReceiptLike>(
  expenses: readonly T[],
  candidate: ReceiptLike,
): T | null {
  if (!candidate.merchant || !candidate.date || candidate.total == null) return null
  const merchant = candidate.merchant.trim().toLowerCase()
  return (
    expenses.find(
      (e) =>
        e.date === candidate.date &&
        Number(e.total) === Number(candidate.total) &&
        (e.merchant ?? '').trim().toLowerCase() === merchant,
    ) ?? null
  )
}

/**
 * Group receipts by the month of `expenses.date`, newest month first and
 * newest receipt first within each month.
 *
 * The list is ordered by `created_at` in the query; ordering by `date` here is
 * a display change only. `created_at` breaks ties so two receipts dated the
 * same day keep a stable, meaningful order.
 */
export function groupByMonth(expenses: Expense[]): MonthGroup[] {
  const groups = new Map<string, Expense[]>()

  for (const expense of expenses) {
    const key = monthKey(expense.date)
    const bucket = groups.get(key)
    if (bucket) bucket.push(expense)
    else groups.set(key, [expense])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, rows]) => {
      const sorted = [...rows].sort(
        (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
      )
      return {
        key,
        label: monthLabel(key),
        expenses: sorted,
        count: sorted.length,
        total: sorted.reduce((sum, e) => sum + Number(e.total), 0),
        needingCategory: sorted.filter(needsCategory).length,
        needingReview: sorted.filter(needsReview).length,
      }
    })
}

/**
 * "12 receipts · $1,284.60 · 2 to check · 3 need a category".
 *
 * Trailing segments are omitted when their count is zero — "0 need a category"
 * is noise on a tidy month.
 */
export function monthMeta(
  group: Pick<MonthGroup, 'count' | 'total' | 'needingCategory' | 'needingReview'>,
) {
  const segments = [
    `${group.count} ${group.count === 1 ? 'receipt' : 'receipts'}`,
    money(group.total),
  ]
  // Ahead of the category segment: a total that may be wrong costs more than a
  // receipt that is merely unfiled.
  if (group.needingReview > 0) {
    segments.push(`${group.needingReview} to check`)
  }
  if (group.needingCategory > 0) {
    segments.push(
      `${group.needingCategory} ${group.needingCategory === 1 ? 'needs' : 'need'} a category`,
    )
  }
  return segments.join(' · ')
}

/**
 * Avatar initials from the session email: "ada.lovelace@x.com" → "AL",
 * "ada@x.com" → "AD". Falls back to "?" rather than rendering an empty circle.
 */
export function initialsFromEmail(email: string | undefined | null) {
  const local = (email ?? '').split('@')[0] ?? ''
  const chunks = local.split(/[^a-zA-Z]+/).filter(Boolean)
  if (chunks.length >= 2) return (chunks[0][0] + chunks[1][0]).toUpperCase()
  const letters = local.replace(/[^a-zA-Z]/g, '')
  return letters.slice(0, 2).toUpperCase() || '?'
}
