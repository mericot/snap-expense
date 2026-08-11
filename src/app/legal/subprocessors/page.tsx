import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subprocessors",
  description:
    "Third-party subprocessors that process data on behalf of snapExpense.",
};

const LAST_UPDATED = "August 8, 2026";

type Subprocessor = {
  name: string;
  purpose: string;
  dataProcessed: string;
  location: string;
};

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase, Inc.",
    purpose: "Authentication and database hosting",
    dataProcessed:
      "Email addresses, expense records (merchant, date, total, tax, category)",
    location: "United States",
  },
  {
    name: "Anthropic, PBC",
    purpose: "AI-powered receipt text extraction",
    dataProcessed:
      "Receipt images (processed in real time, not retained after extraction)",
    location: "United States",
  },
  {
    // Analytics was listed here and in the privacy policy, but no analytics
    // service is installed — nothing imports one and no such cookie is ever
    // set. Disclosing processing that does not happen is still an inaccurate
    // disclosure, so the claim is gone rather than left as a safe overstatement.
    // Re-add it, in both places, if and when analytics actually ships.
    name: "Vercel, Inc.",
    purpose: "Application hosting",
    dataProcessed:
      "Request metadata required to serve the application (IP address, user agent).",
    location: "United States",
  },
  {
    // Stripe was absent from this list and from the privacy policy while being
    // the processor handling every payment — the most significant omission of
    // the three.
    name: "Stripe, Inc.",
    purpose: "Subscription billing and payment processing",
    dataProcessed:
      "Email address, billing address, payment card details (entered directly with Stripe; never transmitted to or stored by snapExpense)",
    location: "United States",
  },
];

export default function SubprocessorsPage() {
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
            Subprocessors
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-700">
          <p>
            snapExpense uses the following third-party subprocessors to provide
            the Service. Each subprocessor is bound by data protection
            obligations consistent with our{" "}
            <Link
              href="/legal/dpa"
              className="underline hover:text-zinc-900"
            >
              Data Processing Agreement
            </Link>
            .
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                  <th className="py-3 pr-4">Subprocessor</th>
                  <th className="py-3 pr-4">Purpose</th>
                  <th className="py-3 pr-4">Data processed</th>
                  <th className="py-3">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {SUBPROCESSORS.map((sp) => (
                  <tr key={sp.name}>
                    <td className="py-3 pr-4 font-medium text-zinc-900">
                      {sp.name}
                    </td>
                    <td className="py-3 pr-4">{sp.purpose}</td>
                    <td className="py-3 pr-4">{sp.dataProcessed}</td>
                    <td className="py-3">{sp.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Section title="Changes to subprocessors">
            <p>
              As described in our{" "}
              <Link
                href="/legal/dpa"
                className="underline hover:text-zinc-900"
              >
                Data Processing Agreement
              </Link>
              , we will notify customers on a paid plan at least 30 days before
              adding or replacing a subprocessor. If you reasonably object to a
              new subprocessor, either party may terminate the affected Service
              with a prorated refund.
            </p>
            <p className="mt-2">
              This page is updated whenever a subprocessor is added, removed,
              or replaced.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about our subprocessors? Email{" "}
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
