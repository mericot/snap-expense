'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button, Card, Input, Label, cx } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/app/receipts/AppHeader'
import {
  ILLUSTRATIVE_TAX_RATE,
  REFUND_WINDOW_DAYS,
  TRIAL_DAYS,
  billingCadenceLabel,
  billingIntervalMonths,
  chargePerCycleCents,
  chargePeriodLabel,
  formatMoney,
  getPlan,
  illustrativeTaxCents,
  type Cents,
  type PlanId,
} from '@/lib/plans'

/**
 * The interactive half of `/checkout`.
 *
 * This is a client component because the sales-tax line has to recompute when
 * the ZIP code changes, and the ZIP input and the summary card sit in different
 * columns — the client boundary has to enclose both. Everything that can be
 * resolved once per request (the session email, the first-charge date) is
 * resolved in `page.tsx` and passed in, so nothing here depends on the clock or
 * on a post-hydration fetch.
 *
 * Two rules govern this file:
 *
 *   1. **No amount is ever written as a literal.** Every figure comes from
 *      `@/lib/plans`. Grep this file for `84`, `7.46`, `91.46` or `8.875` and
 *      you will not find them.
 *   2. **No control here can accept a card number.** See `CardFieldsPlaceholder`.
 */

/* -------------------------------------------------------------------------- */
/* Sales tax — PLACEHOLDER, NOT A TAX ENGINE                                  */
/* -------------------------------------------------------------------------- */

/**
 * ⚠ THIS IS NOT A TAX CALCULATION AND MUST NOT SHIP AS ONE.
 *
 * US sales tax is destination-based and levied by state (plus county, city and
 * special districts), and SaaS is taxable in some states, partly taxable in
 * others and untaxed in many. There are ~11,000 taxing jurisdictions and no
 * national rate. Deriving one from a ZIP prefix in a page component is not
 * something that can be made correct by adding more prefixes.
 *
 * What this function is for: `plans.ts` exports one illustrative rate (the NYC
 * combined rate) so the design has a concrete number to render, and the spec
 * requires the component to handle all three outcomes a real engine produces —
 * not yet computed, computed as zero, computed as non-zero. This stub produces
 * all three from the ZIP shape so the states are reachable and reviewable:
 *
 *   - fewer than 5 digits  → `pending`  (nothing computed yet)
 *   - an NYC ZIP prefix    → non-zero   (the illustrative 8.875%)
 *   - any other valid ZIP  → zero
 *
 * The zero branch is where the dishonesty would live if this shipped: a Texas
 * or Massachusetts customer would be shown $0.00 for a product their state does
 * tax. The UI therefore labels the figure an estimate, and the payment terms
 * deliberately say "plus applicable sales tax" rather than naming a rate, so
 * the binding disclosure stays true either way.
 *
 * Replace wholesale with a tax engine (Stripe Tax, Avalara, TaxJar) keyed on
 * the full address, called server-side, before this page can take money.
 */
const ILLUSTRATIVE_TAXED_ZIP3 = new Set(['100', '101', '102', '103', '104'])

/** 5-digit ZIP or ZIP+4. */
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/

type TaxEstimate =
  /** No usable ZIP yet, so no tax has been computed. Not the same as zero. */
  | { readonly status: 'pending' }
  /** A rate was determined. `rate` may legitimately be 0 in an untaxed state. */
  | { readonly status: 'computed'; readonly rate: number; readonly cents: Cents }

function estimateSalesTax(zip: string, amountCents: Cents): TaxEstimate {
  const trimmed = zip.trim()
  if (!ZIP_PATTERN.test(trimmed)) return { status: 'pending' }

  if (!ILLUSTRATIVE_TAXED_ZIP3.has(trimmed.slice(0, 3))) {
    return { status: 'computed', rate: 0, cents: 0 }
  }
  return {
    status: 'computed',
    rate: ILLUSTRATIVE_TAX_RATE,
    cents: illustrativeTaxCents(amountCents),
  }
}

/** "8.875%" — three decimals, because the illustrative rate needs all of them. */
const PERCENT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 3,
})

/* -------------------------------------------------------------------------- */
/* Field chrome                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The box that `Input` draws, as a bare class string.
 *
 * Duplicated from `src/components/ui/Input.tsx` because task 00's primitives
 * cover `<input>` only — there is no `Select`, and the card placeholder is
 * deliberately not an input at all. Both still have to line up with the real
 * fields to the pixel. Flagged in the PR: a `Select` primitive (and a shared
 * field-box class) belongs in task 00's lane, not here.
 */
const FIELD_BOX = cx(
  'block w-full rounded-lg border border-border bg-surface',
  'px-[13px] py-[11px] text-[14px]',
  'min-h-11 sm:min-h-0',
)

const FIELD_IDS = {
  email: 'checkout-email',
  country: 'checkout-country',
  zip: 'checkout-zip',
  zipHint: 'checkout-zip-hint',
  cardLegend: 'checkout-card-legend',
  cardNote: 'checkout-card-note',
  submitNote: 'checkout-submit-note',
} as const

/* -------------------------------------------------------------------------- */
/* Card fields — a placeholder, and only a placeholder                        */
/* -------------------------------------------------------------------------- */

/**
 * ⚠ DO NOT TURN THESE INTO `<input>` ELEMENTS.
 *
 * In production the card number, expiry and CVC are fields hosted by the
 * payment provider (Stripe Elements or equivalent) inside a cross-origin
 * iframe. The card number never reaches our JavaScript, our server or our logs,
 * which is what keeps us in the reduced PCI-DSS scope — and it is what both the
 * footer and this page's own payment terms promise the customer in writing.
 *
 * There is no payment provider wired up on this branch, so these are inert
 * `<div>`s at the dimensions the real fields will occupy. They have no `value`,
 * no `name`, no keyboard entry and no way into a form submission. A visitor
 * cannot type a card number here, so there is no card number to mishandle.
 *
 * The group is exposed to assistive technology as a labelled group with a
 * description explaining it is not active, rather than hidden — a silently
 * skipped block would be more confusing than an honest one.
 */
function CardFieldsPlaceholder() {
  const box = cx(FIELD_BOX, 'select-none text-text-placeholder')

  return (
    <fieldset className="w-full min-w-0">
      <legend id={FIELD_IDS.cardLegend} className="mb-[6px] text-[13px] text-text-title">
        Card details
      </legend>
      <div
        role="group"
        aria-labelledby={FIELD_IDS.cardLegend}
        aria-describedby={FIELD_IDS.cardNote}
        className="flex flex-col gap-[6px]"
      >
        <div className={box}>Card number</div>
        <div className="flex gap-[10px]">
          <div className={cx(box, 'flex-1')}>MM / YY</div>
          <div className={cx(box, 'flex-1')}>CVC</div>
        </div>
      </div>
      <p id={FIELD_IDS.cardNote} className="mt-[6px] text-[12px] leading-[1.5] text-text-tertiary">
        Placeholder. The secure card fields are hosted by our payment processor and are not
        connected yet, so nothing can be entered here.
      </p>
    </fieldset>
  )
}

/* -------------------------------------------------------------------------- */
/* Summary card                                                               */
/* -------------------------------------------------------------------------- */

function SummaryRow({
  label,
  value,
  numeric = true,
}: {
  label: string
  value: string
  /** False for a status word standing in for an amount, which must not be aligned as one. */
  numeric?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className={numeric ? 'tabular-nums' : 'text-text-tertiary'}>{value}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page body                                                                  */
/* -------------------------------------------------------------------------- */

export type CheckoutFormProps = {
  /** Which plan this checkout creates. Chosen by the route, not by this component. */
  planId: PlanId
  /** From the server session. Empty string only if the session carries no email. */
  email: string
  /**
   * Trial end / first charge date, already formatted US-convention on the
   * server ("March 19, 2026"). Passed as a string rather than a `Date` so the
   * server and client cannot disagree about the day.
   */
  firstChargeOn: string
}

export default function CheckoutForm({ planId, email, firstChargeOn }: CheckoutFormProps) {
  const [zip, setZip] = useState('')

  const plan = getPlan(planId)
  const months = billingIntervalMonths(plan)

  // Unreachable while the route selects `pro`. If a free/quote plan is ever
  // routed here, failing loudly beats rendering payment terms with a blank
  // amount — the terms are a binding disclosure and a wrong one is worse than
  // an error page.
  if (months === null) {
    throw new Error(`/checkout was given a plan with no billing interval: ${plan.id}`)
  }

  const chargeCents = chargePerCycleCents(plan)
  const tax = estimateSalesTax(zip, chargeCents)

  // $0.00 today is a fact about the trial, not a price: nothing is charged
  // until it ends. Formatted through the same helper so the currency and the
  // decimal convention stay consistent with every other amount on the page.
  const nothing = formatMoney(0)

  const zipInvalid = zip.trim().length > 0 && !ZIP_PATTERN.test(zip.trim())

  return (
    <>
      <AppHeader
        email={email}
        onSignOut={async () => {
          await supabase.auth.signOut()
          window.location.href = '/login'
        }}
      />

    <main className="flex flex-1 flex-wrap content-start justify-center gap-8 px-6 py-10">
      {/* Left column — the form. */}
      <form
        // Nothing to submit: there is no billing backend and the button is
        // disabled. This guards the implicit submit that Enter in a text field
        // would otherwise trigger.
        onSubmit={(event) => event.preventDefault()}
        className="flex w-full min-w-[min(300px,100%)] max-w-[420px] flex-1 flex-col gap-5"
      >
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            Set up your subscription
          </h1>
          <p className="mt-[6px] text-[13px] leading-[1.5] text-text-tertiary">
            Your card is not charged today. We will email you three days before the trial
            ends.
          </p>
        </div>

        <div className="flex flex-col gap-[14px]">
          <div className="flex flex-col gap-[6px]">
            <Label htmlFor={FIELD_IDS.email} size="sm">
              Email
            </Label>
            {/* Prefilled from the session, but editable: the address that
                should receive receipts is not always the one used to sign in. */}
            <Input
              id={FIELD_IDS.email}
              type="email"
              name="email"
              autoComplete="email"
              defaultValue={email}
              placeholder="you@example.com"
            />
          </div>

          <CardFieldsPlaceholder />

          <fieldset className="w-full min-w-0">
            <legend className="mb-[6px] text-[13px] text-text-title">
              Country and ZIP code
            </legend>
            <div className="flex gap-[10px]">
              {/* Each control needs its own accessible name; the legend names
                  the pair, these name the parts. */}
              <Label htmlFor={FIELD_IDS.country} size="sm" className="sr-only">
                Country
              </Label>
              <select
                id={FIELD_IDS.country}
                name="country"
                autoComplete="country"
                defaultValue="US"
                className={cx(FIELD_BOX, 'flex-1 text-text-muted')}
              >
                <option value="US">United States</option>
              </select>

              <Label htmlFor={FIELD_IDS.zip} size="sm" className="sr-only">
                ZIP code
              </Label>
              <Input
                id={FIELD_IDS.zip}
                type="text"
                name="postal-code"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={10}
                required
                aria-required="true"
                aria-invalid={zipInvalid || undefined}
                aria-describedby={zipInvalid ? FIELD_IDS.zipHint : undefined}
                placeholder="ZIP code"
                value={zip}
                onChange={(event) => setZip(event.target.value)}
                className="flex-1"
              />
            </div>
            {/* Status is carried by the words, not by a colour. */}
            {zipInvalid ? (
              <p id={FIELD_IDS.zipHint} className="mt-[6px] text-[12px] text-text-tertiary">
                Enter a 5-digit ZIP code so sales tax can be calculated.
              </p>
            ) : null}
          </fieldset>
        </div>

        <div>
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled
            aria-describedby={FIELD_IDS.submitNote}
          >
            Start trial
          </Button>
          {/* A disabled control is out of the tab order, so the reason has to
              be adjacent text rather than a title or tooltip. */}
          <p id={FIELD_IDS.submitNote} className="mt-[6px] text-[12px] text-text-tertiary">
            Not available yet — subscriptions cannot be started until payments are
            connected.
          </p>
        </div>

        {/*
          PAYMENT TERMS — BINDING PRE-CONTRACT DISCLOSURE.

          Verbatim from design_handoff_snapexpense_paid/README.md §5, character
          for character, with four values interpolated: the charge, the first
          charge date, the billing interval in months, and the refund window.
          Every one of them comes from `plans.ts` or from the server-computed
          trial end.

          Do not paraphrase it, do not reorder it, and do not move it behind a
          link, a toggle or a tooltip. It must be visible at the point of
          consent: US automatic-renewal statutes (California's ARL sets the bar,
          New York and Illinois follow) and the card network rules all require
          the renewal amount, the renewal date and the cancellation method to be
          disclosed clearly and conspicuously *before* consent.

          "plus applicable sales tax" names no rate on purpose — it has to stay
          true for a customer in a state where the product is untaxed.
        */}
        <p className="text-[12px] leading-[1.6] text-text-tertiary">
          By starting the trial you agree to the{' '}
          <Link href="/legal/terms" className="underline">
            Terms of Service
          </Link>{' '}
          and authorize snapExpense to charge {formatMoney(chargeCents)} plus applicable
          sales tax on {firstChargeOn}, and every {months} months after that, until you
          cancel. Cancel any time from Settings and the plan runs to the end of the paid
          period. Full refund within {REFUND_WINDOW_DAYS} days of a charge — see the{' '}
          <Link href="/legal/refunds" className="underline">
            refund policy
          </Link>
          . Card details are handled by our payment processor; we never see or store your
          card number.
        </p>
      </form>

      {/* Right column — order summary. `bg-surface-sunken!` because Card's own
          `bg-surface` sets the same property; without the override which one
          wins depends on Tailwind's generated CSS order rather than on the
          order in this class string. Same reasoning as task 04's PlanCard. */}
      <Card
        radius="panel"
        padding="md"
        aria-label="Order summary"
        className="flex w-full min-w-[min(260px,100%)] max-w-[340px] flex-1 flex-col gap-[14px] self-start bg-surface-sunken!"
      >
        <h2 className="text-[14px] font-semibold text-text">
          snapExpense {plan.name}, {billingCadenceLabel(months)}
        </h2>

        <div className="flex flex-col gap-2 text-[13px] text-text-muted">
          <SummaryRow label={`${TRIAL_DAYS}-day trial`} value={nothing} />
          <SummaryRow label={`Then ${chargePeriodLabel(months)}`} value={formatMoney(chargeCents)} />

          {/* Three outcomes, all reachable:
              pending  — no usable ZIP, so no figure is claimed at all;
              zero     — a rate was determined and it is 0 (untaxed state);
              non-zero — the rate is named next to the amount it produced. */}
          {tax.status === 'pending' ? (
            <SummaryRow label="Sales tax" value="Enter ZIP code" numeric={false} />
          ) : tax.rate === 0 ? (
            <SummaryRow label="Sales tax" value={formatMoney(0)} />
          ) : (
            <SummaryRow
              label={`Sales tax (${PERCENT.format(tax.rate)})`}
              value={formatMoney(tax.cents)}
            />
          )}
        </div>

        <div className="flex justify-between border-t border-border pt-3 text-[14px] font-semibold text-text">
          <span>Due today</span>
          <span className="tabular-nums">{nothing}</span>
        </div>

        <div className="border-t border-border pt-3 text-[12px] leading-[1.5] text-text-tertiary">
          {/* With no tax figure yet, the total is not knowable — so it is not
              stated. The wording falls back to the same phrase the payment
              terms use rather than quietly implying tax is zero. */}
          <p>
            {tax.status === 'computed'
              ? `Due ${firstChargeOn}: ${formatMoney(chargeCents + tax.cents)}. We will remind you first.`
              : `Due ${firstChargeOn}: ${formatMoney(chargeCents)} plus applicable sales tax. We will remind you first.`}
          </p>
          {/* New copy, not in the handoff — added because the rate above is an
              illustrative placeholder rather than a computed one. Needs sign-off
              with the real tax engine; see the PR. */}
          {tax.status === 'computed' ? (
            <p className="mt-[6px]">
              Sales tax is estimated from your ZIP code and confirmed when the charge is
              made.
            </p>
          ) : null}
        </div>
      </Card>
    </main>
    </>
  )
}
