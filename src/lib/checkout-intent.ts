import { availableCycles, getPlan, type BillingCycle, type Plan, type PlanId } from '@/lib/plans'
import { safeNext } from '@/lib/safe-next'

/**
 * "Is this visitor part-way through buying something, and which thing?"
 *
 * `/checkout` bounces signed-out visitors to `/login?next=/checkout?plan=pro`,
 * which is how the intent survives the detour. Until now only the *machinery*
 * read that value — it was round-tripped through `emailRedirectTo` and never
 * shown to anyone. So a person who clicked "Start 14-day trial" arrived at a
 * page headed "Sign in to manage your receipts", with nothing on it
 * acknowledging a purchase was underway, and reasonably concluded the button
 * was broken.
 *
 * This turns that parameter into something the login page can render.
 */

export type CheckoutIntent = {
  planId: PlanId
  plan: Plan
  /** Which price they picked on `/pricing`. */
  cycle: BillingCycle
}

/**
 * The billing cycle a `?billing=` value names, for a given plan.
 *
 * Validated against the plan rather than parsed on its own, because the two can
 * disagree: `?plan=team&billing=yearly` names a cycle Team is not sold on. An
 * unrecognised or unavailable value falls back to the plan's default, which is
 * the same rule `paidPlanIdFromParam` applies to the plan itself — a URL a
 * stranger can hand a victim should never produce a state the product cannot
 * price.
 */
export function billingCycleFromParam(
  planId: PlanId,
  billing: string | null | undefined,
): BillingCycle {
  const plan = getPlan(planId)
  const fallback = plan.pricing.model === 'paid' ? plan.pricing.defaultCycle : 'yearly'
  if (billing !== 'monthly' && billing !== 'yearly') return fallback
  return availableCycles(plan).includes(billing) ? billing : fallback
}

/**
 * The paid plan a `?plan=` value names.
 *
 * Shared with `/checkout` deliberately rather than reimplemented: if the two
 * ever disagreed, the login page would promise one plan and the checkout would
 * charge for another. Anything unrecognised — absent, misspelt, `free` — falls
 * back to Pro, which is what `/checkout` has always done.
 */
export function paidPlanIdFromParam(plan: string | null | undefined): PlanId {
  return plan === 'team' ? 'team' : 'pro'
}

/**
 * Reads a `next` value into a purchase intent, or `null` when it is not one.
 *
 * `safeNext` runs first and its verdict is final. That is not really about
 * open redirects here — nothing in this module navigates anywhere — but the
 * value ends up rendered as a plan name and a price, and it arrives from a URL
 * that anyone can hand a victim. Refusing to interpret anything `safeNext`
 * rejects keeps one reviewed rule in charge of what counts as our own path.
 *
 * The pathname must be exactly `/checkout`. `/checkout/return` is the
 * post-payment page, which nobody signs in on the way to.
 */
export function checkoutIntent(next: string | null | undefined): CheckoutIntent | null {
  const path = safeNext(next ?? null)
  if (!path) return null

  // A base is required for a relative URL and is otherwise unused — `path` has
  // already been proven to be origin-relative, so nothing can escape to it.
  const url = new URL(path, 'http://checkout-intent.invalid')
  if (url.pathname !== '/checkout') return null

  const planId = paidPlanIdFromParam(url.searchParams.get('plan'))
  const cycle = billingCycleFromParam(planId, url.searchParams.get('billing'))
  return { planId, plan: getPlan(planId), cycle }
}
