'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, type Subscription } from '@/lib/supabase'
import { useSession } from './SessionProvider'

type SubscriptionState = {
  plan: Subscription['plan']
  status: Subscription['status']
  loading: boolean
}

const SubscriptionContext = createContext<SubscriptionState>({
  plan: 'free',
  status: 'active',
  loading: true,
})

export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext)
}

export default function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user?.id ?? null

  const [plan, setPlan] = useState<Subscription['plan']>('free')
  const [status, setStatus] = useState<Subscription['status']>('active')
  const [loading, setLoading] = useState(true)

  // Reset to defaults as soon as the signed-in user changes, without waiting
  // for an effect — this is a render-time state adjustment, not a side
  // effect, so it must not live in useEffect.
  const [trackedUserId, setTrackedUserId] = useState<string | null | undefined>(undefined)
  if (!sessionLoading && trackedUserId !== userId) {
    setTrackedUserId(userId)
    setPlan('free')
    setStatus('active')
    setLoading(userId !== null)
  }

  useEffect(() => {
    if (sessionLoading || !userId) return

    let active = true

    Promise.resolve(
      supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', userId)
        .single()
    )
      .then(({ data }) => {
        if (!active) return
        if (data) {
          setPlan(data.plan)
          setStatus(data.status)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId, sessionLoading])

  const value = useMemo(
    () => ({ plan, status, loading }),
    [plan, status, loading]
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}
