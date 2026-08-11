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
    // Was: "Download or wipe everything from Settings, any time."
    //
    // Half right. Wiping is in Settings; downloading is not — Export CSV lives
    // on the receipts list (src/app/receipts/page.tsx, exportCSV at ~259 and
    // the button at ~319). Anyone who took the sentence literally went to
    // Settings looking for a download that was never there.
    title: 'Your data, exportable',
    body: 'Export to CSV from your receipts. Wipe everything from Settings, any time.',
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

        {/* Two badges removed 2026-08-10, acting on the instruction the previous
            comment here left: "An unearned compliance badge is worse than no
            badge."

            "SOC 2 in progress" — gone. It asserts an audit is underway, which
            is the strongest claim on this page and the one nothing in the
            repository substantiates. If an audit genuinely is in progress this
            is a one-line restore, and it should come back as "SOC 2 Type II"
            once it resolves. Leaving it up on the chance that it is true is the
            wrong way round for a compliance claim.

            "GDPR" — gone, on the old comment's own condition that it "stays
            only while actually serving EU users". lib/plans.ts is explicit that
            this is a US entity selling to US customers, and even scopes the
            refund window on that basis. Restore it if and when you sell into
            the EU, alongside the DPA obligations that come with it.

            "CCPA/CPRA" stays. It is the one of the three backed by something
            real: California residents are plausible among US customers, and the
            access and deletion rights it implies are actually implemented —
            self-serve export from the receipts list, self-serve account
            deletion in Settings, both working as of this branch. */}
        <div className="flex flex-wrap gap-2">
          <Badge>CCPA/CPRA</Badge>
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
