import Link from 'next/link'
import { authErrorCopy } from './reasons'

/**
 * Where a failed sign-in lands.
 *
 * This used to be a state inside the callback component. A Route Handler cannot
 * render UI and `route.ts` cannot share a segment with `page.tsx`, so the error
 * state needed a route of its own. It deliberately is *not* `/login?error=...`:
 * task 02 is rewriting the login page right now, and a query param it does not
 * know about would be silently dropped, turning a failed sign-in back into the
 * blank-screen bug this PR exists to fix. Folding this into the login page is a
 * reasonable follow-up once that page settles.
 *
 * `reason` is a slug, never provider text — see ./reasons.ts.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>
}) {
  const { reason } = await searchParams
  const { title, detail } = authErrorCopy(Array.isArray(reason) ? reason[0] : reason)

  return (
    <main className="flex-1 bg-zinc-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">snapExpense</h1>
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-sm space-y-3">
          <p className="text-sm font-medium text-zinc-900">{title}</p>
          <p className="text-sm text-zinc-500">{detail}</p>
          <Link
            href="/login"
            className="inline-block mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Request a new link
          </Link>
        </div>
      </div>
    </main>
  )
}
