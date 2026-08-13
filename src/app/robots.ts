import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * robots.txt.
 *
 * Everything behind a sign-in is disallowed. Not as a security control — the
 * proxy and RLS do that, and a crawler cannot reach any of it without a session
 * anyway — but because these paths are worthless in an index and a couple of
 * them are actively bad to have there: `/checkout/return` carries a Stripe
 * session id in its query string, and `/auth/callback` carries a single-use
 * code.
 *
 * `/checkout` already sets `robots: { index: false }` in its own metadata. Both
 * are kept: page-level metadata governs a page that gets crawled, this governs
 * whether it is fetched at all, and they are cheap to state twice.
 *
 * `/admin` is listed for tidiness rather than protection, and is the one entry
 * here with a genuine trade-off: naming a path in robots.txt is publishing it,
 * and this file is world-readable. It is listed anyway because the page 404s
 * for everyone who is not the owner, so knowing the URL buys nothing — whereas
 * an analytics dashboard turning up in a search index would be a real problem.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/receipts', '/settings', '/checkout', '/auth/', '/api/', '/admin'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
