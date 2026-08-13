import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { epochToISO, itemPeriodEnd } from '@/lib/stripe-subscription'
import { priceToPlan } from '@/lib/plans'
import { requiredEnv } from '@/lib/env'

/**
 * Every write below throws on failure rather than swallowing the error.
 *
 * The handler used to ignore the result of each admin write and answer Stripe
 * `200` regardless, which is precisely the wrong way round: `200` means
 * "recorded, do not send it again". A failed sync was therefore permanent, and
 * Stripe's retry — the thing that exists to fix exactly this — never fired.
 * Throwing turns the POST into a 500 and lets Stripe do its job.
 *
 * Redelivery is safe: every handler writes a fixed set of values derived from
 * the event's own subscription object, so applying one twice lands on the same
 * row state. That is why there is no event-id dedup table here — the writes are
 * idempotent by construction, which is a better property than remembering.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const userId = session.metadata?.user_id
  if (!userId) return

  const subscriptionId = session.subscription as string
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price.id ?? ''

  const admin = createSupabaseAdmin()

  // `upsert`, not `update`. An update keyed on user_id writes nothing when the
  // row is absent, and a row can be absent: that is exactly the state the
  // 2026-08-09 migration was written to repair, where the signup trigger failed
  // and no subscriptions row was ever created. In that state a customer paid,
  // Stripe reported success, and the plan was never granted — silently, because
  // "0 rows updated" is not an error. Upsert makes the payment authoritative.
  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        plan: priceToPlan(priceId),
        status: subscription.status,
        trial_ends_at: epochToISO(subscription.trial_end),
        current_period_end: epochToISO(itemPeriodEnd(subscription)),
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: 'user_id' },
    )

  if (error) throw new Error(`checkout.session.completed sync failed: ${error.message}`)
}

/**
 * Note on the three handlers below: each matches on `stripe_subscription_id`,
 * and matching nothing is a normal outcome, not a failure. Deletion nulls that
 * column, so a `customer.subscription.updated` that arrives late — after the
 * `deleted` for the same subscription — finds no row and correctly does
 * nothing. That is the out-of-order guard; it needs no extra condition, but it
 * does mean "0 rows" must not be treated as an error, or Stripe would retry
 * those events forever.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const admin = createSupabaseAdmin()

  const { error } = await admin
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

  if (error) throw new Error(`customer.subscription.updated sync failed: ${error.message}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const admin = createSupabaseAdmin()

  const { error } = await admin
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      stripe_price_id: null,
      cancel_at_period_end: false,
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) throw new Error(`customer.subscription.deleted sync failed: ${error.message}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const sub = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof sub === 'string' ? sub : sub?.id ?? null
  if (!subscriptionId) return

  const admin = createSupabaseAdmin()

  const { error } = await admin
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) throw new Error(`invoice.payment_failed sync failed: ${error.message}`)
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Read outside the try on purpose. A whitespace-damaged or missing signing
  // secret makes `constructEvent` fail exactly like a forged request, so inside
  // the try it would return `400 Invalid signature` — a line that reads as
  // someone probing the endpoint while in fact every genuine event is being
  // rejected. Checkouts complete, subscriptions never activate, and the logs
  // point at an attacker. Out here it throws a named error and a 500, which is
  // also what Stripe retries against once the variable is fixed.
  const webhookSecret = requiredEnv(
    'STRIPE_WEBHOOK_SECRET',
    process.env.STRIPE_WEBHOOK_SECRET,
  )

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  try {
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
  } catch (err) {
    // 500, so Stripe redelivers. The alternative — logging and answering 200 —
    // is what this route did before, and it converts a transient database blip
    // into a customer who paid and was never upgraded, with nothing left to
    // replay it. Redelivery is safe here; see the note above the handlers.
    console.error(`[/api/stripe/webhook] ${event.type} (${event.id})`, err)
    return new Response('Handler failed', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
