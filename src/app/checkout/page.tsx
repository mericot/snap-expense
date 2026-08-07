import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CheckoutForm from './CheckoutForm'
import { trialEndsOn, type PlanId } from '@/lib/plans'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * `/checkout` — set up the subscription and start the trial. Authenticated.
 *
 * This file is the server half: it resolves everything that must be decided
 * once, on the server, before anything renders — who the visitor is, which plan
 * is being bought, and what date the first charge falls on. The interactive
 * half lives in `./CheckoutForm` because the sales-tax line recomputes as the
 * ZIP is typed.
 *
 * Splitting the route across two files is a deliberate deviation from "task 05
 * owns page.tsx" — flagged in the PR. Three things need the server: the session
 * email (prefilling after hydration would flash an empty field on a payment
 * page), the route `metadata`, which a `'use client'` module cannot export, and
 * the first-charge date, which must not be computed twice. The new file sits
 * inside `/checkout`, which no other branch touches.
 */

export const metadata: Metadata = {
  title: 'Checkout — snapExpense',
  description: 'Set up your snapExpense subscription and start your free trial.',
  // Authenticated page behind a redirect; nothing here belongs in an index.
  robots: { index: false, follow: false },
}

/**
 * The plan this route sells.
 *
 * Hard-wired, because there is no cart and no subscription state. Note that
 * `/pricing`'s Team CTA also points at `/checkout`, so a visitor who picks Team
 * currently lands on a Pro checkout. Resolving that needs a product decision
 * (a `?plan=` parameter, a seat count, and per-seat summary copy), not a
 * default chosen here — raised in the PR.
 */
const PLAN_ID: PlanId = 'pro'

/**
 * US convention, month-first and spelled out: "March 19, 2026".
 *
 * Formatted on the server so the payment terms and the summary card cannot
 * disagree with each other, or with themselves across a hydration boundary.
 */
const CHARGE_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export default async function CheckoutPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // `src/proxy.ts` already gates this route. Repeated here so the page is not
  // one matcher edit away from rendering payment terms to an anonymous visitor,
  // and so `user.email` below is not read off a null.
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/checkout')}`)
  }

  // No subscription record exists yet, so the trial starts now. When billing is
  // real this must be the trial start the provider actually recorded — the date
  // in the payment terms has to match the date the customer is charged.
  const firstChargeOn = CHARGE_DATE.format(trialEndsOn(new Date()))

  return (
    <CheckoutForm planId={PLAN_ID} email={user.email ?? ''} firstChargeOn={firstChargeOn} />
  )
}
