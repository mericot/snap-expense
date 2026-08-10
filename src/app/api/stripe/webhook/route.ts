import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { epochToISO, itemPeriodEnd } from '@/lib/stripe-subscription'
import type { PlanId } from '@/lib/plans'

function priceToPlan(priceId: string): PlanId {
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
    return 'pro'
  }
  if (priceId === process.env.STRIPE_TEAM_MONTHLY_PRICE_ID) {
    return 'team'
  }
  return 'free'
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const userId = session.metadata?.user_id
  if (!userId) return

  const subscriptionId = session.subscription as string
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price.id ?? ''

  const admin = createSupabaseAdmin()
  await admin
    .from('subscriptions')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      plan: priceToPlan(priceId),
      status: subscription.status,
      trial_ends_at: epochToISO(subscription.trial_end),
      current_period_end: epochToISO(itemPeriodEnd(subscription)),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('user_id', userId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const admin = createSupabaseAdmin()

  await admin
    .from('subscriptions')
    .update({
      stripe_price_id: priceId,
      plan: priceToPlan(priceId),
      status: subscription.status,
      trial_ends_at: epochToISO(subscription.trial_end),
      current_period_end: epochToISO(itemPeriodEnd(subscription)),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const admin = createSupabaseAdmin()

  await admin
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      stripe_price_id: null,
      cancel_at_period_end: false,
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const sub = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof sub === 'string' ? sub : sub?.id ?? null
  if (!subscriptionId) return

  const admin = createSupabaseAdmin()

  await admin
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break
  }

  return new Response('ok', { status: 200 })
}
