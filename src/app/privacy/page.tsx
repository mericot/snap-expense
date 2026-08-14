import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | snapExpense",
  description: "How snapExpense collects, uses, and protects your data.",
};

const LAST_UPDATED = "August 7, 2026";

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-700">
          <Section title="Overview">
            <p>
              snapExpense is a receipt-scanning expense tracker. This policy
              explains what data we collect, why we collect it, and how we
              protect it.
            </p>
          </Section>

          <Section title="Information we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account information.</strong> Your email address, used
                for authentication via a magic-link sign-in.
              </li>
              <li>
                <strong>Expense data.</strong> Merchant name, date, total, tax,
                and category for each receipt you save.
              </li>
              <li>
                <strong>Receipt images.</strong> Photos you upload are processed
                in memory to extract expense data. We do not store your receipt
                images after extraction is complete.
              </li>
              <li>
                <strong>Usage analytics.</strong> We use Vercel Analytics to
                collect anonymous, aggregated usage data such as page views and
                performance metrics. No personally identifiable information is
                collected through analytics.
              </li>
            </ul>
          </Section>

          <Section title="How we use your data">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Authentication.</strong> Your email is used solely to
                sign you in and associate your expenses with your account. We
                use Supabase for authentication and data storage.
              </li>
              <li>
                <strong>Receipt processing.</strong> Uploaded receipt images are
                sent to Anthropic&rsquo;s API (Claude) for text extraction.
                Images are processed in real time and are not retained by
                snapExpense after the response is returned. Anthropic&rsquo;s
                data handling is governed by their own{" "}
                <a
                  href="https://www.anthropic.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-zinc-900"
                >
                  privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Expense storage.</strong> Extracted expense data is
                stored in our database so you can view, edit, export, and delete
                your expenses.
              </li>
            </ul>
          </Section>

          <Section title="Third-party services">
            <p>We rely on the following third-party services:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong>Supabase</strong> &mdash; authentication and database
                hosting.
              </li>
              <li>
                <strong>Anthropic (Claude)</strong> &mdash; AI-powered receipt
                text extraction.
              </li>
              <li>
                <strong>Vercel</strong> &mdash; application hosting and
                analytics.
              </li>
            </ul>
            <p className="mt-2">
              Each service processes data according to their own privacy
              policies. We only share the minimum data necessary for each
              service to function.
            </p>
          </Section>

          <Section title="Data retention and deletion">
            <p>
              Your expense data is retained for as long as you maintain an
              account. You can delete individual expenses at any time from the
              app. To request full account deletion and removal of all
              associated data, contact us at the email below.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use industry-standard measures to protect your data, including
              encrypted connections (HTTPS), secure authentication tokens, and
              rate limiting on API endpoints. However, no method of
              transmission or storage is 100% secure.
            </p>
          </Section>

          <Section title="Children">
            <p>
              snapExpense is not directed at children under 13. We do not
              knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. Changes will be
              reflected on this page with an updated date. Continued use of
              snapExpense after changes constitutes acceptance of the revised
              policy.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For privacy questions, data access requests, or account
              deletion, email us at{" "}
              <a
                href="mailto:mericot.merit@gmail.com"
                className="underline hover:text-zinc-900"
              >
                mericot.merit@gmail.com
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
