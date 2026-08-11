import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui'
import { PRE_CHECKOUT_STATEMENTS } from '@/lib/plans'
import PlanGrid from './PlanGrid'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free, no card required. Upgrade when your receipts pile up.',
}

export default function PricingPage() {
  return (
    <>
      <header className="border-b border-border bg-surface px-8 py-4">
        <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[17px] font-bold tracking-[-0.01em] text-text no-underline hover:text-text sm:min-h-0"
          >
            snapExpense
          </Link>

          <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]">
            <Link href="/" className="inline-flex min-h-11 items-center text-text-muted hover:text-text sm:min-h-0">
              Home
            </Link>
            <span aria-current="page" className="inline-flex min-h-11 items-center text-text sm:min-h-0">
              Pricing
            </span>
            <Link href="/legal/privacy" className="inline-flex min-h-11 items-center text-text-muted hover:text-text sm:min-h-0">
              Privacy
            </Link>
            <Button href="/login" size="sm">
              Try it free
            </Button>
          </nav>
        </div>
      </header>

    <main className="flex flex-1 flex-col items-center bg-surface-recessed px-6 pt-12 pb-2">
      <h1 className="text-center text-[28px] font-bold tracking-[-0.02em] text-text text-pretty">
        Start free. Upgrade when your receipts pile up.
      </h1>
      <p className="mt-[10px] max-w-[460px] text-center text-[15px] leading-[1.5] text-text-tertiary text-pretty">
        Free needs no card. Cancel a paid plan in two clicks, and your receipts stay
        downloadable either way.
      </p>

      <PlanGrid />

      <ul className="mt-7 mb-10 flex list-none flex-wrap justify-center gap-x-6 gap-y-2 text-center text-[12px] text-text-tertiary">
        {PRE_CHECKOUT_STATEMENTS.map((statement) => (
          <li key={statement}>{statement}</li>
        ))}
      </ul>
    </main>
    </>
  )
}
