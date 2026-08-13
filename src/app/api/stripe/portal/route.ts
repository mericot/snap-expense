import { createSupabaseServerClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'
import { siteUrl } from '@/lib/site-url'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!sub?.stripe_customer_id) {
    return Response.json({ error: 'No billing account found' }, { status: 400 })
  }

  // Wrapped because this call fails for a reason that does not exist in test
  // mode: the Customer Portal has no *live* default configuration until someone
  // activates it in the dashboard, and Stripe rejects `sessions.create` without
  // one. Unwrapped, that throw became an HTML 500, so the caller's `res.json()`
  // rejected before it could read an error message and the button in /settings
  // silently did nothing. Answering JSON on every path is what lets the client
  // say something out loud.
  //
  // The message stays generic on purpose — a Stripe error string can name
  // internal configuration, and the operator gets the real one from the log.
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl()}/settings`,
    })

    return Response.json({ url: portalSession.url })
  } catch (err) {
    console.error('[/api/stripe/portal]', err)
    return Response.json({ error: 'Could not open billing. Please try again.' }, { status: 500 })
  }
}
