'use client'

import { Button, Card, Pill } from '@/components/ui'
import type { Expense } from '@/lib/supabase'
import type { ExtractedExpense } from './ExtractionReview'
import { findDuplicate, money, shortDate, type ReceiptLike } from './format'

export type PendingReceipt = {
  /** Local key only; these rows do not exist in the database yet. */
  id: string
  fileName: string
  result: ExtractedExpense
}

/**
 * One screen for a whole batch, instead of one card per receipt.
 *
 * Scanning sixty receipts used to mean sixty review-and-save cycles. Nobody
 * reads the sixtieth as carefully as the first, and the failure that starts
 * this whole line of work — a total misread as 110035.02 — is exactly the kind
 * a tiring reader waves through. Putting every figure on one screen turns
 * reviewing from sixty separate decisions into one pass down a column, where a
 * wrong number is conspicuous next to its neighbours.
 *
 * Nothing here is editable. The row list below already has inline editing, and
 * duplicating it mid-batch would be a second implementation of the same form
 * with its own bugs. The job of this screen is to decide what gets saved, not
 * to correct it.
 */

/** Which rows can actually be inserted; the rest are missing a required field. */
function isSavable(r: ExtractedExpense) {
  return Boolean(r.merchant) && Boolean(r.date) && r.total != null
}

export default function BatchReview({
  items,
  expenses,
  saving,
  error,
  onRemove,
  onSaveAll,
  onDiscardAll,
}: {
  items: PendingReceipt[]
  /** Already-saved receipts, for spotting a repeat scan. */
  expenses: Expense[]
  saving: boolean
  error: string | null
  onRemove: (id: string) => void
  onSaveAll: () => void
  onDiscardAll: () => void
}) {
  const savable = items.filter((i) => isSavable(i.result))
  const lowConfidence = items.filter((i) => i.result.confidence === 'low').length
  const incomplete = items.length - savable.length

  // A duplicate can be a receipt already saved, or an earlier row in this same
  // batch — dropping the same folder twice produces both.
  const seen: ExtractedExpense[] = []
  const duplicateOf = new Map<string, { of: ReceiptLike; saved: boolean }>()
  for (const item of items) {
    // Which kind matters to the wording. "Already saved" is a lie for a row
    // that merely repeats another row in a batch nothing has yet written.
    const priorSaved = findDuplicate(expenses, item.result)
    const priorInBatch = priorSaved ? null : findDuplicate(seen, item.result)
    if (priorSaved) duplicateOf.set(item.id, { of: priorSaved, saved: true })
    else if (priorInBatch) duplicateOf.set(item.id, { of: priorInBatch, saved: false })
    seen.push(item.result)
  }

  const summary = [
    `${items.length} receipt${items.length === 1 ? '' : 's'} read`,
    lowConfidence > 0 && `${lowConfidence} to check`,
    duplicateOf.size > 0 && `${duplicateOf.size} possible duplicate${duplicateOf.size === 1 ? '' : 's'}`,
    incomplete > 0 && `${incomplete} incomplete`,
  ].filter(Boolean).join(' · ')

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-[18px] py-[14px]">
        <div>
          <h2 className="text-[14px] font-semibold text-text">Check before saving</h2>
          <p className="mt-0.5 text-[13px] text-text-tertiary">{summary}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-text-tertiary">
              <th className="px-[18px] py-2 text-left font-medium">Merchant</th>
              <th className="px-2 py-2 text-left font-medium">Date</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 text-right font-medium">Tax</th>
              <th className="px-2 py-2 text-left font-medium">Category</th>
              <th className="px-2 py-2 text-left font-medium">Status</th>
              <th className="px-[18px] py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const r = item.result
              const dupe = duplicateOf.get(item.id)
              const cannotSave = !isSavable(r)
              return (
                <tr key={item.id} className="border-t border-border-subtle align-top">
                  <td className="px-[18px] py-3">
                    <span className="font-medium text-text">
                      {r.merchant ?? <span className="text-text-placeholder">Not found</span>}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-text-tertiary">{item.fileName}</span>
                  </td>
                  <td className="px-2 py-3 text-text-secondary">
                    {r.date ? shortDate(r.date) : <span className="text-text-placeholder">—</span>}
                  </td>
                  <td className="px-2 py-3 text-right font-medium tabular-nums text-text">
                    {r.total != null ? money(r.total) : <span className="text-text-placeholder">—</span>}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-text-secondary">
                    {r.tax != null ? money(r.tax) : <span className="text-text-placeholder">—</span>}
                  </td>
                  <td className="px-2 py-3 text-text-secondary">
                    {r.category ?? <span className="text-text-placeholder">—</span>}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {cannotSave && <Pill tone="warning">Incomplete</Pill>}
                      {r.confidence === 'low' && <Pill tone="warning">Check totals</Pill>}
                      {dupe && (
                        <Pill tone="warning">
                          {dupe.saved ? 'Already saved' : 'Repeated below'}
                        </Pill>
                      )}
                      {!cannotSave && r.confidence !== 'low' && !dupe && <Pill>Ready</Pill>}
                    </div>
                    {dupe && (
                      <p className="mt-1 text-[12px] text-text-tertiary">
                        {dupe.saved ? 'Matches ' : 'Same as another row: '}
                        {dupe.of.merchant}, {dupe.of.date ? shortDate(dupe.of.date) : ''},{' '}
                        {money(Number(dupe.of.total))}
                      </p>
                    )}
                  </td>
                  <td className="px-[18px] py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRemove(item.id)}
                      disabled={saving}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {incomplete > 0 && (
        <p className="border-t border-border-subtle px-[18px] py-3 text-[13px] text-text-muted">
          {incomplete} receipt{incomplete === 1 ? '' : 's'} could not be read well enough to save —
          a merchant, date and total are all required. Saving leaves {incomplete === 1 ? 'it' : 'them'} here so
          nothing disappears quietly; remove {incomplete === 1 ? 'it' : 'them'} or scan again.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border-subtle px-[18px] py-[14px]">
        <Button size="sm" onClick={onSaveAll} disabled={saving || savable.length === 0}>
          {saving
            ? 'Saving…'
            : `Save ${savable.length} receipt${savable.length === 1 ? '' : 's'}`}
        </Button>
        <Button size="sm" variant="outline" onClick={onDiscardAll} disabled={saving}>
          Discard all
        </Button>
      </div>

      {error && (
        <p role="alert" className="border-t border-border-subtle px-[18px] py-3 text-[13px] text-warning">
          {error}
        </p>
      )}
    </Card>
  )
}
