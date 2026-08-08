import { createSupabaseServerClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'

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
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (sub?.stripe_subscription_id) {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id)
  }

  await supabase.from('subscriptions').delete().eq('user_id', user.id)
  await supabase.from('expenses').delete().eq('user_id', user.id)

  return Response.json({ ok: true })
}
