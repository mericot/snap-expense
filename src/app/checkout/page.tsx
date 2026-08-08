import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CheckoutEmbed from './CheckoutEmbed'
import { getPlan, type PlanId } from '@/lib/plans'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Checkout — snapExpense',
  description: 'Set up your snapExpense subscription and start your free trial.',
  robots: { index: false, follow: false },
}

function priceIdForPlan(planId: PlanId): string | undefined {
  switch (planId) {
    case 'pro':
      return process.env.STRIPE_PRO_YEARLY_PRICE_ID
    case 'team':
      return process.env.STRIPE_TEAM_MONTHLY_PRICE_ID
    default:
      return undefined
  }
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { plan } = await searchParams

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const checkoutPath = plan ? `/checkout?plan=${plan}` : '/checkout'
    redirect(`/login?next=${encodeURIComponent(checkoutPath)}`)
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
  const planId: PlanId = plan === 'team' ? 'team' : 'pro'
  const priceId = priceIdForPlan(planId)

  if (!priceId) {
    redirect('/pricing')
  }

  const planData = getPlan(planId)

  return <CheckoutEmbed planName={planData.name} priceId={priceId} />
}
