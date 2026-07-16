'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      // PKCE flow: exchange the code for a session
      supabase.auth.exchangeCodeForSession(code).then(() => router.replace('/'))
    } else {
      // Implicit flow: session already set from URL hash
      router.replace('/')
    }
  }, [router])

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <p className="text-sm text-zinc-400">Signing you in…</p>
    </main>
  )
}
