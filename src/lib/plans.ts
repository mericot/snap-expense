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
 * Monthly or yearly. The axis a buyer chooses on `/pricing`.
 *
 * Deliberately not `'month' | 'year'` — those are Stripe's interval values, and
 * keeping our vocabulary distinct stops the two being conflated when a price id
 * is looked up.
 */
export type BillingCycle = 'monthly' | 'yearly'

/**
 * One way of paying for one plan.
 *
 * A plan used to carry exactly one of these inline. It now carries a set,
 * because Pro is sold both monthly and yearly and the yearly price is not
 * simply the monthly one times twelve — that discount is the whole reason
 * anyone picks yearly.
 */
export type PaidPrice = {
  readonly cycle: BillingCycle
  /**
   * What one unit costs for one month **at this cycle**. The quoted headline
   * number. Yearly quotes the discounted monthly equivalent, not the annual
   * total: $7 for yearly Pro, $9 for monthly Pro.
   */
  readonly unitPerMonthCents: Cents
  /** Months covered by a single charge. 12 = billed yearly, 1 = billed monthly. */
  readonly billedEveryMonths: number
  /**
   * The words after the headline amount. Contains no numeral by design — see
   * rule 2 in the module comment.
   */
  readonly caption: string
}

/**
 * How a plan is charged.
 *
 * Modelled as a union rather than "amount + interval" fields so that a real
 * pricing decision does not need a rewrite: a plan that becomes quote-only
 * ("Talk to sales") adds a `{ model: 'quote' }` member, and callers get a type
 * error at exactly the places that have to change.
 */
export type PlanPricing =
  | { readonly model: 'free'; readonly caption: string }
  | {
      readonly model: 'paid'
      /** `account` = one flat subscription; `seat` = multiplied by seat count. */
      readonly unit: 'account' | 'seat'
      /** At least one. Ordered cheapest-per-month first. */
      readonly prices: readonly PaidPrice[]
      /** Preselected on `/pricing`, and used when a caller names no cycle. */
      readonly defaultCycle: BillingCycle
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
  pricing: { model: 'free', caption: 'forever' },
  features: ['10 receipts a month', 'Automatic merchant and total', 'Monthly summary'],
  cta: { label: 'Current plan', href: null, emphasis: 'outline' },
}

const PRO: Plan = {
  id: 'pro',
  name: 'Pro',
  tagline: 'For freelancers and one-person businesses',
  pricing: {
    model: 'paid',
    unit: 'account',
    defaultCycle: 'yearly',
    prices: [
      // $7/month billed yearly. The $84 charged annually is derived, never
      // restated: chargePerCycleCents(pro, 'yearly') === 700 * 12 === 8400.
      { cycle: 'yearly', unitPerMonthCents: 700, billedEveryMonths: 12, caption: 'per month, billed yearly' },
      // $9/month billed monthly. The gap between this and the yearly headline
      // is the discount — 900 * 12 = 10800 against 8400, so yearly saves 22%.
      // If these two are ever set to the same number, yearly stops having a
      // reason to exist; see annualSavingPercent below.
      { cycle: 'monthly', unitPerMonthCents: 900, billedEveryMonths: 1, caption: 'per month, billed monthly' },
    ],
  },
  features: [
    'Unlimited receipts',
    'CSV and Excel export',
    'Custom categories and tax rates',
    'Search across every year',
  ],
  cta: { label: `Start ${TRIAL_DAYS}-day trial`, href: '/checkout?plan=pro', emphasis: 'primary' },
  // Deliberately an opinion, not a usage statistic. The previous copy ("Most
  // people pick this") asserted a distribution of choices that nobody has
  // measured — the product has not launched. "Recommended" says who is
  // speaking and cannot be falsified by the first month's numbers.
  highlight: 'Recommended',
}

/**
 * Withheld from launch. Team is intentionally still defined, still reachable
 * through `getPlan('team')`, and still wired end to end (checkout, webhook,
 * return page, `Subscription.plan`) — it is simply absent from `PLANS`, so
 * `/pricing` never renders it and nothing links to `/checkout?plan=team`.
 *
 * Two independent gates keep it unbuyable, which is why hiding it is not merely
 * cosmetic. It is not listed in `PLANS`, and `/checkout` resolves its price id
 * from `STRIPE_TEAM_MONTHLY_PRICE_ID` — unset in production — then redirects to
 * `/pricing` when that is missing. So a hand-typed `/checkout?plan=team` does
 * not reach a payment form at all. Retiring the price in Stripe would close the
 * path a second time, without a deploy.
 *
 * To relaunch: add TEAM back to `PLANS`, set the price id, and give it a
 * `prices` entry per cycle you intend to sell it on. No type changes and no
 * migration — the database `check (plan in ('free','pro','team'))` already
 * allows it.
 */
const TEAM: Plan = {
  id: 'team',
  name: 'Team',
  tagline: 'When someone else has to approve it',
  pricing: {
    model: 'paid',
    unit: 'seat',
    defaultCycle: 'monthly',
    prices: [
      { cycle: 'monthly', unitPerMonthCents: 1100, billedEveryMonths: 1, caption: 'per person, per month' },
    ],
  },
  features: [
    'Everything in Pro',
    'Shared workspace and approvals',
    'Accountant access, read-only',
    'Data processing agreement on request',
  ],
  cta: { label: 'Add your team', href: '/checkout?plan=team', emphasis: 'outline-strong' },
}

/**
 * Display order on `/pricing`. TEAM is held back from launch — see the comment
 * above it. `BY_ID` below stays complete on purpose: an existing subscription
 * row still has to resolve to a plan even when that plan is not for sale.
 */
export const PLANS: readonly Plan[] = [FREE, PRO]

const BY_ID: Record<PlanId, Plan> = { free: FREE, pro: PRO, team: TEAM }

export function getPlan(id: PlanId): Plan {
  return BY_ID[id]
}

/* -------------------------------------------------------------------------- */
/* Derived amounts                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The price for one cycle, or `null` if the plan is not sold that way.
 *
 * Every function below funnels through this, so "Team has no yearly price" is
 * answered in one place rather than assumed in six.
 *
 * Omitting `cycle` means "whichever this plan leads with" — the reason callers
 * that predate monthly billing (the login page's purchase summary, for
 * instance) keep working without having to thread a cycle they do not know.
 */
export function priceFor(plan: Plan, cycle?: BillingCycle): PaidPrice | null {
  const p = plan.pricing
  if (p.model !== 'paid') return null
  const wanted = cycle ?? p.defaultCycle
  return p.prices.find((price) => price.cycle === wanted) ?? null
}

/** Which cycles a plan can actually be bought on. Empty for free plans. */
export function availableCycles(plan: Plan): readonly BillingCycle[] {
  return plan.pricing.model === 'paid' ? plan.pricing.prices.map((p) => p.cycle) : []
}

/** The words under the headline. Never contains a numeral — see rule 2. */
export function priceCaption(plan: Plan, cycle?: BillingCycle): string {
  if (plan.pricing.model === 'free') return plan.pricing.caption
  return priceFor(plan, cycle)?.caption ?? ''
}

/** The large number on the plan card: what one unit costs for one month. */
export function headlineAmountCents(plan: Plan, cycle?: BillingCycle): Cents {
  return priceFor(plan, cycle)?.unitPerMonthCents ?? 0
}

/**
 * What a single charge comes to, before tax.
 *
 * Pro yearly: 700 × 12 × 1 = 8400 → "$84.00", the figure `/checkout`'s payment
 * terms must disclose. Pro monthly: 900 × 1 × 1 = 900. Team: 1100 × 1 × seats.
 */
export function chargePerCycleCents(plan: Plan, cycle?: BillingCycle, units = 1): Cents {
  const price = priceFor(plan, cycle)
  return price ? price.unitPerMonthCents * price.billedEveryMonths * units : 0
}

/** Months between charges. `null` for plans that are never charged. */
export function billingIntervalMonths(plan: Plan, cycle?: BillingCycle): number | null {
  return priceFor(plan, cycle)?.billedEveryMonths ?? null
}

/**
 * How much yearly saves against paying monthly, as a whole percent. `null` when
 * the plan is not sold both ways.
 *
 * This is what the toggle on `/pricing` advertises, and it is derived rather
 * than typed in — so it cannot drift from the prices, and if someone ever sets
 * the two cycles to the same effective amount it returns 0 and the badge
 * disappears instead of advertising a saving that is not there.
 */
export function annualSavingPercent(plan: Plan): number | null {
  const yearly = priceFor(plan, 'yearly')
  const monthly = priceFor(plan, 'monthly')
  if (!yearly || !monthly) return null

  const yearlyTotal = yearly.unitPerMonthCents * yearly.billedEveryMonths
  const monthlyTotal = monthly.unitPerMonthCents * 12
  if (monthlyTotal <= 0 || yearlyTotal >= monthlyTotal) return 0

  return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100)
}

/**
 * Where a plan's CTA points, carrying the chosen cycle.
 *
 * `/checkout` and the login page both read this back through
 * lib/checkout-intent.ts, so the parameter name is defined once here rather
 * than spelled out at each call site.
 */
export function checkoutHref(planId: PlanId, cycle?: BillingCycle): string {
  const plan = getPlan(planId)
  const resolved = cycle ?? (plan.pricing.model === 'paid' ? plan.pricing.defaultCycle : null)
  return resolved ? `/checkout?plan=${planId}&billing=${resolved}` : `/checkout?plan=${planId}`
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
