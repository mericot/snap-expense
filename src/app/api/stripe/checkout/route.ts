import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { TRIAL_DAYS } from '@/lib/plans'
import { siteUrl } from '@/lib/site-url'

/**
 * Statuses that mean the customer is still on the hook for a subscription, and
 * so must not be sold a second one on top of it.
 *
 * `incomplete` is deliberately absent. It means a first payment that never
 * landed — Stripe expires those on its own after 23 hours — and treating it as
 * blocking would strand a buyer whose card was declined once behind an error
 * telling them they already subscribed. `canceled` and `incomplete_expired` are
 * absent for the ordinary reason: those people are entitled to come back.
 *
 * `past_due` and `unpaid` *do* block. Someone whose card is failing needs to
 * fix that card in the portal; buying a second subscription leaves the first
 * one failing and starts billing them twice over.
 */
const BLOCKING_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
])

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[/api/stripe/checkout] auth failed:', authError?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { priceId?: string }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // The allow-list is what stops a caller naming any price in the account —
    // including one they invented the id of, or a cheaper archived one. Built
    // from the environment so an unset variable means that plan simply cannot
    // be bought, which is how hidden Team stays unbuyable in production.
    const allowedPriceIds = [
      process.env.STRIPE_PRO_YEARLY_PRICE_ID,
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
    ].filter((id): id is string => Boolean(id))

    const { priceId } = body
    if (!priceId || !allowedPriceIds.includes(priceId)) {
      return Response.json({ error: 'Invalid price' }, { status: 400 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId = sub?.stripe_customer_id

    // /checkout already bounces an existing subscriber to /receipts, but that
    // check reads the local `subscriptions` row, which is only ever as fresh as
    // the last webhook that landed. Miss or delay one and the page waves the
    // buyer straight through — and this route, which anything can POST to
    // directly, had nothing of its own to say no with. The result was a second
    // subscription on the same customer and two charges a month for one plan.
    //
    // So ask Stripe, which is the one account of this that cannot go stale. It
    // also covers the states the page guard does not look at at all: past_due,
    // unpaid and paused.
    //
    // Only when the customer already existed — one created moments ago on the
    // line below has nothing to find, and the call would be a guaranteed miss.
    if (customerId) {
      // Omitting `status` returns everything except canceled and
      // incomplete_expired, which is already close to what we want; the filter
      // is written out anyway so the intent does not rest on that default. The
      // limit is far above what a real customer accumulates — and if someone
      // ever did exceed it, the extra page would be the oldest, which is the
      // least likely to be the live one.
      const existing = await stripe.subscriptions.list({
        customer: customerId,
        limit: 100,
      })

      const blocking = existing.data.find((item) => BLOCKING_STATUSES.has(item.status))

      if (blocking) {
        console.warn(
          `[/api/stripe/checkout] ${user.id} already has subscription ${blocking.id} ` +
            `(${blocking.status}); refusing to sell another`,
        )
        // 409 rather than 400: the request is well formed, it conflicts with
        // state that already exists. `redirectTo` is what lets the client send
        // them somewhere they can act instead of failing in place.
        return Response.json(
          {
            error: 'You already have a subscription. You can manage it in Settings.',
            redirectTo: '/settings',
          },
          { status: 409 },
        )
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      })
      customerId = customer.id

      // Persist immediately rather than waiting for the webhook to do it after
      // a completed payment. Every abandoned checkout used to mint another
      // Stripe customer for the same person, because the next attempt found no
      // id and made a fresh one. Written on the service role: `subscriptions`
      // has no user-facing update policy, by design — only the webhook and
      // routes like this one may write it.
      const admin = createSupabaseAdmin()
      const { error: persistError } = await admin
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)

      // Not fatal. A missed write costs a duplicate customer next time, which
      // is untidy but does not stop this purchase from completing.
      if (persistError) {
        console.error('[/api/stripe/checkout] could not persist customer id', persistError)
      }
    }

    // Both Pro cycles get the trial. Checking only the yearly id — as this did
    // before monthly existed — would have quietly denied the trial to every
    // monthly subscriber while /pricing went on advertising it on the card.
    const isPro =
      priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ||
      priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded_page',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // /pricing tells every visitor "Prices exclude sales tax, added at
      // checkout where applicable" (PRE_CHECKOUT_STATEMENTS in lib/plans.ts).
      // Until now nothing added any, so that line was a promise the checkout
      // did not keep. Stripe Tax computes it from the billing address, which is
      // why the next two options are not optional extras — automatic_tax has
      // nothing to work from without an address, and Stripe rejects the call if
      // a customer is attached and customer_update.address is not 'auto'.
      //
      // NOTE: this only computes tax for jurisdictions you are registered in.
      // Registrations are configured in the Stripe dashboard; this flag alone
      // does not make anything compliant.
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      customer_update: { address: 'auto' },
      subscription_data: {
        trial_period_days: isPro ? TRIAL_DAYS : undefined,
        metadata: { user_id: user.id },
      },
      metadata: { user_id: user.id },
      return_url: `${siteUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    })

    return Response.json({ clientSecret: session.client_secret })
  } catch (err) {
    console.error('[/api/stripe/checkout]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
