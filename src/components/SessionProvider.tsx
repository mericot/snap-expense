'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * One client-side session subscription for the whole app.
 *
 * This used to be a `useEffect` at the bottom of src/app/page.tsx. Five routes
 * need the session now, so it lives here instead of being copy-pasted.
 *
 * It is **not** the auth gate. Redirects happen server-side in src/proxy.ts, so
 * a signed-out visitor never renders a page they are about to be moved off —
 * which matters most on `/`, where the wrong page is an entire marketing site.
 * What this provides is the session *object* for interactive work: the user id
 * for inserts, the email in the header, and live sign-out via
 * `onAuthStateChange`.
 */

type SessionState = {
  /** null once known to be signed out. */
  session: Session | null
  /** True until the first `getSession()` resolves. */
  loading: boolean
}

const SessionContext = createContext<SessionState>({ session: null, loading: true })

export function useSession(): SessionState {
  return useContext(SessionContext)
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ session, loading }), [session, loading])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
