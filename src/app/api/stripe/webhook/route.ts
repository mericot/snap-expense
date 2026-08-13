import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { epochToISO, itemPeriodEnd } from '@/lib/stripe-subscription'
import { priceToPlan } from '@/lib/plans'
import { requiredEnv } from '@/lib/env'
import { track } from '@/lib/analytics'

/**
 * A note on counting these events.
 *
 * The database writes in this file are idempotent by construction, which is why
 * there is no event-id dedup table (see the block comment below). Analytics
 * rows are not: they are append-only, so a Stripe redelivery — most likely when
 * our 200 never reached Stripe — records the same activation twice.
 *
 * Rather than add the dedup table the writes do not need, every event here
 * carries `stripe_event_id`. Stripe's id is stable across redeliveries of the
 * same event, so exact revenue counts are a `count(distinct ...)` away:
 *
 *   select count(distinct props->>'stripe_event_id')
 *   from analytics_events where name = 'subscription_activated';
 *
 * Worth knowing before quoting a number off the dashboard, which uses the plain
 * count — redelivery is rare enough that the difference is noise for trends,
 * and misleading only if someone reads it as an invoice.
 */

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
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
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

  // After the upsert, never before: this event means "the plan is granted", and
  // recording it ahead of the write that grants it would make the dashboard
  // disagree with what the customer actually has.
  track('subscription_activated', {
    userId: userId,
    props: {
      stripe_event_id: eventId,
      plan: priceToPlan(priceId),
      status: subscription.status,
      // Separates a trial start from a paid conversion. Both arrive as the same
      // Stripe event, and counting them together would report revenue on the day
      // a free trial began.
      trialing: subscription.status === 'trialing',
    },
  })
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
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  eventId: string,
  previous: Partial<Stripe.Subscription> | undefined,
) {
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const admin = createSupabaseAdmin()

  const { data, error } = await admin
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
    .select('user_id')

  if (error) throw new Error(`customer.subscription.updated sync failed: ${error.message}`)

  // The cancel-at-period-end *transition* — the customer deciding to leave, or
  // deciding to stay after all. This is the churn signal worth acting on:
  // `subscription_canceled` below fires when the paid period actually runs out,
  // which can be months later and long past the point a win-back was possible.
  //
  // Detected from `previous_attributes`, not by reading our own row first.
  // Stripe puts an attribute there exactly when this event changed it, so the
  // key's presence *is* the transition — no second query, and no race against
  // the update above having already overwritten the old value. A redelivered
  // event repeats the same `previous_attributes`, so dedup stays a
  // count(distinct stripe_event_id) away, same as every other webhook event.
  const userId = data?.[0]?.user_id
  if (userId && previous !== undefined && 'cancel_at_period_end' in previous) {
    track(
      subscription.cancel_at_period_end ? 'cancellation_scheduled' : 'cancellation_reverted',
      {
        userId,
        props: {
          stripe_event_id: eventId,
          plan: priceToPlan(priceId),
          // How much paid time was left when they decided. Cancelling the day
          // after renewal and cancelling the day before are different signals
          // about why.
          days_until_period_end: daysUntil(itemPeriodEnd(subscription)),
        },
      },
    )
  }
}

/** Whole days from now until a Stripe epoch-seconds timestamp; null when absent. */
function daysUntil(epochSeconds: number | null | undefined): number | null {
  if (!epochSeconds) return null
  return Math.max(0, Math.round((epochSeconds * 1000 - Date.now()) / 86_400_000))
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string) {
  const admin = createSupabaseAdmin()

  // `.select('user_id')` is new: this event has no user id on it, and the row
  // being updated is the only thing that knows whose subscription this was —
  // the statement below is also the last moment it can be read, because it
  // nulls `stripe_subscription_id` and nothing can match on it afterwards.
  const { data, error } = await admin
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      stripe_price_id: null,
      cancel_at_period_end: false,
    })
    .eq('stripe_subscription_id', subscription.id)
    .select('user_id')

  if (error) throw new Error(`customer.subscription.deleted sync failed: ${error.message}`)

  // Matching no row is a normal outcome here — see the note above these
  // handlers — and it means there is genuinely nothing that was cancelled, so
  // there is nothing to count either.
  const userId = data?.[0]?.user_id
  if (userId) {
    track('subscription_canceled', {
      userId,
      props: {
        stripe_event_id: eventId,
        plan: priceToPlan(subscription.items.data[0]?.price.id ?? ''),
      },
    })
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice, eventId: string) {
  const sub = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof sub === 'string' ? sub : sub?.id ?? null
  if (!subscriptionId) return

  const admin = createSupabaseAdmin()

  const { data, error } = await admin
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)
    .select('user_id')

  if (error) throw new Error(`invoice.payment_failed sync failed: ${error.message}`)

  const userId = data?.[0]?.user_id
  if (userId) {
    track('payment_failed', {
      userId,
      props: {
        stripe_event_id: eventId,
        // How many times Stripe has tried this invoice. A first failure is
        // usually a card blip; the fourth is churn about to happen, and the
        // difference is worth being able to see.
        attempt: invoice.attempt_count ?? 0,
      },
    })
  }
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
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          event.id,
          event.data.previous_attributes as Partial<Stripe.Subscription> | undefined,
        )
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, event.id)
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
