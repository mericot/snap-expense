'use client'

import { useState } from 'react'
import { Button, Card } from '@/components/ui'
import { useSubscription } from '@/components/SubscriptionProvider'
import { isPaymentFailing } from '@/lib/subscription'

/**
 * Shown while a subscription is `past_due`.
 *
 * The account keeps working during Stripe's retry window — see
 * src/lib/subscription.ts for why — but silence would be worse than the old
 * behaviour, not better. Someone whose card expired would carry on using the
 * product for two weeks and then lose it without ever having been told there
 * was a problem they could have fixed in thirty seconds.
 *
 * Self-gating on the subscription context rather than taking props, so it can
 * be dropped into any page under SubscriptionProvider without threading state
 * through. It renders nothing in every other state, including while the plan is
 * still loading — announcing a billing problem that turns out not to exist is
 * its own kind of harm.
 */
export default function PaymentFailedBanner() {
  const { plan, status, loading } = useSubscription()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !isPaymentFailing(plan, status)) return null

  async function openPortal() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      // `.catch(() => null)` because a failure bad enough to bypass the route's
      // own handler answers HTML, and parsing that would replace the real error
      // with a JSON syntax error.
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Could not open billing. Please try again.')
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Card padding="none" className="px-[18px] py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p role="alert" className="text-[13px] font-medium text-warning">
            Your last payment did not go through.
          </p>
          <p className="mt-1 text-[13px] text-text-muted">
            Your account still works for now. Update your card to keep it that way —
            we will keep retrying, but the subscription ends if none of them succeed.
          </p>
        </div>
        <Button size="sm" onClick={openPortal} disabled={busy}>
          {busy ? 'Opening…' : 'Update payment method'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-warning">
          {error}
        </p>
      )}
    </Card>
  )
}
