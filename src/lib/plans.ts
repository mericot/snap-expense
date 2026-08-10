/**
 * Single source of truth for pricing across `/pricing` (task 04) and `/checkout`
 * (task 05).
 *
 * ⚠ THE PRICES BELOW ARE NOT RATIFIED. The design handoff states the commercial
 * model is a recommendation the client has not approved, and the USD figures are
 * *numeral parity* with the original EU draw (€7 → $7), not an FX conversion.
 * They still need a real pricing decision.
 *
 * The whole point of this module is that the decision, when it lands, is one
 * edit here. Two rules keep that true:
 *
 *   1. Amounts live here as integer cents, once. Nothing downstream restates a
 *      number — `/checkout`'s "$84.00" is `chargePerCycleCents(pro)`, derived
 *      from $7 × 12, not a second literal that can drift.
 *   2. Copy stored here carries **no numerals**. `priceCaption` is
 *      "per month, billed yearly", never "$7 per month…". Every digit that
 *      reaches a screen is formatted from `pricing`.
 *
 * Currency is USD / US market (decided). Sales tax is deliberately NOT modelled
 * as a plan property — Stripe Tax computes it at checkout; see the note at the
 * bottom of this file.
 */

export const CURRENCY = 'USD'
const LOCALE = 'en-US'

/** An integer number of cents. All arithmetic in this module stays in cents. */
export type Cents = number

export type PlanId = 'free' | 'pro' | 'team'

/**
 * How a plan is charged.
 *
 * Modelled as a union rather than "amount + interval" fields so that a real
 * pricing decision does not need a rewrite: a plan that becomes quote-only
 * ("Talk to sales") adds a `{ model: 'quote' }` member, and callers get a type
 * error at exactly the places that have to change.
 */
export type PlanPricing =
  | { readonly model: 'free' }
  | {
      readonly model: 'paid'
      /** What one unit costs for one month. This is the quoted headline number. */
      readonly unitPerMonthCents: Cents
      /** Months covered by a single charge. 12 = billed yearly, 1 = billed monthly. */
      readonly billedEveryMonths: number
      /** `account` = one flat subscription; `seat` = multiplied by seat count. */
      readonly unit: 'account' | 'seat'
    }

export type PlanCta = {
  readonly label: string
  /**
   * Destination, or `null` when the CTA is deliberately not actionable in this
   * build. Free is `null` because there is no subscription state to read yet —
   * "Current plan" is an unconditional claim, not a fact we have checked.
   */
  readonly href: string | null
  /** Design intent. The page maps this onto the `Button` primitive's variants. */
  readonly emphasis: 'primary' | 'outline' | 'outline-strong'
}

export type Plan = {
  readonly id: PlanId
  readonly name: string
  /** One line under the plan name. Verbatim from the handoff. */
  readonly tagline: string
  readonly pricing: PlanPricing
  /**
   * The words after the headline amount. Contains no numeral by design — see
   * rule 2 in the module comment.
   */
  readonly priceCaption: string
  readonly features: readonly string[]
  readonly cta: PlanCta
  /** Pill overlapping the card's top edge. At most one plan should carry it. */
  readonly highlight?: string
}

/**
 * Length of the free trial, in days.
 *
 * Distinct from `REFUND_WINDOW_DAYS` despite both currently being 14 — one is
 * how long you use the product before the first charge, the other is how long
 * after a charge you can get it back. Do not collapse them into one constant.
 */
export const TRIAL_DAYS = 14

/**
 * Refund window after a charge, in days.
 *
 * A **policy choice, not a statutory right**. The EU's 14-day withdrawal period
 * does not apply to a US entity selling to US customers. Never describe this
 * anywhere in the product as a legal requirement.
 */
export const REFUND_WINDOW_DAYS = 14

const FREE: Plan = {
  id: 'free',
  name: 'Free',
  tagline: 'For the occasional receipt',
  pricing: { model: 'free' },
  priceCaption: 'forever',
  features: ['10 receipts a month', 'Automatic merchant and total', 'Monthly summary'],
  cta: { label: 'Current plan', href: null, emphasis: 'outline' },
}

const PRO: Plan = {
  id: 'pro',
  name: 'Pro',
  tagline: 'For freelancers and one-person businesses',
  // $7/month billed yearly. The $84 charged annually is derived, never restated:
  // chargePerCycleCents(pro) === 700 * 12 === 8400.
  pricing: { model: 'paid', unitPerMonthCents: 700, billedEveryMonths: 12, unit: 'account' },
  priceCaption: 'per month, billed yearly',
  features: [
    'Unlimited receipts',
    'CSV and Excel export',
    'Custom categories and tax rates',
    'Search across every year',
  ],
  cta: { label: `Start ${TRIAL_DAYS}-day trial`, href: '/checkout?plan=pro', emphasis: 'primary' },
  highlight: 'Most people pick this',
}

const TEAM: Plan = {
  id: 'team',
  name: 'Team',
  tagline: 'When someone else has to approve it',
  pricing: { model: 'paid', unitPerMonthCents: 1100, billedEveryMonths: 1, unit: 'seat' },
  priceCaption: 'per person, per month',
  features: [
    'Everything in Pro',
    'Shared workspace and approvals',
    'Accountant access, read-only',
    'Data processing agreement on request',
  ],
  cta: { label: 'Add your team', href: '/checkout?plan=team', emphasis: 'outline-strong' },
}

/** Display order on `/pricing`. */
export const PLANS: readonly Plan[] = [FREE, PRO, TEAM]

const BY_ID: Record<PlanId, Plan> = { free: FREE, pro: PRO, team: TEAM }

export function getPlan(id: PlanId): Plan {
  return BY_ID[id]
}

/* -------------------------------------------------------------------------- */
/* Derived amounts                                                            */
/* -------------------------------------------------------------------------- */

/** The large number on the plan card: what one unit costs for one month. */
export function headlineAmountCents(plan: Plan): Cents {
  return plan.pricing.model === 'paid' ? plan.pricing.unitPerMonthCents : 0
}

/**
 * What a single charge comes to, before tax.
 *
 * Pro: 700 × 12 × 1 = 8400 → "$84.00", the figure `/checkout`'s payment terms
 * must disclose. Team: 1100 × 1 × seats.
 */
export function chargePerCycleCents(plan: Plan, units = 1): Cents {
  const p = plan.pricing
  return p.model === 'paid' ? p.unitPerMonthCents * p.billedEveryMonths * units : 0
}

/** Months between charges. `null` for plans that are never charged. */
export function billingIntervalMonths(plan: Plan): number | null {
  return plan.pricing.model === 'paid' ? plan.pricing.billedEveryMonths : null
}

/** Adjective form: "snapExpense Pro, **yearly**". */
export function billingCadenceLabel(months: number): string {
  if (months === 1) return 'monthly'
  if (months === 12) return 'yearly'
  return `every ${months} months`
}

/** Prepositional form: "Then **per year** $84.00". */
export function chargePeriodLabel(months: number): string {
  if (months === 1) return 'per month'
  if (months === 12) return 'per year'
  return `every ${months} months`
}

/** Trial end / first charge date. Keeps `TRIAL_DAYS` from being retyped in 05. */
export function trialEndsOn(start: Date): Date {
  const end = new Date(start)
  end.setDate(end.getDate() + TRIAL_DAYS)
  return end
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

const MONEY = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY })
const MONEY_WHOLE = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
})

/** Always two decimals: "$84.00". Use for anything transactional or legal. */
export function formatMoney(cents: Cents): string {
  return MONEY.format(cents / 100)
}

/**
 * Drops `.00` on whole dollars: "$7", but "$7.50" if a future price is not
 * round. Marketing headline only — never use for an amount being charged.
 */
export function formatMoneyHeadline(cents: Cents): string {
  return (cents % 100 === 0 ? MONEY_WHOLE : MONEY).format(cents / 100)
}

/* -------------------------------------------------------------------------- */
/* Pre-checkout statements                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Shown under the plan cards. Reviewed with the client — reproduce verbatim.
 * The refund line is templated only so the number tracks
 * `REFUND_WINDOW_DAYS`; it renders character for character as the handoff copy.
 *
 * "where applicable" is load-bearing: SaaS is not taxable in every US state, so
 * two customers on the same plan can legitimately see different totals. Do not
 * trim it.
 */
export const PRE_CHECKOUT_STATEMENTS: readonly string[] = [
  'Prices exclude sales tax, added at checkout where applicable',
  'Cancel any time, keeps working until the period ends',
  `${REFUND_WINDOW_DAYS} days to change your mind, full refund`,
]

/* -------------------------------------------------------------------------- */
/* Sales tax                                                                  */
/* -------------------------------------------------------------------------- */

/*
 * Sales tax is no longer modelled here, and deliberately so.
 *
 * This module used to export `ILLUSTRATIVE_TAX_RATE` — New York City's combined
 * rate — plus a helper that applied it, so the old hand-built checkout had a
 * concrete number to render. Both are gone, along with the component that used
 * them (`CheckoutForm.tsx`, which was dead code by the time it was removed: the
 * live page renders Stripe's embedded checkout, so that rate had not reached a
 * customer in some time).
 *
 * Tax is now computed by Stripe Tax, enabled on the session in
 * /api/stripe/checkout, from the billing address the buyer enters. That is the
 * only way to get it right: US sales tax is destination-based, SaaS is untaxed
 * in many states, and there is therefore no correct constant to keep in a file.
 *
 * Do not reintroduce a rate here. A hardcoded percentage is wrong for almost
 * every customer, and being visibly plausible is what makes it dangerous.
 */
