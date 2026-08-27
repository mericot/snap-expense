'use client'

import { Button, Card, Pill } from '@/components/ui'
import type { Expense } from '@/lib/supabase'
import { money, shortDate } from './format'

/**
 * The review step between "we read your receipt" and "saved".
 *
 * Undesigned — the handoff lists "a single receipt detail/edit view" as a state
 * that still needs design. This carries the existing behaviour across and
 * restyles it to the tokens; it is not an attempt to design the missing screen.
 */

export type ExtractedExpense = {
  merchant: string | null
  date: string | null
  total: number | null
  tax: number | null
  category: string | null
  confidence: 'high' | 'low'
}

export default function ExtractionReview({
  result,
  preview,
  saving,
  error,
  duplicateOf,
  onSave,
  onDiscard,
}: {
  result: ExtractedExpense
  preview: string | null
  saving: boolean
  error: string | null
  /**
   * An already-saved receipt with the same merchant, date and total. Set only
   * after the first save attempt, so the warning appears in response to the
   * action rather than pre-emptively second-guessing every scan.
   */
  duplicateOf: Expense | null
  onSave: () => void
  onDiscard: () => void
}) {
  const fields: [string, string | null][] = [
    ['Merchant', result.merchant],
    ['Date', result.date],
    ['Total', result.total != null ? money(result.total) : null],
    ['Tax', result.tax != null ? money(result.tax) : null],
    ['Category', result.category],
  ]

  return (
    <div className="flex flex-col gap-4">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="The receipt you just uploaded"
          className="max-h-[200px] w-full rounded-card border border-border object-contain"
        />
      )}

      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-[18px] py-[14px]">
          <h2 className="text-[14px] font-semibold text-text">What we read</h2>
          {/* Confidence is in the words, not the colour — "Low confidence"
              still reads as low with the tone stripped out. */}
          <Pill tone={result.confidence === 'high' ? 'default' : 'warning'}>
            {result.confidence === 'high' ? 'High confidence' : 'Low confidence — check values'}
          </Pill>
        </div>

        <dl>
          {fields.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 border-b border-border-subtle px-[18px] py-3"
            >
              <dt className="text-[13px] text-text-tertiary">{label}</dt>
              <dd className="text-[14px] font-medium text-text tabular-nums">
                {value ?? <span className="text-text-placeholder">Not found</span>}
              </dd>
            </div>
          ))}
        </dl>

        {duplicateOf && (
          <div className="border-b border-border-subtle px-[18px] py-[14px]">
            <p role="alert" className="text-[13px] text-warning">
              You already have a receipt for {duplicateOf.merchant} on{' '}
              {shortDate(duplicateOf.date)} for {money(Number(duplicateOf.total))}.
            </p>
            <p className="mt-1 text-[13px] text-text-tertiary">
              This may be the same receipt scanned twice. Save it anyway if it is a
              separate purchase.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 px-[18px] py-[14px]">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : duplicateOf ? 'Save anyway' : 'Save receipt'}
          </Button>
          <Button size="sm" variant="outline" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
        </div>
      </Card>

      {error && (
        <p role="alert" className="text-[13px] text-warning">
          {error}
        </p>
      )}
    </div>
  )
}
