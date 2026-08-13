'use client'

import { useState } from 'react'
import { cx } from '@/components/ui'
import { MAX_UPLOAD_MB } from './constants'

/**
 * The upload target.
 *
 * ## The copy had to change
 *
 * The design reads "Drop a photo or PDF here". `ALLOWED_TYPES` is images and
 * HEIC — the uploader rejects PDF, and the extract route rejects it again
 * server-side. Shipping the sentence as written would promise a format that
 * fails on drop, so "or PDF" is removed. Adding real PDF support is the larger
 * change and is a follow-up, not this branch.
 *
 * ## It also had to actually accept a drop
 *
 * The prototype dropzone is a static `<div>` and the current app only opens a
 * file picker on click. Copy that says "drop here" has to be true, so this is a
 * real drop target as well as a `<button>` — keyboard-operable, with the global
 * focus ring, rather than a div with a click handler.
 *
 * The `<input type="file">` itself lives in the page, because the "Add receipt"
 * button in the month header opens the same picker.
 */

export default function Dropzone({
  onPick,
  onFile,
  busy,
}: {
  /** Open the file picker. */
  onPick: () => void
  /** A file arrived by drag and drop. */
  onFile: (file: File) => void
  busy: boolean
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault()
        if (!busy) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (!busy && file) onFile(file)
      }}
      className={cx(
        'flex w-full cursor-pointer flex-col items-start gap-1 text-left',
        'rounded-card border border-dashed bg-surface-sunken px-5 py-[18px]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        dragging ? 'border-text' : 'border-border-strong hover:border-text',
      )}
    >
      <span className="text-[13px] text-text-muted">
        {busy
          ? 'Reading your receipt…'
          : 'Drop a photo here — we read the merchant, date and total for you.'}
      </span>
      {/* Naming the formats and the size cap here is cheaper than letting the
          upload fail: an oversized file costs a rate-limit slot to find out. */}
      <span className="text-[12px] text-text-faint">
        JPEG, PNG, WebP, GIF or HEIC · up to {MAX_UPLOAD_MB} MB
      </span>
    </button>
  )
}
