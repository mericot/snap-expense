import type { Metadata } from 'next'
import Link from 'next/link'
import { Button, Card, cx } from '@/components/ui'
import {
  PLANS,
  PRE_CHECKOUT_STATEMENTS,
  formatMoneyHeadline,
  headlineAmountCents,
  type Plan,
} from '@/lib/plans'

export const metadata: Metadata = {
  title: 'Pricing — snapExpense',
  description:
    'Start free, no card required. Upgrade when your receipts pile up.',
}

/**
 * `outline-strong` is the Team CTA: a #18181b border rather than the #d4d4d8 of
 * the disabled "Current plan" button. The `Button` primitive has no such
 * variant and belongs to task 00, so this appends `!` overrides instead of
 * editing a file outside this branch's lane. The `!` is not cosmetic —
 * `border-text` and the variant's `border-border-strong` set the same property,
 * and which one wins would otherwise depend on Tailwind's generated CSS order,
 * not on the order they appear in the class string. Flagged in the PR: the
 * right fix is a third `Button` variant.
 *
 * No plan in `PLANS` currently carries this emphasis — Team is held back from
 * launch — so it renders nowhere today. Kept because relaunching Team is meant
 * to be a one-line change to `PLANS`, and deleting this would make it two.
 */
const OUTLINE_STRONG = 'border-text! text-text! hover:bg-surface-recessed'

function PlanCard({ plan }: { plan: Plan }) {
  const { cta } = plan
  const isHighlighted = plan.highlight !== undefined

  return (
    <Card
      radius="panel"
      padding="lg"
      className={cx(
        'flex min-w-[240px] max-w-[320px] flex-1 flex-col gap-[14px]',
        // `relative` so the highlight pill can overlap the top edge. Nothing on
        // this card or the row above it clips, so the pill survives every width.
        isHighlighted && 'relative border-[1.5px]! border-text!',
      )}
    >
      {plan.highlight ? (
        <span className="absolute -top-[11px] left-6 rounded-full bg-text px-[10px] py-[4px] text-[11px] uppercase tracking-[0.04em] text-surface">
          {plan.highlight}
        </span>
      ) : null}

      <div>
        <h2 className="text-[15px] font-semibold text-text">{plan.name}</h2>
        <p className="mt-[3px] text-[13px] text-text-tertiary">{plan.tagline}</p>
      </div>

      <p className="flex items-baseline gap-[6px]">
        <span className="text-[32px] font-bold tracking-[-0.02em] text-text tabular-nums">
          {formatMoneyHeadline(headlineAmountCents(plan))}
        </span>
        <span className="text-[13px] text-text-tertiary">{plan.priceCaption}</span>
      </p>

      <ul className="flex list-none flex-col gap-2 text-[13px] leading-[1.45] text-text-muted">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        {/* A null href means "not actionable in this build". Passing it as
            `disabled` (not as a dead link) gives a real <button disabled>,
            which is already out of the tab order and announced as disabled. */}
        <Button
          variant={cta.emphasis === 'primary' ? 'primary' : 'outline'}
          size="md"
          fullWidth
          href={cta.href ?? undefined}
          disabled={cta.href === null}
          className={cta.emphasis === 'outline-strong' ? OUTLINE_STRONG : undefined}
        >
          {cta.label}
        </Button>
      </div>
    </Card>
  )
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

      {/* Two cards since Team was held back from launch. flex-wrap + min-w 240
          keeps them side by side down to 544px (2×240 + 16px gap = 496px, which
          is exactly the width available once main's px-6 takes 48px) and stacks
          them below that — so the wrap point sits under every common phone
          rather than at the ~900px the three-card row needed. `flex-1` grows
          each card to its max-w 320 and no further, leaving the pair centred
          instead of spanning the full 1080. Depends on border-box, which
          globals.css guarantees. */}
      <div className="mt-8 flex w-full flex-wrap justify-center gap-4">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      <ul className="mt-7 mb-10 flex list-none flex-wrap justify-center gap-x-6 gap-y-2 text-center text-[12px] text-text-tertiary">
        {PRE_CHECKOUT_STATEMENTS.map((statement) => (
          <li key={statement}>{statement}</li>
        ))}
      </ul>
    </main>
    </>
  )
}
