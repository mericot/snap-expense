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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionLoading) return
    if (!session?.user) {
      setPlan('free')
      setStatus('active')
      setLoading(false)
      return
    }

    setPlan('free')
    setStatus('active')
    setLoading(true)

    let active = true

    Promise.resolve(
      supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', session.user.id)
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
  }, [session?.user?.id, sessionLoading])

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
