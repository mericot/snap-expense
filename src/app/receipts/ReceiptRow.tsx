'use client'

import { useId, useState } from 'react'
import { Button, Pill, cx } from '@/components/ui'
import { CATEGORIES } from '@/lib/categories'
import type { Expense } from '@/lib/supabase'
import { money, needsCategory, shortDate } from './format'

/**
 * One receipt in the inbox — display state and inline edit state.
 *
 * ## Why one component and not a table row plus a card
 *
 * The old page rendered a six-column `<table>` above 640px and a separate
 * stacked card below it. The design specifies a single list container with one
 * row treatment, and the quota row as the last row *inside* that container — a
 * table cannot hold that without a colspan hack, and the designed row does not
 * have columns anyway (merchant, meta, status, amount). So both presentations
 * collapse into this one responsive row.
 *
 * The *interaction* is preserved as it was: edit and delete are revealed on
 * hover above 640px and always visible below it. They are additionally revealed
 * on `focus-within`, which the old code did not do — with opacity alone, a
 * keyboard user tabbed onto an invisible button.
 */

export type EditDraft = {
  merchant: string
  date: string
  total: string
  tax: string
  category: string
}

function draftFrom(expense: Expense): EditDraft {
  return {
    merchant: expense.merchant,
    date: expense.date,
    total: String(expense.total),
    tax: expense.tax != null ? String(expense.tax) : '',
    category: expense.category ?? '',
  }
}

const FIELD = cx(
  'w-full min-w-0 rounded-btn border border-border-strong bg-surface',
  'px-3 py-2 text-[14px] text-text min-h-11 sm:min-h-9',
)

const FIELD_LABEL = 'mb-1 block text-[12px] font-medium text-text-title'

export default function ReceiptRow({
  expense,
  onSave,
  onDelete,
}: {
  expense: Expense
  onSave: (id: string, draft: EditDraft) => Promise<string | null>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState<EditDraft>(() => draftFrom(expense))
  const fieldId = useId()

  function set(field: keyof EditDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  function startEditing() {
    setDraft(draftFrom(expense))
    setSaveError(null)
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const error = await onSave(expense.id, draft)
      if (error) {
        setSaveError(error)
      } else {
        setEditing(false)
      }
    } catch {
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await onDelete(expense.id)
      setConfirming(false)
    } catch {
      setDeleting(false)
      setConfirming(false)
    }
  }

  const status = needsCategory(expense)
    ? { label: 'Needs category', tone: 'warning' as const }
    : { label: 'Ready', tone: 'default' as const }

  if (editing) {
    return (
      <div className="border-b border-border-subtle bg-surface-sunken px-[18px] py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor={`${fieldId}-merchant`} className={FIELD_LABEL}>
              Merchant
            </label>
            <input
              id={`${fieldId}-merchant`}
              type="text"
              autoComplete="off"
              value={draft.merchant}
              onChange={(e) => set('merchant', e.target.value)}
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-date`} className={FIELD_LABEL}>
              Date
            </label>
            <input
              id={`${fieldId}-date`}
              type="date"
              autoComplete="off"
              value={draft.date}
              onChange={(e) => set('date', e.target.value)}
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-category`} className={FIELD_LABEL}>
              Category
            </label>
            <select
              id={`${fieldId}-category`}
              value={draft.category}
              onChange={(e) => set('category', e.target.value)}
              className={FIELD}
            >
              <option value="">Uncategorized</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${fieldId}-total`} className={FIELD_LABEL}>
              Total
            </label>
            <input
              id={`${fieldId}-total`}
              type="number"
              inputMode="decimal"
              autoComplete="off"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={draft.total}
              onChange={(e) => set('total', e.target.value)}
              className={cx(FIELD, 'text-right tabular-nums')}
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-tax`} className={FIELD_LABEL}>
              Tax
            </label>
            <input
              id={`${fieldId}-tax`}
              type="number"
              inputMode="decimal"
              autoComplete="off"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={draft.tax}
              onChange={(e) => set('tax', e.target.value)}
              className={cx(FIELD, 'text-right tabular-nums')}
            />
          </div>
        </div>

        {saveError && (
          <p className="mt-3 text-[13px] text-danger">{saveError}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-subtle px-[18px] py-[14px]">
      <div className="min-w-0 flex-1 basis-[8rem]">
        <p className="truncate text-[14px] font-medium text-text">{expense.merchant}</p>
        <p className="mt-0.5 text-[12px] text-text-faint">
          {shortDate(expense.date)}
          {expense.category ? ` · ${expense.category}` : ''}
          {/* Tax is stored, exported and editable but has no slot in the
              designed row. Hiding a stored money value in a restyle is worse
              than one extra segment here — see the PR, this is one line to
              revert if the reviewer disagrees. */}
          {expense.tax != null ? ` · Tax ${money(expense.tax)}` : ''}
        </p>
        {/* Below 640px the pill sits under the meta line: a truncated merchant,
            a pill and an 84px amount do not read well side by side at 420px. */}
        <span className="mt-1.5 inline-flex sm:hidden">
          <Pill tone={status.tone}>{status.label}</Pill>
        </span>
      </div>

      <span className="hidden shrink-0 sm:inline-flex">
        <Pill tone={status.tone}>{status.label}</Pill>
      </span>

      <span className="w-[84px] shrink-0 text-right text-[14px] tabular-nums text-text">
        {money(expense.total)}
      </span>

      {/* basis-full drops the actions onto their own line below 640px, where
          they are always visible; above it they sit in the row and fade in on
          hover or keyboard focus. Opacity rather than display keeps the row
          from reflowing under the cursor. */}
      <div
        className={cx(
          'flex basis-full items-center justify-end gap-2 sm:basis-auto',
          !confirming && 'sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
        )}
      >
        {confirming ? (
          <>
            <span className="text-[12px] text-text-muted">Delete?</span>
            <Button size="sm" variant="outline" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
              No
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={startEditing}>
              Edit<span className="sr-only"> {expense.merchant}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              Delete<span className="sr-only"> {expense.merchant}</span>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
