'use client'

import { useState } from 'react'
import { Button, Card, cx } from '@/components/ui'
import {
  PLANS,
  annualSavingPercent,
  availableCycles,
  checkoutHref,
  formatMoneyHeadline,
  getPlan,
  headlineAmountCents,
  priceCaption,
  type BillingCycle,
  type Plan,
} from '@/lib/plans'

/**
 * The plan cards and the monthly/yearly toggle.
 *
 * Split out of page.tsx because choosing a cycle is client state and the page
 * around it is static — the heading, the pre-checkout statements and the footer
 * have no reason to ship as JavaScript just because a toggle sits between them.
 *
 * The cycle is deliberately **not** in the URL. It is a presentational
 * preference, not a destination: putting it in a query parameter would create
 * two indexable URLs for one page and give `/pricing?billing=monthly` a claim on
 * being canonical. It is carried into the purchase instead, on the CTA, where it
 * does need to survive — see `checkoutHref`.
 */

/**
 * `outline-strong` is the Team CTA: a #18181b border rather than the #d4d4d8 of
 * the disabled "Current plan" button. The `Button` primitive has no such
 * variant, so this appends `!` overrides. The `!` is not cosmetic —
 * `border-text` and the variant's `border-border-strong` set the same property,
 * and which one wins would otherwise depend on Tailwind's generated CSS order.
 *
 * No plan in `PLANS` currently carries this emphasis — Team is held back from
 * launch — so it renders nowhere today. Kept because relaunching Team is meant
 * to be a one-line change to `PLANS`, and deleting this would make it two.
 */
const OUTLINE_STRONG = 'border-text! text-text! hover:bg-surface-recessed'

function PlanCard({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  const { cta } = plan
  const isHighlighted = plan.highlight !== undefined

  // A plan sold on only one cycle (Team is seat-based monthly) keeps showing its
  // own price rather than blanking when the toggle is on the other setting.
  // `headlineAmountCents` falls back to the plan's default cycle for exactly
  // this case, so the toggle never makes a card go empty.
  const sellsThisCycle = availableCycles(plan).includes(cycle)
  const shownCycle = sellsThisCycle ? cycle : undefined

  return (
    <Card
      radius="panel"
      padding="lg"
      className={cx(
        'flex min-w-[240px] max-w-[320px] flex-1 flex-col gap-[14px]',
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
          {formatMoneyHeadline(headlineAmountCents(plan, shownCycle))}
        </span>
        <span className="text-[13px] text-text-tertiary">{priceCaption(plan, shownCycle)}</span>
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
          href={cta.href === null ? undefined : checkoutHref(plan.id, shownCycle)}
          disabled={cta.href === null}
          className={cta.emphasis === 'outline-strong' ? OUTLINE_STRONG : undefined}
        >
          {cta.label}
        </Button>
      </div>
    </Card>
  )
}

/**
 * Two buttons rather than a switch input.
 *
 * A switch says "on or off", and neither cycle is the off state — both are
 * choices. Implemented as a radiogroup so a screen reader announces it as one
 * control with two options and the arrow keys work, which a pair of unrelated
 * buttons would not give you.
 */
function CycleToggle({
  cycle,
  onChange,
  saving,
}: {
  cycle: BillingCycle
  onChange: (next: BillingCycle) => void
  saving: number | null
}) {
  const options: { value: BillingCycle; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ]

  return (
    <div className="mt-7 flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Billing cycle"
        className="inline-flex rounded-full border border-border-strong bg-surface p-[3px]"
      >
        {options.map((option) => {
          const selected = option.value === cycle
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cx(
                'min-h-9 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-colors',
                selected
                  ? 'bg-text text-surface'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {/* Derived from the prices, never typed in — so it cannot advertise a
          discount that the numbers do not actually give. Hidden at 0. */}
      {saving && saving > 0 ? (
        <span className="text-[13px] font-medium text-text-muted">Save {saving}% yearly</span>
      ) : null}
    </div>
  )
}

export default function PlanGrid() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly')
  const saving = annualSavingPercent(getPlan('pro'))

  return (
    <>
      <CycleToggle cycle={cycle} onChange={setCycle} saving={saving} />

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
          <PlanCard key={plan.id} plan={plan} cycle={cycle} />
        ))}
      </div>
    </>
  )
}
