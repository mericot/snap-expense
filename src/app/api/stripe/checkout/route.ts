import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'
import { TRIAL_DAYS } from '@/lib/plans'

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

    const { priceId } = body
    if (
      !priceId ||
      (priceId !== process.env.STRIPE_PRO_YEARLY_PRICE_ID &&
        priceId !== process.env.STRIPE_TEAM_MONTHLY_PRICE_ID)
    ) {
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
    }

    const isPro = priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID

    const origin = req.headers.get('origin') || req.nextUrl.origin

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded_page',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: isPro ? TRIAL_DAYS : undefined,
        metadata: { user_id: user.id },
      },
      metadata: { user_id: user.id },
      return_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    })

    return Response.json({ clientSecret: session.client_secret })
  } catch (err) {
    console.error('[/api/stripe/checkout]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
