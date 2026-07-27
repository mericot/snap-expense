'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const { data: { session: existing } } = await supabase.auth.getSession()

      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) {
        router.replace('/')
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        if (existing) {
          router.replace('/')
        } else {
          setError(error.message || 'This link is invalid or has expired.')
        }
        return
      }

      router.replace('/')
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">snapExpense</h1>
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-sm space-y-3">
            <p className="text-sm font-medium text-zinc-900">Sign-in failed</p>
            <p className="text-sm text-zinc-500">{error}</p>
            <a
              href="/"
              className="inline-block mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Request a new link
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <p className="text-sm text-zinc-400">Signing you in…</p>
    </main>
  )
}
