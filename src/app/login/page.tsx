'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// MOVED, NOT REDESIGNED. This is the sign-in screen that used to live inside
// src/app/page.tsx, carried across so the product still has a way to sign in
// while task 02 designs this route. Task 02 replaces this file wholesale; the
// only edits made here are the two that task 00 owns — the full-viewport min-height became
// `flex-1` (PR #7 finding 1, the footer sat below the fold) and two pre-existing
// lint errors that were already failing `npm run lint` on the base branch.

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError(null)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) {
      console.error('Supabase signInWithOtp error:', error, JSON.stringify(error, Object.getOwnPropertyNames(error)))
      const status = (error as { status?: number | string }).status
      setError(error.message || (status != null ? String(status) : '') || error.name || 'Unknown error')
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <main className="flex-1 bg-zinc-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">snapExpense</h1>
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-sm space-y-3">
            <p className="text-sm font-medium text-zinc-900">Check your email</p>
            <p className="text-sm text-zinc-500">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in. If you don&apos;t see it, check your spam or junk folder.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="text-xs text-zinc-400 underline hover:text-zinc-600"
            >
              Use a different email
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-zinc-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">snapExpense</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to manage your receipts</p>
        </div>
        <form onSubmit={handleSend} className="rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          {status === 'error' && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {status === 'loading' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      </div>
    </main>
  )
}
