import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

/**
 * Delete the signed-in user's account and everything attached to it.
 *
 * This route previously did not delete the account. Three things were wrong and
 * all three were invisible, because nothing checked a single result:
 *
 *   1. `subscriptions` was deleted through the *caller's* client. That table has
 *      RLS enabled and deliberately has no delete policy (see the note at the
 *      bottom of db/subscriptions.sql — only the service role is meant to write
 *      it). PostgREST answers a delete that matches no permitted row with a
 *      perfectly successful "0 rows", so the row survived, `stripe_customer_id`
 *      and all.
 *   2. The `auth.users` row was never touched at all. The user was signed out
 *      and could sign straight back in.
 *   3. Every await was unchecked and the handler returned `{ ok: true }`
 *      unconditionally, so 1 and 2 were silent.
 *
 * Meanwhile /settings promises "Permanently delete your account and all
 * receipts. This cannot be undone", and the privacy policy and the retention
 * notice both repeat it. So the fix is not optional politeness — it is the
 * difference between the product telling the truth and not.
 *
 * Everything below runs on the service role for that reason. RLS is the right
 * boundary for a user acting on their own rows in the app; it is the wrong tool
 * for an erasure that has to be *complete*, and reusing the caller's client here
 * is what produced a silent no-op in the first place.
 *
 * ORDERING IS LOAD BEARING. Stripe is cancelled first and a failure there stops
 * everything. Deleting the account while a subscription is still live would keep
 * billing a card belonging to a user who no longer exists, with the row that
 * links them to Stripe gone — unrecoverable without going through the Stripe
 * dashboard by hand. Leaving the account intact and returning an error is the
 * strictly better failure.
 *
 * Rows are then deleted explicitly rather than leaning on `on delete cascade`.
 * Both tables do declare it, so `deleteUser` alone *should* be enough — but
 * db/schema.sql has already drifted from the live database once (it is missing
 * `deleted_at`, which the app depends on), so "the constraint is in the file"
 * is not evidence the constraint is in Postgres. Deleting explicitly costs two
 * statements and does not care either way. `deleteUser` still runs last, and
 * the cascade — if present — simply finds nothing left to do.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()

  const { data: sub, error: subReadError } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // `maybeSingle` rather than `single`: a user with no subscription row is a
  // deletable account, not an error. `single` treats "no rows" as a failure and
  // would strand exactly the users whose signup trigger did not fire.
  if (subReadError) {
    console.error('[/api/account/delete] subscription lookup failed', subReadError)
    return Response.json({ error: 'Could not delete your account. Please contact support.' }, { status: 500 })
  }

  if (sub?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id)
    } catch (err) {
      // A subscription Stripe has already ended is not a reason to refuse: the
      // goal state (nothing will be billed again) already holds. Anything else
      // stops the deletion.
      const code = (err as { code?: string })?.code
      if (code !== 'resource_missing') {
        console.error('[/api/account/delete] Stripe cancel failed', err)
        return Response.json(
          {
            error:
              'We could not cancel your subscription, so your account was not deleted. Nothing has been changed. Please contact support.',
          },
          { status: 502 },
        )
      }
    }
  }

  const { error: expensesError } = await admin.from('expenses').delete().eq('user_id', user.id)
  if (expensesError) {
    console.error('[/api/account/delete] expense delete failed', expensesError)
    return Response.json({ error: 'Could not delete your account. Please contact support.' }, { status: 500 })
  }

  const { error: subDeleteError } = await admin.from('subscriptions').delete().eq('user_id', user.id)
  if (subDeleteError) {
    console.error('[/api/account/delete] subscription delete failed', subDeleteError)
    return Response.json({ error: 'Could not delete your account. Please contact support.' }, { status: 500 })
  }

  // Last, because it is the step that makes `user.id` meaningless. Anything
  // that still needed it has already run.
  const { error: userDeleteError } = await admin.auth.admin.deleteUser(user.id)
  if (userDeleteError) {
    console.error('[/api/account/delete] auth user delete failed', userDeleteError)
    return Response.json({ error: 'Could not delete your account. Please contact support.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
