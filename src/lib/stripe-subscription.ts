import type Stripe from 'stripe'

/**
 * Shared readers for the two places that write Stripe subscription state into
 * Supabase: the webhook (`/api/stripe/webhook`) and the user-initiated
 * cancel/resume route (`/api/stripe/subscription`).
 *
 * They have to agree. Both write the same columns for the same subscription,
 * often seconds apart, so a difference in how either one reads the period end
 * shows up as a row that flips between two dates depending on which wrote last.
 */

export function epochToISO(epoch: number | null): string | null {
  return epoch ? new Date(epoch * 1000).toISOString() : null
}

/**
 * The current period end lives on the subscription *item*, not the
 * subscription. Reading `subscription.current_period_end` is the obvious thing
 * and it is `undefined` on this API version.
 */
export function itemPeriodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end ?? null
}
