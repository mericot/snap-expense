import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { TRIAL_DAYS } from '@/lib/plans'
import { siteUrl } from '@/lib/site-url'

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
