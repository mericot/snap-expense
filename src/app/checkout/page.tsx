import type { Metadata } from 'next'
import { isPaidPlan } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import CheckoutEmbed from './CheckoutEmbed'
import {
  PLANS,
  billingCadenceLabel,
  billingIntervalMonths,
  getPlan,
  type PlanId,
} from '@/lib/plans'
import { billingCycleFromParam, paidPlanIdFromParam } from '@/lib/checkout-intent'
import { priceIdFor } from '@/lib/stripe-prices'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Set up your snapExpense subscription and start your free trial.',
  robots: { index: false, follow: false },
}

/**
 * A missing price id means one of two very different things, and until now they
 * were indistinguishable: either the plan is deliberately withheld from sale
 * (Team, whose price id is unset in production on purpose), or the deployment is
 * misconfigured and a plan people can see cannot actually be bought.
 *
 * Both still redirect to `/pricing` — bouncing is the safe outcome either way.
 * The difference is that the second one now says so in the logs, because it is
 * a bug and it presents to the user as the page mysteriously refreshing.
 */
function isWithheldFromSale(planId: PlanId): boolean {
  return !PLANS.some((plan) => plan.id === planId)
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string }>
}) {
  const { plan, billing } = await searchParams

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // The cycle rides along with the plan. Dropping it here would sign someone
    // in and then quote them the other price on the way back — the same class
    // of bug as dropping `next` entirely, which c0eaf6b fixed.
    const params = new URLSearchParams()
    if (plan) params.set('plan', plan)
    if (billing) params.set('billing', billing)
    const query = params.toString()
    redirect(`/login?next=${encodeURIComponent(query ? `/checkout?${query}` : '/checkout')}`)
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  if (
    isPaidPlan(sub?.plan, sub?.status)
  ) {
    redirect('/receipts')
  }
  // Shared with the login page rather than repeated here. The two read the
  // same `?plan=` — one to name the plan on the sign-in detour, the other to
  // price it — and a copy that drifted would show one plan and charge for
  // another.
  const planId: PlanId = paidPlanIdFromParam(plan)
  const cycle = billingCycleFromParam(planId, billing)
  const priceId = priceIdFor(planId, cycle)

  if (!priceId) {
    if (!isWithheldFromSale(planId)) {
      console.error(
        `[/checkout] ${planId} is listed on /pricing but has no Stripe price id for its ${cycle} cycle. ` +
          `Set STRIPE_${planId.toUpperCase()}_${cycle === 'monthly' ? 'MONTHLY' : 'YEARLY'}_PRICE_ID. ` +
          'Until then this redirects to /pricing, which looks to the buyer like the page refreshing.',
      )
    }
    redirect('/pricing')
  }

  const planData = getPlan(planId)

  return (
    <CheckoutEmbed
      planName={planData.name}
      priceId={priceId}
      cadence={billingCadenceLabel(billingIntervalMonths(planData, cycle) ?? 1)}
    />
  )
}
