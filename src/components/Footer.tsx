import Link from 'next/link'
import CookieSettingsButton from './CookieSettingsButton'
import { Badge } from './ui'

/**
 * Global trust footer — appears on every screen.
 *
 * The four statements in band 1 are commitments, not marketing. If any becomes
 * untrue (an analytics vendor that profiles, a model trained on receipt text, a
 * longer backup window) the footer changes with it. The copy is legally
 * reviewed: reproduce it exactly, do not "improve" the wording.
 */

const STATEMENTS = [
  {
    // Was: "Encrypted at rest. Deleted 30 days after you delete the expense."
    //
    // That described storage the app does not do. Receipt images are posted to
    // /api/extract, read once, and discarded — they are never written anywhere,
    // so there was nothing to encrypt at rest and nothing to delete after 30
    // days. The claim was false in the app's own favour, which is the worse
    // direction for a statement in a trust footer.
    //
    // What replaces it is both true and a stronger commitment. If image storage
    // ever ships, this is the first line that has to change.
    title: 'Receipt images',
    body: 'Read once to pull out the total, then discarded. We never store the image.',
  },
  {
    title: 'Never sold',
    body: 'No ad networks, no data brokers, no training on your receipts.',
  },
  {
    title: 'Your data, exportable',
    body: 'Download or wipe everything from Settings, any time.',
  },
  {
    title: 'Payments',
    body: 'Processed by our payment provider. We never store card numbers.',
  },
]

// All /legal/* routes linked below now exist. (This comment used to say they
// did not; they were built out since, and /legal/retention was the last gap —
// it was linked from the retention notice on /receipts while 404ing.)

// #71717a on #fafafa measures 4.63:1 — passes WCAG AA for 12px text. The
// previous footer used #a1a1aa here, which is 2.46:1 and fails.
const LINK_CLASS = 'text-text-tertiary no-underline hover:text-text'

export default function Footer() {
  return (
    <footer className="flex flex-col gap-[18px] border-t border-border bg-surface-sunken p-6">
      {/* Band 1 — data-handling statements */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {STATEMENTS.map(({ title, body }) => (
          <div key={title} className="flex flex-col gap-1">
            <div className="text-[12px] font-semibold text-text-title">{title}</div>
            <div className="text-[12px] leading-[1.45] text-text-tertiary text-pretty">{body}</div>
          </div>
        ))}
      </div>

      {/* Band 2 — legal links and compliance chips */}
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-4 gap-y-[6px] text-[12px]"
        >
          <Link href="/legal/privacy" className={LINK_CLASS}>
            Privacy
          </Link>
          <Link href="/legal/terms" className={LINK_CLASS}>
            Terms
          </Link>
          <Link href="/legal/refunds" className={LINK_CLASS}>
            Refunds
          </Link>
          <Link href="/legal/retention" className={LINK_CLASS}>
            Retention
          </Link>
          {/* "Cookies" sits in link order but is a control, not a destination. */}
          <CookieSettingsButton className={`cursor-pointer ${LINK_CLASS}`} />
          <Link href="/legal/dpa" className={LINK_CLASS}>
            DPA
          </Link>
          <Link href="/legal/subprocessors" className={LINK_CLASS}>
            Subprocessors
          </Link>
          <Link href="/legal/contact" className={LINK_CLASS}>
            Contact
          </Link>
        </nav>

        {/* CCPA/CPRA applies if serving California residents. GDPR stays only
            while actually serving EU users. "SOC 2 in progress" must come down
            or become "SOC 2 Type II" once the audit resolves. An unearned
            compliance badge is worse than no badge. */}
        <div className="flex flex-wrap gap-2">
          <Badge>CCPA/CPRA</Badge>
          <Badge>GDPR</Badge>
          <Badge>SOC 2 in progress</Badge>
        </div>
      </div>

      {/* Band 3 — entity line. Literal, not `new Date().getFullYear()`: this
          route is statically prerendered, so a computed year would freeze at
          build time and quietly go stale. */}
      <div className="text-[12px] text-text-faint">
        © 2026 snapExpense · Boston, MA
      </div>
    </footer>
  )
}
