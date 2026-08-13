import type { Metadata } from 'next'

/**
 * Metadata carrier for /legal/contact.
 *
 * The page itself is a client component and so cannot export `metadata` —
 * without this it inherited the root title and appeared in search results as
 * plain "snapExpense", like every other page. It is linked from the global
 * footer and listed in the sitemap, so it is a page strangers actually reach.
 *
 * Renders its children unchanged; it exists only to carry the export.
 */
export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach snapExpense for support, privacy, and billing questions.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
