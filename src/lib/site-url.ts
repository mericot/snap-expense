/**
 * The origin to build absolute URLs from, for the two places that hand one to
 * Stripe as a `return_url`.
 *
 * Both used to read `req.headers.get('origin')` and fall back to
 * `req.nextUrl.origin`. Neither is trustworthy:
 *
 *   - `Origin` is a request header. Whoever is calling chooses it. It is not a
 *     cross-user leak — an attacker can only redirect a checkout they are
 *     themselves completing — but it does put an arbitrary host into a Stripe
 *     session, which is not a thing worth allowing for no benefit.
 *   - `req.nextUrl.origin` reports the address the server is *bound* to, not
 *     the host the user asked for. src/app/auth/callback/route.ts documents
 *     this at length: behind Vercel's proxy it is a good way to hand somebody a
 *     redirect to the wrong origin. That route stopped inferring a host for
 *     exactly this reason; these two should not reintroduce the guess.
 *
 * So the origin is configuration, not something derived from the request.
 *
 * Falls back to VERCEL_PROJECT_PRODUCTION_URL, which Vercel sets automatically,
 * so a deployment that has not had NEXT_PUBLIC_SITE_URL set yet still produces
 * a working absolute URL rather than a broken relative one.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, '')

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelUrl) return `https://${vercelUrl}`

  // Local development. Never reached on a deployment, where at least one of the
  // two variables above is always present.
  return 'http://localhost:3000'
}
