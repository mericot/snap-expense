'use client'

export const dynamic = 'force-dynamic'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Expense } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/categories'

type ExtractedExpense = {
  merchant: string | null
  date: string | null
  total: number | null
  tax: number | null
  category: string | null
  confidence: 'high' | 'low'
}

type EditDraft = {
  merchant: string
  date: string
  total: string
  tax: string
  category: string
}

const HEIC_TYPES = ['image/heic', 'image/heif']
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', ...HEIC_TYPES]

function isHeic(file: File) {
  return HEIC_TYPES.includes(file.type) || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
}

function resizeImage(file: File, maxPx: number): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxPx / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mediaType: 'image/jpeg' })
    }
    img.onerror = reject
    img.src = url
  })
}

function readToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mediaType: file.type || 'image/heic' })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fmt(n: number) { return `$${Number(n).toFixed(2)}` }

// ── Inline editable row ─────────────────────────────────────────────────────

function ExpenseRow({ expense, onSave, onDelete }: {
  expense: Expense
  onSave: (id: string, draft: EditDraft) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<EditDraft>({
    merchant: expense.merchant,
    date: expense.date,
    total: String(expense.total),
    tax: expense.tax != null ? String(expense.tax) : '',
    category: expense.category ?? '',
  })

  function set(field: keyof EditDraft, value: string) {
    setDraft(d => ({ ...d, [field]: value }))
  }

  async function save() {
    setSaving(true)
    await onSave(expense.id, draft)
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setDraft({
      merchant: expense.merchant,
      date: expense.date,
      total: String(expense.total),
      tax: expense.tax != null ? String(expense.tax) : '',
      category: expense.category ?? '',
    })
    setEditing(false)
  }

  const inputCls = 'w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none'

  if (editing) {
    return (
      <tr className="bg-zinc-50">
        <td className="px-3 py-2 min-w-[110px]">
          <input type="date" value={draft.date} onChange={e => set('date', e.target.value)} className={inputCls} />
        </td>
        <td className="px-3 py-2 min-w-[130px]">
          <input type="text" value={draft.merchant} onChange={e => set('merchant', e.target.value)} className={inputCls} placeholder="Merchant" />
        </td>
        <td className="px-3 py-2 min-w-[110px]">
          <select value={draft.category} onChange={e => set('category', e.target.value)} className={inputCls}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </td>
        <td className="px-3 py-2 min-w-[90px]">
          <input type="number" value={draft.total} onChange={e => set('total', e.target.value)} className={`${inputCls} text-right`} step="0.01" placeholder="0.00" />
        </td>
        <td className="px-3 py-2 min-w-[90px]">
          <input type="number" value={draft.tax} onChange={e => set('tax', e.target.value)} className={`${inputCls} text-right`} step="0.01" placeholder="0.00" />
        </td>
        <td className="px-3 py-2 min-w-[100px]">
          <div className="flex gap-1">
            <button onClick={save} disabled={saving} className="flex-1 rounded bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 active:scale-95">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={cancel} className="flex-1 rounded border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 active:scale-95">
              Cancel
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="transition-colors hover:bg-zinc-50 active:bg-zinc-50">
      <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">{expense.date}</td>
      <td className="px-4 py-3 text-sm font-medium text-zinc-900">{expense.merchant}</td>
      <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">{expense.category ?? '—'}</td>
      <td className="px-4 py-3 text-right text-sm font-medium text-zinc-900 whitespace-nowrap">{fmt(expense.total)}</td>
      <td className="px-4 py-3 text-right text-sm text-zinc-400 whitespace-nowrap">{expense.tax != null ? fmt(expense.tax) : '—'}</td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 active:scale-95 transition-transform"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(expense.id)}
            className="rounded bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 active:scale-95 transition-transform"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 font-sans">
      <div className="mx-auto max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">snapExpense</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to your expense tracker</p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-green-800">Check your email</p>
            <p className="mt-2 text-sm text-green-700">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">Email address</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'saving' | 'saved' | 'error'>('idle')
  const [result, setResult] = useState<ExtractedExpense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadExpenses = useCallback(async () => {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false })
    if (data) setExpenses(data)
  }, [])

  useEffect(() => {
    if (session) loadExpenses()
  }, [session, loadExpenses])

  const categoryTotals = CATEGORIES.map(cat => ({
    category: cat,
    total: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + Number(e.total), 0),
  })).filter(c => c.total > 0)

  const grandTotal = expenses.reduce((sum, e) => sum + Number(e.total), 0)

  function clearForm() {
    setStatus('idle')
    setResult(null)
    setError(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setPreview(null)
    setStatus('loading')
    const heic = isHeic(file)
    if (!heic && !ALLOWED_TYPES.includes(file.type)) {
      setStatus('error')
      setError(`Unsupported file type (${file.type || 'unknown'}). Please use JPEG, PNG, WebP, or HEIC.`)
      return
    }
    if (!heic) setPreview(URL.createObjectURL(file))
    try {
      const { base64, mediaType } = heic ? await readToBase64(file) : await resizeImage(file, 1500)
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
      setResult(data)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  async function handleSave() {
    if (!result || !session) return
    if (!result.merchant || !result.date || result.total == null) {
      setError('Cannot save — merchant, date, and total are required.')
      return
    }
    setStatus('saving')
    const { error: dbError } = await supabase.from('expenses').insert({
      merchant: result.merchant,
      date: result.date,
      total: result.total,
      tax: result.tax,
      category: result.category,
      user_id: session.user.id,
    })
    if (dbError) { setError(`Save failed: ${dbError.message}`); setStatus('done'); return }
    await loadExpenses()
    setStatus('saved')
    setTimeout(clearForm, 1500)
  }

  async function handleUpdate(id: string, draft: EditDraft) {
    const { error } = await supabase.from('expenses').update({
      merchant: draft.merchant,
      date: draft.date,
      total: parseFloat(draft.total),
      tax: draft.tax !== '' ? parseFloat(draft.tax) : null,
      category: draft.category || null,
    }).eq('id', id)
    if (!error) await loadExpenses()
  }

  async function handleDelete(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    await loadExpenses()
  }

  async function handleDeleteAll() {
    if (!window.confirm('Delete all your expenses? This cannot be undone.')) return
    await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setExpenses([])
  }

  function exportCSV() {
    const header = ['merchant', 'date', 'total', 'tax', 'category']
    const rows = expenses.map(e => [
      `"${(e.merchant ?? '').replace(/"/g, '""')}"`,
      e.date,
      e.total,
      e.tax ?? '',
      e.category ?? '',
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (session === undefined) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      </main>
    )
  }

  if (session === null) return <LoginScreen />

  const reviewing = status === 'done' || status === 'saving'

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 font-sans">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">snapExpense</h1>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">Snap a receipt. Get the data.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden text-xs text-zinc-400 sm:block truncate max-w-[160px]">{session.user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 active:scale-95 transition-transform"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Upload */}
        {!reviewing && status !== 'saved' && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={status === 'loading'}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-white px-4 py-10 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 disabled:opacity-50 active:scale-[0.99]"
            >
              <svg className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-base font-medium">{status === 'loading' ? 'Processing…' : 'Take a photo or choose a file'}</span>
            </button>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </>
        )}

        {/* Spinner */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <svg className="h-8 w-8 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-zinc-400">Reading your receipt…</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Saved confirmation */}
        {status === 'saved' && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved! Ready for the next receipt.
          </div>
        )}

        {/* Review card */}
        {reviewing && result && (
          <div className="space-y-4">
            {preview && <img src={preview} alt="Receipt preview" className="w-full rounded-xl object-contain shadow" style={{ maxHeight: 220 }} />}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700">Extracted</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${result.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {result.confidence === 'high' ? 'High confidence' : 'Low confidence — check values'}
                </span>
              </div>
              <dl className="divide-y divide-zinc-100">
                {([['Merchant', result.merchant], ['Date', result.date], ['Total', result.total != null ? fmt(result.total) : null], ['Tax', result.tax != null ? fmt(result.tax) : null], ['Category', result.category]] as [string, string | null][]).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <dt className="text-sm text-zinc-500">{label}</dt>
                    <dd className="text-sm font-medium text-zinc-900">{value ?? <span className="text-zinc-300">—</span>}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex gap-3 border-t border-zinc-100 px-4 py-3">
                <button onClick={handleSave} disabled={status === 'saving'} className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 active:scale-[0.98] transition-transform">
                  {status === 'saving' ? 'Saving…' : 'Save'}
                </button>
                <button onClick={clearForm} disabled={status === 'saving'} className="flex-1 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 active:scale-[0.98] transition-transform">
                  Discard
                </button>
              </div>
            </div>
            {status === 'done' && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
          </div>
        )}

        {/* Category totals */}
        {expenses.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">By Category</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categoryTotals.map(({ category, total }) => (
                <div key={category} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs text-zinc-500">{category}</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">{fmt(total)}</p>
                </div>
              ))}
              <div className="rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-3 shadow-sm">
                <p className="text-xs text-zinc-400">Total</p>
                <p className="mt-1 text-lg font-semibold text-white">{fmt(grandTotal)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Expenses table */}
        {expenses.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">All Expenses</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 active:scale-95 transition-transform"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 active:scale-95 transition-transform"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Merchant</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Tax</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {expenses.map(e => (
                    <ExpenseRow key={e.id} expense={e} onSave={handleUpdate} onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {expenses.length === 0 && status === 'idle' && (
          <p className="text-center text-sm text-zinc-400">No expenses yet. Snap your first receipt above.</p>
        )}

      </div>
    </main>
  )
}
