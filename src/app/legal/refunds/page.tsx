import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy | snapExpense",
  description: "How refunds work for snapExpense paid plans.",
};

const LAST_UPDATED = "August 8, 2026";

export default function RefundsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 font-sans">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            &larr; Back to snapExpense
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
            Refund Policy
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-700">
          <Section title="14-day refund window">
            <p>
              You may request a full refund within 14 days of any charge. This
              applies to your first payment after a trial ends and to every
              subsequent renewal. No questions asked.
            </p>
          </Section>

          <Section title="How to request a refund">
            <p>
              Email{" "}
              <a
                href="mailto:support@snap-expenses.com"
                className="underline hover:text-zinc-900"
              >
                support@snap-expenses.com
              </a>{" "}
              with the email address on your account. We aim to process refund
              requests within 3 business days. Refunds are issued to the
              original payment method.
            </p>
          </Section>

          <Section title="After 14 days">
            <p>
              Refunds are not available after the 14-day window. You may still
              cancel your subscription at any time from Settings. When you
              cancel, your paid features remain active until the end of the
              current billing period. Your data stays accessible and exportable
              after you return to the free plan.
            </p>
          </Section>

          <Section title="What happens to your account">
            <p>
              If a refund is issued, your account reverts to the free plan
              immediately. Any data you created while on a paid plan remains
              yours &mdash; you can still view and export it, subject to
              free-plan limits.
            </p>
          </Section>

          <Section title="Free plan">
            <p>
              The free plan has no charges and therefore no refunds. If you
              believe you were charged in error, contact us and we will
              investigate.
            </p>
          </Section>

          <Section title="Massachusetts consumer rights">
            <p>
              This policy does not limit any rights you may have under
              Massachusetts consumer protection law (M.G.L. c.&nbsp;93A). If
              you believe a charge was unfair or deceptive, you may contact us
              or file a complaint with the Massachusetts Attorney
              General&rsquo;s Office.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Refund questions? Email{" "}
              <a
                href="mailto:support@snap-expenses.com"
                className="underline hover:text-zinc-900"
              >
                support@snap-expenses.com
              </a>
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
