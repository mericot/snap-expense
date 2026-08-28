import type { Subscription } from '@/lib/supabase'

/**
 * Which subscription states count as paid.
 *
 * `past_due` is in here, and that is the whole point of the file.
 *
 * A failed payment used to drop someone to the free tier immediately. Stripe
 * retries a failed invoice over roughly two weeks before giving up and firing
 * `customer.subscription.deleted`, which is the event that actually ends the
 * subscription and is already handled. Cutting access at the first failure —
 * `attempt_count: 1`, which the webhook's own analytics comment calls "usually a
 * card blip" — took the product away from a paying customer a fortnight before
 * Stripe had finished trying to charge them.
 *
 * It also contradicted the checkout route, which has always treated `past_due`
 * as a live subscription and refuses to sell a second one on top of it. The two
 * together left someone with an expired card unable to scan *and* unable to buy
 * their way out: too subscribed to purchase, not subscribed enough to use.
 *
 * The cost of being wrong is asymmetric. Granting access risks a couple of
 * weeks of usage from someone Stripe cancels anyway; withholding it risks
 * churning a customer who fully intended to pay and whose card simply expired.
 *
 * `incomplete` is deliberately absent: that is a first payment that never
 * landed, so there is no established relationship to extend grace to.
 */
const PAID_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due'])

/** Whether this plan and status entitle the account to unlimited scanning. */
export function isPaidPlan(
  plan: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!plan || plan === 'free' || !status) return false
  return PAID_STATUSES.has(status)
}

/**
 * Whether the account is inside the grace period after a failed payment.
 *
 * Separate from `isPaidPlan` on purpose: access continues, but the user needs
 * telling. Grace granted silently only moves the surprise two weeks later.
 */
export function isPaymentFailing(
  plan: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return Boolean(plan) && plan !== 'free' && status === 'past_due'
}

export type SubscriptionLike = Pick<Subscription, 'plan' | 'status'>
