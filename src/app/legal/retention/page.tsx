import type { Metadata } from "next";
import Link from "next/link";

/**
 * Retention policy.
 *
 * This page was linked from the retention notice on /receipts long before it
 * existed, so every user who followed that link got a 404. It exists now.
 *
 * The first draft of this page repeated the product's "30 days in encrypted
 * backups" line. That was checked against the real project and it is false: the
 * Supabase organisation is on the free plan, which gets no customer-accessible
 * daily backups at all — Supabase's own docs tell free-tier projects to export
 * their data themselves. Thirty days is the Enterprise retention ceiling. Pro
 * is seven days, Team fourteen.
 *
 * So no backup window is stated here. Deletion is described as what it actually
 * is, and the residual-copies paragraph is deliberately unquantified rather
 * than carrying a number nobody can stand behind. Revisit if a paid plan or
 * point-in-time recovery is ever enabled — then a real figure exists and this
 * page and src/app/receipts/RetentionNotice.tsx change together.
 */

export const metadata: Metadata = {
  title: "Data Retention",
  description:
    "What snapExpense stores, what it never stores, and how long anything is kept.",
};

const LAST_UPDATED = "August 10, 2026";

export default function RetentionPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 font-sans">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600">
            &larr; Back to snapExpense
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
            Data Retention
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-700">
          <Section title="Receipt images are never stored">
            <p>
              When you scan a receipt, the image is sent to our extraction
              service, read once to pull out the merchant, date, total, tax, and
              category, and then discarded. It is not written to our database,
              not placed in object storage, and not included in any backup.
              There is no copy of it to delete later, because no copy is kept.
            </p>
          </Section>

          <Section title="What we do keep">
            <p>
              We keep the details read from the receipt &mdash; merchant, date,
              total, tax, and category &mdash; because those are your expense
              records and the product would not work without them. We also keep
              your email address, which is how you sign in, and your
              subscription status.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Expense records stay for as long as your account exists. When you
              delete an expense, it is removed straight away. We do not keep a
              separate archive of deleted records, and we have no way to restore
              one for you once it is gone.
            </p>
          </Section>

          <Section title="Deleting your account">
            <p>
              You can delete your account yourself, at any time, from Settings.
              Doing so cancels any active subscription, then permanently removes
              your expense records, your subscription record, and your sign-in
              account. This is immediate and cannot be undone.
            </p>
          </Section>

          <Section title="Residual copies">
            <p>
              Deleted data may persist briefly in the routine operational
              systems of our database provider &mdash; transaction logs and
              similar &mdash; before being overwritten in the normal course of
              running a database. This is not an archive we can search, restore
              from, or retrieve anything out of, and we do not use it to recover
              deleted records.
            </p>
          </Section>

          <Section title="Payment records">
            <p>
              Payment and invoice records are held by our payment provider,
              Stripe, and are retained under their policies and the record
              keeping periods that tax and accounting rules require. Deleting
              your snapExpense account does not delete those records, and we
              cannot delete them on your behalf.
            </p>
          </Section>

          <Section title="Questions or requests">
            <p>
              For any question about what we hold, or to request deletion of
              something not covered above, email{" "}
              <a
                href="mailto:support@snap-expenses.com"
                className="underline hover:text-zinc-900"
              >
                support@snap-expenses.com
              </a>
              . See also our{" "}
              <Link href="/legal/privacy" className="underline hover:text-zinc-900">
                privacy policy
              </Link>
              .
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}
