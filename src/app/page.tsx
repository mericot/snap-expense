import Link from 'next/link'
import { Button, Card, Eyebrow } from '@/components/ui'

/**
 * Landing page — the first thing a logged-out visitor sees.
 *
 * Signed-in visitors never render this: `src/proxy.ts` lists `/` under
 * PUBLIC_ONLY and redirects them to /receipts before anything is sent. There is
 * deliberately no client-side gate here to duplicate it.
 *
 * Structure is five stacked full-bleed sections with alternating white /
 * #f7f7f7 backgrounds. Each section paints its own background edge to edge and
 * centres a 1080px content column inside it, so the colour bands span the
 * viewport while the copy stays within the design's max measure.
 *
 * The prototype's sticky pill nav and its `backdrop-filter` header are
 * scaffolding and are not ported (handoff README; task brief). A non-sticky
 * header also means the "How it works" anchor needs no scroll-margin fixup.
 */

/** Centred 1080px content column. Every section wraps its children in this. */
const CONTENT = 'mx-auto w-full max-w-[1080px]'

/**
 * Header nav links. 44px minimum touch target below the `sm` breakpoint only —
 * above it they collapse back to the designed inline height, matching the same
 * trade-off the Button primitive makes.
 */
const NAV_LINK = 'inline-flex min-h-11 items-center sm:min-h-0'

const STEPS = [
  {
    number: '01',
    title: 'Send it in',
    body: 'Snap a photo, drop a PDF, or forward the email. Whatever is quickest in the moment.',
  },
  {
    number: '02',
    title: 'We read it',
    body: 'Merchant, date, total and sales tax come out automatically. Correct anything we get wrong in one tap.',
  },
  {
    number: '03',
    title: 'Export when asked',
    body: 'A month, a quarter, a year — one CSV your accountant can actually open.',
  },
]

/**
 * These are factual claims, not decoration (handoff README, §1).
 *
 * "Stored in the US / Northern Virginia" must match where receipts actually
 * live — if hosting moves, this copy moves with it. "Every subprocessor listed"
 * is only true once /legal/subprocessors exists; that page is separate work and
 * must ship before this section is public.
 */
const PRIVACY_POINTS = [
  {
    title: 'Stored in the US',
    body: 'Northern Virginia, on servers we control the access to.',
  },
  {
    title: 'Export or delete, any time',
    body: 'Two clicks in Settings, no email to support.',
  },
  {
    title: 'Every subprocessor listed',
    body: 'Who touches your data, and what for, on one page.',
  },
]

export default function Page() {
  return (
    <main className="flex flex-1 flex-col">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ---------------------------------------------------------------- */}
      <header className="border-b border-border bg-surface px-8 py-4">
        <div className={`${CONTENT} flex flex-wrap items-center justify-between gap-3`}>
          {/* Not a link: this *is* the page it would point at. */}
          <span className="text-[17px] font-bold tracking-[-0.01em] text-text">snapExpense</span>

          <nav
            aria-label="Primary"
            className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]"
          >
            <Link href="#how-it-works" className={`${NAV_LINK} text-text-muted hover:text-text`}>
              How it works
            </Link>
            <Link href="/pricing" className={`${NAV_LINK} text-text-muted hover:text-text`}>
              Pricing
            </Link>
            {/* /legal/* does not exist yet — wired as specified so the gap stays
                visible rather than being hidden behind a "#". */}
            <Link href="/legal/privacy" className={`${NAV_LINK} text-text-muted hover:text-text`}>
              Privacy
            </Link>
            <Link href="/login" className={`${NAV_LINK} text-text hover:text-text`}>
              Sign in
            </Link>
            <Button href="/login" size="sm">
              Try it free
            </Button>
          </nav>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-recessed px-8 pt-[72px] pb-16">
        <div
          className={`${CONTENT} flex flex-wrap items-center justify-center gap-12`}
        >
          {/* Copy is first in source order, so the 420px stack lands copy-first
              with no CSS reorder. */}
          <div className="flex min-w-[300px] max-w-[480px] flex-1 flex-col gap-5">
            <h1 className="text-[44px] leading-[1.08] font-bold tracking-[-0.03em] text-pretty text-text">
              Photograph the receipt. We do the rest.
            </h1>

            <p className="text-[17px] leading-[1.55] text-pretty text-text-muted">
              snapExpense reads the merchant, date and total off every receipt you send it, sorts
              them by month, and hands you a clean export when your accountant asks.
            </p>

            {/* px-[22px]: the design's md buttons are 13px vertical / 22px
                horizontal, but the Button primitive's `md` size hardcodes a
                symmetric 13px. Overriding here rather than editing task 00's
                primitive, which five branches share. Flagged in the PR. */}
            <div className="mt-1 flex flex-wrap gap-[10px]">
              <Button href="/login" className="px-[22px]">
                Start free
              </Button>
              <Button href="/pricing" variant="outline" className="px-[22px]">
                See pricing
              </Button>
            </div>

            <p className="text-[13px] text-text-tertiary">
              No card to start · 10 receipts a month on the free plan
            </p>
          </div>

          {/* PLACEHOLDER — must not ship to production.
              A real 4:3 screenshot of the inbox with a receipt open is needed;
              none exists in the handoff. The slot is built at the final aspect
              ratio so dropping the image in is a one-line change. Flagged in
              the PR. */}
          <div className="min-w-[280px] max-w-[440px] flex-1">
            <div
              className="flex aspect-[4/3] items-center justify-center rounded-xl border border-border-strong"
              style={{
                // The prototype's #f0f0f1 / #e8e8ea stripe is approximated with
                // the two nearest tokens rather than adding throwaway hexes to
                // the shared token file for a placeholder that gets deleted.
                backgroundImage:
                  'repeating-linear-gradient(135deg, var(--color-surface-recessed) 0 8px, var(--color-page) 8px 16px)',
              }}
            >
              <span className="rounded-md border border-border-strong bg-surface px-[10px] py-[6px] font-mono text-[12px] text-text-tertiary">
                product shot — inbox with a receipt open
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="bg-surface px-8 py-16">
        <div className={`${CONTENT} flex flex-col gap-8`}>
          {/* Eyebrow has no heading option in its `as` prop, so the real <h2>
              wraps it. Preflight strips heading defaults, so the span carries
              all the styling. Flagged in the PR. */}
          <h2>
            <Eyebrow as="span">How it works</Eyebrow>
          </h2>

          {/* An ordered list: the 01/02/03 numerals are a sequence, so the
              semantics should say so rather than leaving it to the styling. */}
          <ol className="grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-7">
            {STEPS.map(({ number, title, body }) => (
              <li key={number} className="flex flex-col gap-2">
                <span className="text-[13px] text-text-faint tabular-nums">{number}</span>
                <h3 className="text-[17px] font-semibold text-text">{title}</h3>
                <p className="text-[14px] leading-[1.55] text-pretty text-text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Privacy                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-recessed px-8 py-14">
        <div className={`${CONTENT} flex flex-wrap items-center justify-center gap-10`}>
          <div className="flex min-w-[280px] max-w-[420px] flex-1 flex-col gap-[14px]">
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-pretty text-text">
              Your receipts stay yours
            </h2>

            <p className="text-[15px] leading-[1.6] text-pretty text-text-muted">
              Receipts say a lot about a person — where you were, what you bought, who you were
              with. We treat them accordingly. Encrypted at rest, never sold, never used to train
              anything, and gone for good when you delete them.
            </p>

            <Link
              href="/legal/privacy"
              className="inline-flex min-h-11 items-center self-start text-[14px] text-text underline sm:min-h-0"
            >
              Read what we collect and why
            </Link>
          </div>

          {/* padding="none" + p-[22px]: Card's padding scale is 16/20/24px and
              the design calls for 22px. Overridden here rather than widening
              task 00's scale for one caller. */}
          <Card
            radius="panel"
            padding="none"
            className="min-w-[260px] max-w-[380px] flex-1 p-[22px]"
          >
            {/* Term/description pairs, so the title-to-body relationship is in
                the markup and not only in the type scale. */}
            <dl className="flex flex-col gap-4">
              {PRIVACY_POINTS.map(({ title, body }) => (
                <div key={title} className="flex flex-col gap-[3px]">
                  <dt className="text-[13px] font-semibold text-text-title">{title}</dt>
                  <dd className="text-[13px] leading-[1.45] text-pretty text-text-tertiary">
                    {body}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing CTA                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface px-8 py-16">
        <div className={`${CONTENT} flex flex-col items-center gap-[18px] text-center`}>
          <h2 className="max-w-[520px] text-[28px] font-bold tracking-[-0.02em] text-pretty text-text">
            Start with this month&apos;s shoebox
          </h2>

          <p className="max-w-[460px] text-[15px] leading-[1.55] text-pretty text-text-muted">
            Ten receipts free every month, for as long as you like. Upgrade the day it stops being
            enough.
          </p>

          <Button href="/login" className="mt-1 px-[24px]">
            Start free
          </Button>
        </div>
      </section>
    </main>
  )
}
