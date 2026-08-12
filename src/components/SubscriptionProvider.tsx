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
  const [plan, setPlan] = useState<Subscription['plan']>('free')
  const [status, setStatus] = useState<Subscription['status']>('active')
  // Tracks which user id the current plan/status reflect, rather than a
  // separate `loading` boolean set synchronously in the effect — that
  // pattern (setState before kicking off the fetch) is exactly what
  // react-hooks/set-state-in-effect flags, since it forces an extra render.
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null)

  useEffect(() => {
    if (sessionLoading || !session?.user) return

    const userId = session.user.id
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
        setLoadedForUserId(userId)
      })
      .catch(() => {
        if (!active) return
        setLoadedForUserId(userId)
      })

    return () => {
      active = false
    }
  }, [session?.user?.id, sessionLoading])

  const value = useMemo<SubscriptionState>(() => {
    if (sessionLoading) return { plan: 'free', status: 'active', loading: true }
    if (!session?.user) return { plan: 'free', status: 'active', loading: false }
    return { plan, status, loading: loadedForUserId !== session.user.id }
  }, [sessionLoading, session?.user, plan, status, loadedForUserId])

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}
