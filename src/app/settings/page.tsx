'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/components/SessionProvider'
import { Button, Card } from '@/components/ui'
import AppHeader from '@/app/receipts/AppHeader'
import type { Subscription } from '@/lib/supabase'

const PERIOD_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

/**
 * "March 18, 2027" from a `timestamptz`.
 *
 * Unlike `expenses.date` — which receipts/format.ts goes out of its way *not*
 * to hand to `new Date` — `current_period_end` is a real instant, so parsing it
 * and rendering it in the reader's timezone is the correct thing: the period
 * ends at one moment worldwide.
 */
function periodDate(iso: string | null | undefined) {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : PERIOD_DATE.format(date)
}

export default function SettingsPage() {
  const { session, loading } = useSession()
  const [deleting, setDeleting] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setSubscription(data as Subscription)
      })
  }, [session])

  const openPortal = useCallback(async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setPortalLoading(false)
    }
  }, [])

  /**
   * Cancelling does not end the subscription on the spot — it schedules it to
   * stop renewing, which is why the same call resumes it. Both directions write
   * Stripe's answer back into local state so the section re-renders without a
   * reload, and without waiting for the webhook to land.
   */
  const setCancellation = useCallback(async (action: 'cancel' | 'resume') => {
    setBillingBusy(true)
    try {
      const res = await fetch('/api/stripe/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setSubscription((current) =>
        current
          ? {
              ...current,
              status: data.status,
              current_period_end: data.current_period_end,
              cancel_at_period_end: data.cancel_at_period_end,
            }
          : current
      )
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setBillingBusy(false)
    }
  }, [])

  if (loading || !session) return null

  const email = session.user.email
  const planName = subscription
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : 'Free'
  const hasBilling = !!subscription?.stripe_customer_id

  // Free plans have no Stripe subscription to act on, and one Stripe has
  // already ended can no longer be cancelled or resumed.
  const isCancellable =
    !!subscription?.stripe_subscription_id && subscription.status !== 'canceled'
  const periodEnd = periodDate(subscription?.current_period_end)

  let renewalNote: string | null = null
  if (isCancellable && subscription?.cancel_at_period_end) {
    renewalNote = periodEnd
      ? `Your ${planName} plan ends on ${periodEnd}. You keep everything until then, and move to Free after.`
      : `Your ${planName} plan ends when the current billing period does. You keep everything until then.`
  } else if (isCancellable && subscription?.status === 'trialing') {
    renewalNote = periodEnd
      ? `Your trial ends on ${periodEnd} — that is when the first charge happens.`
      : 'Your trial is running. Cancel before it ends and you are never charged.'
  } else if (isCancellable && periodEnd) {
    renewalNote = `Renews on ${periodEnd}.`
  }

  return (
    <>
      <AppHeader
        email={email}
        currentPage="settings"
        onSignOut={async () => {
          await supabase.auth.signOut()
          window.location.href = '/login'
        }}
      />

      <main className="flex-1 bg-surface">
        <div className="mx-auto flex max-w-[900px] flex-col gap-5 p-6">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">Settings</h1>

          <Card>
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-[15px] font-semibold text-text">Account</h2>
                <p className="mt-1 text-[13px] text-text-tertiary">
                  Signed in as <strong className="font-semibold text-text">{email}</strong>
                </p>
              </div>

              <div className="border-t border-border-subtle pt-4">
                <h2 className="text-[15px] font-semibold text-text">Plan</h2>
                <p className="mt-1 text-[13px] text-text-tertiary">
                  You are on the <strong className="font-semibold text-text">{planName}</strong> plan.
                  {subscription?.status === 'trialing' && ' (trial)'}
                </p>
                {renewalNote && (
                  <p className="mt-1 text-[13px] text-text-tertiary">{renewalNote}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button href="/pricing" variant="outline" size="sm" className="no-underline">
                    View plans
                  </Button>
                  {hasBilling && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={portalLoading}
                      onClick={openPortal}
                    >
                      {portalLoading ? 'Loading…' : 'Manage billing'}
                    </Button>
                  )}
                  {isCancellable && subscription?.cancel_at_period_end && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={billingBusy}
                      onClick={() => setCancellation('resume')}
                    >
                      {billingBusy ? 'Working…' : 'Resume subscription'}
                    </Button>
                  )}
                  {isCancellable && !subscription?.cancel_at_period_end && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger"
                      disabled={billingBusy}
                      onClick={() => {
                        // Name the date in the prompt. "Are you sure?" makes
                        // people guess whether they lose access tonight; the
                        // whole point of cancelling at period end is that they
                        // do not, so say so before they decide.
                        const message = periodEnd
                          ? `Cancel your ${planName} plan? It stays active until ${periodEnd}, then you move to the Free plan. You can resume any time before then.`
                          : `Cancel your ${planName} plan? It stays active until the end of the current billing period, then you move to the Free plan.`
                        if (!window.confirm(message)) return
                        setCancellation('cancel')
                      }}
                    >
                      {billingBusy ? 'Working…' : 'Cancel subscription'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t border-border-subtle pt-4">
                <h2 className="text-[15px] font-semibold text-text">Delete account</h2>
                <p className="mt-1 text-[13px] text-text-tertiary">
                  Permanently delete your account and all receipts. This cannot be undone.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-danger"
                  disabled={deleting}
                  onClick={async () => {
                    if (!window.confirm('Are you sure you want to delete your account? All data will be permanently removed.')) return
                    setDeleting(true)
                    try {
                      const res = await fetch('/api/account/delete', { method: 'POST' })
                      if (!res.ok) {
                        // The route distinguishes between failures, and the
                        // difference matters to the user: a failed Stripe
                        // cancellation means the account is still there and
                        // still billing, which "please try again" would talk
                        // them straight past. Show what the server actually
                        // said and fall back only if it said nothing.
                        const body = await res.json().catch(() => null)
                        throw new Error(body?.error || 'Something went wrong. Please try again.')
                      }
                      await supabase.auth.signOut()
                      window.location.href = '/login'
                    } catch (err) {
                      setDeleting(false)
                      alert(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
                    }
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete account'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}
