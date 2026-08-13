import { availableCycles, getPlan, type BillingCycle, type PlanId } from '@/lib/plans'

/**
 * Which Stripe price backs which plan and cycle.
 *
 * **Server only.** It reads unprefixed environment variables, so importing it
 * from a client component would resolve them to `undefined` rather than fail —
 * a silent wrong answer, which is the worst kind. `/pricing` reads it in the
 * server component and passes the result down as a prop.
 *
 * This lived inline in `/checkout` until `/pricing` needed the same answer to
 * decide which cycles to offer. Two copies would have drifted, and the way they
 * would have drifted is a toggle advertising a cycle checkout cannot sell.
 */

export function priceIdFor(planId: PlanId, cycle: BillingCycle): string | undefined {
  if (planId === 'pro') {
    return cycle === 'monthly'
      ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
      : process.env.STRIPE_PRO_YEARLY_PRICE_ID
  }
  // Team is seat-based monthly only, and unset in production — which is the
  // second gate holding it back from sale. See PLANS in lib/plans.ts.
  if (planId === 'team') return process.env.STRIPE_TEAM_MONTHLY_PRICE_ID
  return undefined
}

/**
 * The cycles a plan can actually be bought on *in this deployment* — the
 * intersection of what the plan advertises and what has a configured price id.
 *
 * The distinction matters. `availableCycles` answers "how is this plan sold",
 * which is a product decision baked into the code. This answers "what can this
 * particular environment take money for", which depends on configuration and
 * can therefore be wrong.
 *
 * It exists because of a real bug: monthly Pro was added to the pricing page
 * before `STRIPE_PRO_MONTHLY_PRICE_ID` was set, so the toggle offered Monthly,
 * the CTA pointed at `/checkout?plan=pro&billing=monthly`, and `/checkout`
 * found no price id and bounced back to `/pricing`. To anyone clicking it, the
 * page simply refreshed and never reached Stripe — with nothing logged and no
 * error shown, because a missing price id is also exactly how a deliberately
 * withheld plan is switched off.
 *
 * Offering only what is purchasable makes that dead button unreachable rather
 * than merely diagnosable.
 */
export function purchasableCycles(planId: PlanId): BillingCycle[] {
  return availableCycles(getPlan(planId)).filter((cycle) => Boolean(priceIdFor(planId, cycle)))
}
