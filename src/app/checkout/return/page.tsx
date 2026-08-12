import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui'
import { stripe } from '@/lib/stripe'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { priceToPlan } from '@/lib/plans'

export const metadata: Metadata = {
  title: 'Welcome to Pro',
  robots: { index: false, follow: false },
}

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { session_id } = await searchParams
  if (!session_id) {
    redirect('/pricing')
  }

  let planName = 'Pro'
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (session.status !== 'complete') {
      redirect('/pricing')
    }

    const subscriptionId = session.subscription as string | null
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id ?? ''
      const plan = priceToPlan(priceId)
      planName = plan === 'team' ? 'Team' : 'Pro'

      const admin = createSupabaseAdmin()
      await admin
        .from('subscriptions')
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          plan,
          status: subscription.status,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          current_period_end: subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq('user_id', user.id)
    }
  } catch {
    redirect('/pricing')
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10">
      <Card
        radius="panel"
        padding="md"
        className="flex max-w-[440px] flex-col items-center gap-4 text-center"
      >
        <div className="text-[40px]">&#10003;</div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          You&apos;re all set!
        </h1>
        <p className="text-[14px] leading-[1.5] text-text-muted">
          Your snapExpense {planName} subscription is active. Start scanning
          receipts — there&apos;s no limit now.
        </p>
        <Link
          href="/receipts"
          className="mt-2 inline-flex items-center rounded-lg border border-text bg-text px-5 py-2.5 text-[14px] font-medium text-surface transition-colors hover:bg-text-secondary hover:border-text-secondary"
        >
          Go to receipts
        </Link>
      </Card>
    </main>
  )
}
