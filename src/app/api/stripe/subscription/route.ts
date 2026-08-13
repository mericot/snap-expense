import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { epochToISO, itemPeriodEnd } from '@/lib/stripe-subscription'

/**
 * Cancel or resume the signed-in user's subscription.
 *
 * Cancelling sets `cancel_at_period_end` rather than deleting the subscription
 * outright. `/pricing` promises "Cancel any time, keeps working until the
 * period ends" (PRE_CHECKOUT_STATEMENTS in lib/plans.ts), and Pro is billed a
 * year up front — an immediate delete would take back up to eleven months the
 * customer has already paid for. It also makes the action reversible while the
 * period runs, which is what `resume` is for.
 *
 * Stripe is the source of truth; the response echoes what Stripe returned, not
 * what we asked for.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { action?: string }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { action } = body
    if (action !== 'cancel' && action !== 'resume') {
      return Response.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Looked up by user_id, so the Stripe id we act on is always the caller's
    // own — the request never names a subscription to operate on.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', user.id)
      .single()

    if (!sub?.stripe_subscription_id) {
      return Response.json({ error: 'No active subscription' }, { status: 400 })
    }

    // A subscription Stripe has already ended cannot be updated at all, so
    // answer here rather than letting the Stripe call throw into the 500.
    if (sub.status === 'canceled') {
      return Response.json(
        { error: 'This subscription has already ended' },
        { status: 400 }
      )
    }

    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: action === 'cancel',
    })

    const cancelAtPeriodEnd = updated.cancel_at_period_end
    const currentPeriodEnd = epochToISO(itemPeriodEnd(updated))

    // Sync now instead of waiting on customer.subscription.updated. The webhook
    // still fires and writes these same values from the same subscription
    // object, so whichever lands second is a no-op — but the user gets the new
    // state in this response rather than whenever Stripe next calls us.
    const admin = createSupabaseAdmin()
    await admin
      .from('subscriptions')
      .update({
        status: updated.status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
      })
      .eq('user_id', user.id)

    return Response.json({
      status: updated.status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    })
  } catch (err) {
    console.error('[/api/stripe/subscription]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
