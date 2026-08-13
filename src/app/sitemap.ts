import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * sitemap.xml.
 *
 * Only the pages a stranger can actually open: the landing page, pricing, and
 * the legal set. Signed-in routes are excluded here for the same reason they are
 * disallowed in robots.ts.
 *
 * `/login` is deliberately absent. It is reachable without a session, but a
 * sign-in form is not a search result anyone wants, and indexing it competes
 * with the landing page for the brand query.
 *
 * Listed explicitly rather than globbed off the filesystem. A sitemap is a
 * claim about which pages are worth indexing, and that is an editorial decision
 * — deriving it from the route tree would silently add every future page,
 * including ones added for a campaign and meant to stay unlisted.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const lastModified = new Date()

  return [
    { url: base, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/legal/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/refunds`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/retention`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/dpa`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/legal/subprocessors`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/legal/contact`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
