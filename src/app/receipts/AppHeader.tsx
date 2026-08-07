'use client'

import Link from 'next/link'
import { Button } from '@/components/ui'
import { initialsFromEmail } from './format'


export default function AppHeader({
  email,
  onSignOut,
}: {
  email: string | undefined
  onSignOut: () => void
}) {
  const initials = initialsFromEmail(email)

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-5">
          {/* min-h-11 below `sm` only: the wordmark is a real link, so it has
              to clear the 44px touch target on a phone, but at the designed
              17px it is only 26px tall. Above 640px it collapses back. */}
          <Link
            href="/receipts"
            className="inline-flex min-h-11 items-center text-[17px] font-bold tracking-[-0.01em] text-text no-underline hover:text-text sm:min-h-0"
          >
            snapExpense
          </Link>

          <nav aria-label="Sections" className="flex items-center gap-4 text-[14px]">
            {/* aria-current marks the active section for assistive tech; the
                #18181b weighting is the visual half of the same signal. */}
            <span aria-current="page" className="text-text">
              Receipts
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button href="/pricing" variant="outline" size="sm" className="no-underline">
            Upgrade
          </Button>

          <Button variant="outline" size="sm" onClick={onSignOut}>
            Sign out
          </Button>

          {/* Decorative: the initials are a compressed form of the email, which
              is announced in full by the sr-only text beside it. Marking the
              circle aria-hidden stops screen readers reading "A M". */}
          <span
            aria-hidden="true"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-border text-[12px] text-text-muted"
          >
            {initials}
          </span>
          <span className="sr-only">Signed in as {email ?? 'your account'}</span>
        </div>
      </div>
    </header>
  )
}
