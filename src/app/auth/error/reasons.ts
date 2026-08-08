/**
 * The vocabulary shared between the callback route and the page that renders
 * its failures.
 *
 * The old client callback put `error_description` straight on screen. That is a
 * string an attacker controls: anyone can send a victim
 * `/auth/callback?error_description=Sign-in+moved,+call+555-0100`, and the page
 * would render it inside our chrome, under our logo, in our voice. React
 * escapes it so it is not XSS, but a convincing phishing message does not need
 * markup. So the query string carries a slug, this file owns the words, and an
 * unrecognised slug falls back to the generic copy.
 */

export const AUTH_ERROR_ROUTE = '/auth/error'

type AuthErrorCopy = { title: string; detail: string }

const GENERIC: AuthErrorCopy = {
  title: 'Sign-in failed',
  detail: 'That sign-in link did not work. Request a new one and try again.',
}

const COPY: Record<string, AuthErrorCopy> = {
  expired: {
    title: 'This link has expired',
    detail:
      'Magic links are single-use and time-limited. Request a new one — it only takes a moment.',
  },
  already_used: {
    title: 'This link has already been used',
    detail: 'Each magic link signs you in once. Request a fresh one to sign in again.',
  },
  different_browser: {
    title: 'Open the link where you asked for it',
    detail:
      'For security, a sign-in link has to be opened in the same browser on the same device that requested it. Request a new link from the browser you want to sign in on.',
  },
  denied: {
    title: 'Sign-in was not completed',
    detail: 'The sign-in was cancelled or denied. Request a new link to try again.',
  },
  invalid: GENERIC,
}

/**
 * Collapse whatever Supabase said into a slug we are willing to render.
 *
 * Supabase's error vocabulary is not stable across releases, so this matches on
 * substrings rather than exact codes and degrades to `invalid` — an unknown
 * error should show generic copy, never the provider's raw text.
 */
export function authErrorReason(raw: string | null | undefined): string {
  const text = (raw ?? '').toLowerCase()
  if (!text) return 'invalid'
  if (text.includes('expired')) return 'expired'
  if (text.includes('already') || text.includes('used')) return 'already_used'
  if (text.includes('denied') || text.includes('cancel')) return 'denied'
  if (text.includes('verifier') || text.includes('pkce') || text.includes('code_challenge'))
    return 'different_browser'
  return 'invalid'
}

export function authErrorCopy(reason: string | null | undefined): AuthErrorCopy {
  if (!reason) return GENERIC
  return COPY[reason] ?? GENERIC
}
