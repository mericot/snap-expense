'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ExtractedExpense = {
  merchant: string | null
  date: string | null
  total: number | null
  tax: number | null
  category: string | null
  confidence: 'high' | 'low'
}

const HEIC_TYPES = ['image/heic', 'image/heif']
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', ...HEIC_TYPES]

function isHeic(file: File): boolean {
  return (
    HEIC_TYPES.includes(file.type) ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  )
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
    }
    img.onerror = reject
    img.src = url
  })
}

function readToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve({ base64: dataUrl.split(',')[1], mediaType: file.type || 'image/heic' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function reset(
  setStatus: (s: 'idle') => void,
  setResult: (r: null) => void,
  setError: (e: null) => void,
  setPreview: (p: null) => void,
  inputRef: React.RefObject<HTMLInputElement | null>
) {
  setStatus('idle')
  setResult(null)
  setError(null)
  setPreview(null)
  if (inputRef.current) inputRef.current.value = ''
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'saving' | 'saved' | 'error'>('idle')
  const [result, setResult] = useState<ExtractedExpense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

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
      const { base64, mediaType } = heic
        ? await readToBase64(file)
        : await resizeImage(file, 1500)

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
    if (!result) return
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
    })

    if (dbError) {
      setError(`Save failed: ${dbError.message}`)
      setStatus('done')
      return
    }

    setStatus('saved')
    setTimeout(() => reset(setStatus as any, setResult, setError, setPreview, inputRef), 1500)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 font-sans">
      <div className="mx-auto max-w-md space-y-6">

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">snapExpense</h1>
          <p className="mt-1 text-sm text-zinc-500">Snap a receipt. Get the data.</p>
        </div>

        {/* Upload button — hidden while reviewing extracted result */}
        {status !== 'done' && status !== 'saving' && status !== 'saved' && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={status === 'loading'}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white px-4 py-8 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 disabled:opacity-50"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">
                {status === 'loading' ? 'Processing…' : 'Take a photo or choose a file'}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleChange}
            />
          </>
        )}

        {/* Loading spinner */}
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
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
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

        {/* Preview thumbnail */}
        {preview && (status === 'done' || status === 'saving') && (
          <img
            src={preview}
            alt="Receipt preview"
            className="w-full rounded-xl object-contain shadow"
            style={{ maxHeight: 200 }}
          />
        )}

        {/* Result card + save/discard actions */}
        {(status === 'done' || status === 'saving') && result && (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-700">Extracted</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                result.confidence === 'high'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {result.confidence === 'high' ? 'High confidence' : 'Low confidence — check values'}
              </span>
            </div>

            <dl className="divide-y divide-zinc-100">
              {[
                { label: 'Merchant', value: result.merchant },
                { label: 'Date',     value: result.date },
                { label: 'Total',    value: result.total != null ? `$${result.total.toFixed(2)}` : null },
                { label: 'Tax',      value: result.tax  != null ? `$${result.tax.toFixed(2)}`  : null },
                { label: 'Category', value: result.category },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-zinc-500">{label}</dt>
                  <dd className="text-sm font-medium text-zinc-900">
                    {value ?? <span className="text-zinc-300">—</span>}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Save / Discard */}
            <div className="flex gap-3 border-t border-zinc-100 px-4 py-3">
              <button
                onClick={handleSave}
                disabled={status === 'saving'}
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {status === 'saving' ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => reset(setStatus as any, setResult, setError, setPreview, inputRef)}
                disabled={status === 'saving'}
                className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Save error shown inline below the card */}
        {status === 'done' && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

      </div>
    </main>
  )
}
