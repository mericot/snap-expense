// Relative, not the '@/' alias: scripts/eval-extraction.mjs imports this module
// directly from Node to measure the schema that ships, and Node does not resolve
// tsconfig path aliases.
import { CATEGORIES } from './categories.ts'

/**
 * The shape the model returns, and the checks applied to it before anyone sees it.
 *
 * ## Why a tool schema rather than prose
 *
 * The route used to ask for JSON in the prompt and `JSON.parse` the reply, with
 * a regex fallback for when the model wrapped it in prose. That fallback was
 * itself unguarded, so a truncated `{…` threw and surfaced to the user as
 * "Internal server error" — and, because the quota had already been consumed,
 * silently refunded a unit for what was a model-output problem.
 *
 * Only `category` was ever checked. `total`, `tax`, `date` and `merchant`
 * reached the client exactly as emitted, so `total: "twelve dollars"` went
 * straight at a `numeric(10, 2)` column.
 *
 * A tool schema makes the shape the API's problem instead of the prompt's.
 *
 * ## Why `subtotal` and `tip` are extracted but never stored
 *
 * Neither is displayed and neither is a column. They exist so the totals can be
 * checked against each other — see `validateReceipt`. A receipt that carries its
 * own arithmetic is the only case where a wrong number can be caught without
 * knowing the right one.
 */

export type ExtractedReceipt = {
  merchant: string | null
  date: string | null
  subtotal: number | null
  tax: number | null
  tip: number | null
  total: number | null
  category: string | null
  confidence: 'high' | 'low'
}

/** Cents of slack when comparing totals. Receipts round; two of them can. */
const TOLERANCE = 0.02

/** Widest total the `numeric(10, 2)` column accepts. */
const MAX_TOTAL = 100_000_000

/** Oldest date treated as plausible rather than a misread year. */
const MAX_AGE_YEARS = 5

export const RECEIPT_TOOL = {
  name: 'record_receipt',
  description:
    'Record the fields read from a receipt image. Call this exactly once, with whatever was legible.',
  input_schema: {
    type: 'object' as const,
    properties: {
      merchant: { type: ['string', 'null'], description: 'Trading name of the merchant.' },
      date: { type: ['string', 'null'], description: 'Transaction date as YYYY-MM-DD.' },
      subtotal: {
        type: ['number', 'null'],
        description:
          'Pre-tax, pre-tip amount, if the receipt prints one. On a card slip this is the line labelled AMOUNT.',
      },
      tax: { type: ['number', 'null'], description: 'Tax charged. Null if the receipt shows none.' },
      tip: { type: ['number', 'null'], description: 'Tip or gratuity. Null if the receipt shows none.' },
      total: {
        type: ['number', 'null'],
        description:
          'The final amount actually charged, including tax and tip. Negative for a refund, return or credit.',
      },
      category: { type: 'string', enum: [...CATEGORIES] },
      confidence: { type: 'string', enum: ['high', 'low'] },
    },
    required: ['merchant', 'date', 'subtotal', 'tax', 'tip', 'total', 'category', 'confidence'],
  },
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export type ValidationResult = {
  receipt: ExtractedReceipt
  /** Why confidence was forced down, if it was. Empty when nothing fired. */
  reasons: string[]
  /** True when the model said "high" and a check disagreed. */
  downgraded: boolean
  /** True when the model returned a category outside the enum. */
  coercedCategory: boolean
}

/**
 * Coerce the tool payload and sanity-check it.
 *
 * The arithmetic check is the one that matters. Every other rule here asks
 * whether a number looks odd on its own; this one asks whether the receipt
 * agrees with itself, which catches misreads that are individually plausible.
 * The failure this was built for returned `total 110035.02` with `tax 8590.33`
 * — positive, numeric, tax below total, valid date. Every naive check passes.
 * `9445.29 + 8590.33 != 110035.02` does not.
 *
 * `tip` is in the sum because leaving it out would flag every restaurant
 * receipt: 82.50 + 5.16 is not 104.66 until the 17.00 tip is included. A check
 * that cries wolf on a whole category of receipts would be turned off within a
 * week.
 */
export function validateReceipt(raw: unknown): ValidationResult {
  const input = (raw ?? {}) as Record<string, unknown>
  const reasons: string[] = []

  const category = typeof input.category === 'string' ? input.category : null
  const coercedCategory = Boolean(category && !CATEGORIES.includes(category as never))

  const receipt: ExtractedReceipt = {
    merchant: typeof input.merchant === 'string' && input.merchant.trim() ? input.merchant.trim() : null,
    date: typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null,
    subtotal: num(input.subtotal),
    tax: num(input.tax),
    tip: num(input.tip),
    total: num(input.total),
    category: coercedCategory ? 'Other' : category,
    confidence: input.confidence === 'high' ? 'high' : 'low',
  }

  if (typeof input.date === 'string' && receipt.date === null) reasons.push('date_unparseable')
  if (input.total !== null && input.total !== undefined && receipt.total === null) {
    reasons.push('total_not_numeric')
  }

  const { subtotal, tax, tip, total } = receipt

  // The receipt disagreeing with itself.
  if (subtotal !== null && total !== null) {
    const expected = subtotal + (tax ?? 0) + (tip ?? 0)
    if (Math.abs(expected - total) > TOLERANCE) reasons.push('totals_do_not_add_up')
  }

  // Magnitudes, so a refund's negative tax is not read as tax exceeding total.
  if (tax !== null && total !== null && Math.abs(tax) > Math.abs(total)) reasons.push('tax_exceeds_total')

  if (total !== null && Math.abs(total) >= MAX_TOTAL) reasons.push('total_out_of_range')

  if (receipt.date !== null) {
    const d = new Date(`${receipt.date}T00:00:00Z`)
    const now = Date.now()
    if (d.getTime() > now + 86_400_000) reasons.push('date_in_future')
    else if (d.getTime() < now - MAX_AGE_YEARS * 365.25 * 86_400_000) reasons.push('date_too_old')
  }

  const downgraded = reasons.length > 0 && receipt.confidence === 'high'
  if (reasons.length > 0) receipt.confidence = 'low'

  return { receipt, reasons, downgraded, coercedCategory }
}
