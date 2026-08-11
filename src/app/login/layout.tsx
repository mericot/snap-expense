import type { Metadata } from 'next'

/**
 * Metadata carrier for /login. The page is a client component and cannot export
 * `metadata` itself.
 *
 * Deliberately noindex. The sign-in form is reachable without a session, but it
 * is not a useful search result and it competes with the landing page for the
 * brand query — which is why it is absent from sitemap.ts too. The two
 * decisions belong together; change both or neither.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to snapExpense with a magic link.',
  robots: { index: false, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
