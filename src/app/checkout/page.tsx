import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CheckoutEmbed from './CheckoutEmbed'
import {
  billingCadenceLabel,
  billingIntervalMonths,
  getPlan,
  type BillingCycle,
  type PlanId,
} from '@/lib/plans'
import { billingCycleFromParam, paidPlanIdFromParam } from '@/lib/checkout-intent'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Set up your snapExpense subscription and start your free trial.',
  robots: { index: false, follow: false },
}

/**
 * The Stripe price for a plan on a given cycle.
 *
 * Returning `undefined` is how a plan is switched off: the page redirects to
 * `/pricing` when there is no id. That is the second of the two gates keeping
 * hidden Team unreachable — leaving `STRIPE_TEAM_MONTHLY_PRICE_ID` unset in
 * production makes `/checkout?plan=team` bounce, whatever anyone types.
 */
function priceIdFor(planId: PlanId, cycle: BillingCycle): string | undefined {
  if (planId === 'pro') {
    return cycle === 'monthly'
      ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
      : process.env.STRIPE_PRO_YEARLY_PRICE_ID
  }
  // Team is seat-based monthly only; billingCycleFromParam already collapses
  // any other request to its default, so there is one price to return.
  if (planId === 'team') return process.env.STRIPE_TEAM_MONTHLY_PRICE_ID
  return undefined
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
    sub &&
    sub.plan !== 'free' &&
    (sub.status === 'active' || sub.status === 'trialing')
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
