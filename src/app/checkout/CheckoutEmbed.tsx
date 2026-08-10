'use client'

import { useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js'
import Link from 'next/link'
import { REFUND_WINDOW_DAYS } from '@/lib/plans'
import PurchaseSteps from '@/components/PurchaseSteps'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

export default function CheckoutEmbed({
  planName,
  priceId,
}: {
  planName: string
  priceId: string
}) {
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const data = await res.json()
    if (!data.clientSecret) {
      throw new Error(data.error || 'Failed to create checkout session')
    }
    return data.clientSecret
  }, [priceId])

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-[800px]">
        {/* Step two of the same three the login page showed. Whether the buyer
            detoured through sign-in or came straight here already signed in,
            the flow reads the same length from this point on. */}
        <PurchaseSteps current={2} className="mx-auto mb-8" />

        <div className="mb-8">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            Subscribe to snapExpense {planName}
          </h1>
          <p className="mt-[6px] text-[13px] leading-[1.5] text-text-tertiary">
            Complete your purchase below. Your card details are handled entirely
            by Stripe — we never see or store your card number.
          </p>
        </div>

        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{ fetchClientSecret }}
        >
          <EmbeddedCheckout className="w-full" />
        </EmbeddedCheckoutProvider>

        <p className="mt-8 text-[12px] leading-[1.6] text-text-tertiary">
          By completing this purchase you agree to the{' '}
          <Link href="/legal/terms" className="underline">
            Terms of Service
          </Link>
          . Cancel any time from Settings and the plan runs to the end of the
          paid period. Full refund within {REFUND_WINDOW_DAYS} days of a
          charge — see the{' '}
          <Link href="/legal/refunds" className="underline">
            refund policy
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
