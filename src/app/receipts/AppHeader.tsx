'use client'

import Link from 'next/link'
import { Button } from '@/components/ui'
import { useSubscription } from '@/components/SubscriptionProvider'
import { initialsFromEmail } from './format'


export default function AppHeader({
  email,
  onSignOut,
  currentPage = 'receipts',
}: {
  email: string | undefined
  onSignOut: () => void
  currentPage?: 'receipts' | 'settings'
}) {
  const initials = initialsFromEmail(email)
  const { plan, status } = useSubscription()
  const isPaid = plan !== 'free' && (status === 'active' || status === 'trialing')

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-5">
          <Link
            href="/receipts"
            className="inline-flex min-h-11 items-center text-[17px] font-bold tracking-[-0.01em] text-text no-underline hover:text-text sm:min-h-0"
          >
            snapExpense
          </Link>

          <nav aria-label="Sections" className="flex items-center gap-4 text-[14px]">
            {currentPage === 'receipts' ? (
              <span aria-current="page" className="text-text">
                Receipts
              </span>
            ) : (
              <Link href="/receipts" className="text-text-muted no-underline hover:text-text">
                Receipts
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isPaid ? (
            <span className="rounded-full border border-border bg-surface-sunken px-3 py-1 text-[12px] font-medium text-text-muted">
              {plan === 'pro' ? 'Pro' : 'Team'}
              {status === 'trialing' ? ' trial' : ''}
            </span>
          ) : (
            <Button href="/pricing" variant="outline" size="sm" className="no-underline">
              Upgrade
            </Button>
          )}

          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
              <path d="M13.05 10a1.13 1.13 0 0 0 .22 1.24l.04.04a1.37 1.37 0 1 1-1.94 1.94l-.04-.04a1.13 1.13 0 0 0-1.24-.22 1.13 1.13 0 0 0-.69 1.04v.11a1.37 1.37 0 1 1-2.74 0V14a1.13 1.13 0 0 0-.74-1.04 1.13 1.13 0 0 0-1.24.22l-.04.04a1.37 1.37 0 1 1-1.94-1.94l.04-.04A1.13 1.13 0 0 0 3 10a1.13 1.13 0 0 0-1.04-.69h-.11a1.37 1.37 0 1 1 0-2.74H2a1.13 1.13 0 0 0 1.04-.74 1.13 1.13 0 0 0-.22-1.24l-.04-.04a1.37 1.37 0 1 1 1.94-1.94l.04.04A1.13 1.13 0 0 0 6 3v-.06a1.37 1.37 0 0 1 2.74 0V3a1.13 1.13 0 0 0 .69 1.04 1.13 1.13 0 0 0 1.24-.22l.04-.04a1.37 1.37 0 1 1 1.94 1.94l-.04.04A1.13 1.13 0 0 0 13 7c.46.18.77.62.78 1.11v.11c0 .49-.31.93-.78 1.11h.05Z" />
            </svg>
          </Link>

          <Button variant="outline" size="sm" onClick={onSignOut}>
            Sign out
          </Button>

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
