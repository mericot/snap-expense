'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/components/SessionProvider'
import { Button, Card } from '@/components/ui'
import AppHeader from '@/app/receipts/AppHeader'
import type { Subscription } from '@/lib/supabase'

export default function SettingsPage() {
  const { session, loading } = useSession()
  const [deleting, setDeleting] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

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

  if (loading || !session) return null

  const email = session.user.email
  const planName = subscription
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : 'Free'
  const hasBilling = !!subscription?.stripe_customer_id

  return (
    <>
      <AppHeader
        email={email}
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
                  {subscription?.cancel_at_period_end && ' — cancels at end of period'}
                </p>
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
                      if (!res.ok) throw new Error('Delete failed')
                      await supabase.auth.signOut()
                      window.location.href = '/login'
                    } catch {
                      setDeleting(false)
                      alert('Something went wrong. Please try again.')
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
