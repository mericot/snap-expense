import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Processing Agreement | snapExpense",
  description:
    "Data Processing Agreement for snapExpense Team plan customers.",
};

const LAST_UPDATED = "August 8, 2026";

export default function DpaPage() {
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
            Data Processing Agreement
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-700">
          <Section title="1. Introduction">
            <p>
              This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of
              the{" "}
              <Link
                href="/legal/terms"
                className="underline hover:text-zinc-900"
              >
                Terms of Service
              </Link>{" "}
              between snapExpense (&ldquo;Processor&rdquo;) and the
              organization subscribing to a Team plan
              (&ldquo;Controller&rdquo;). It applies when snapExpense processes
              personal data on behalf of the Controller.
            </p>
          </Section>

          <Section title="2. Definitions">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Personal Data</strong> means any information relating
                to an identified or identifiable natural person uploaded to or
                processed by the Service.
              </li>
              <li>
                <strong>Processing</strong> means any operation performed on
                Personal Data, including collection, storage, retrieval,
                extraction, use, disclosure, and deletion.
              </li>
              <li>
                <strong>Sub-processor</strong> means a third party engaged by
                the Processor to process Personal Data on behalf of the
                Controller.
              </li>
              <li>
                <strong>Data Subject</strong> means the individual to whom
                Personal Data relates.
              </li>
            </ul>
          </Section>

          <Section title="3. Scope of processing">
            <p>
              snapExpense processes Personal Data solely to provide the Service
              as described in the Terms. The categories of data processed
              include:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong>Account data.</strong> Email addresses of team members
                for authentication.
              </li>
              <li>
                <strong>Expense data.</strong> Merchant names, dates, amounts,
                tax figures, and categories.
              </li>
              <li>
                <strong>Receipt images.</strong> Processed in real time for
                data extraction; not retained after extraction is complete.
              </li>
            </ul>
            <p className="mt-2">
              Data subjects are the Controller&rsquo;s employees and authorized
              users of the Service.
            </p>
          </Section>

          <Section title="4. Processor obligations">
            <p>snapExpense shall:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                Process Personal Data only on documented instructions from the
                Controller, unless required by law.
              </li>
              <li>
                Ensure that persons authorized to process Personal Data are
                bound by confidentiality obligations.
              </li>
              <li>
                Implement appropriate technical and organizational measures to
                protect Personal Data, including encryption in transit (HTTPS)
                and at rest, access controls, and rate limiting.
              </li>
              <li>
                Not engage a Sub-processor without prior notice to the
                Controller. Current Sub-processors are listed on our{" "}
                <Link
                  href="/legal/subprocessors"
                  className="underline hover:text-zinc-900"
                >
                  Subprocessors page
                </Link>
                .
              </li>
              <li>
                Assist the Controller in responding to Data Subject requests
                (access, correction, deletion, portability) to the extent
                technically feasible.
              </li>
              <li>
                Notify the Controller without undue delay (and in any event
                within 72 hours) upon becoming aware of a Personal Data breach,
                and cooperate in breach response. We will also notify the
                Massachusetts Attorney General&rsquo;s Office as required by
                M.G.L. c.&nbsp;93H.
              </li>
              <li>
                Make available to the Controller all information necessary to
                demonstrate compliance with this DPA, and allow for and
                contribute to audits and inspections upon reasonable request.
              </li>
            </ul>
          </Section>

          <Section title="5. Controller obligations">
            <p>The Controller shall:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                Ensure it has a lawful basis for providing Personal Data to
                snapExpense.
              </li>
              <li>
                Provide processing instructions that comply with applicable
                data protection laws.
              </li>
              <li>
                Notify snapExpense promptly of any Data Subject requests it
                cannot fulfill independently.
              </li>
            </ul>
          </Section>

          <Section title="6. Sub-processors">
            <p>
              snapExpense uses the Sub-processors listed on our{" "}
              <Link
                href="/legal/subprocessors"
                className="underline hover:text-zinc-900"
              >
                Subprocessors page
              </Link>
              . We will notify the Controller at least 30 days before adding or
              replacing a Sub-processor. If the Controller reasonably objects to
              a new Sub-processor, either party may terminate the affected
              Service with a prorated refund.
            </p>
            <p className="mt-2">
              Each Sub-processor is bound by data protection obligations no
              less protective than those in this DPA.
            </p>
          </Section>

          <Section title="7. International transfers">
            <p>
              Personal Data is stored and processed in the United States. If
              the Controller is subject to GDPR or other international data
              protection laws, we will cooperate to put in place appropriate
              transfer mechanisms (such as Standard Contractual Clauses) upon
              request.
            </p>
          </Section>

          <Section title="8. Data retention and deletion">
            <p>
              We retain Personal Data for as long as the Controller maintains
              an active account. Upon termination of the Service or upon the
              Controller&rsquo;s written request, we will delete all Personal
              Data within 30 days, except where retention is required by law.
              The Controller may export all data at any time before deletion.
            </p>
          </Section>

          <Section title="9. Security measures">
            <p>snapExpense maintains the following security measures:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Encryption of data in transit (TLS/HTTPS).</li>
              <li>Encryption of data at rest.</li>
              <li>
                Authentication via secure, token-based magic links (no
                passwords stored).
              </li>
              <li>Rate limiting on API endpoints.</li>
              <li>
                Access controls limiting personnel access to Personal Data on a
                need-to-know basis.
              </li>
              <li>
                A written information security program as required by
                201&nbsp;CMR&nbsp;17.00.
              </li>
            </ul>
          </Section>

          <Section title="10. Liability">
            <p>
              Each party&rsquo;s liability under this DPA is subject to the
              limitations set out in the{" "}
              <Link
                href="/legal/terms"
                className="underline hover:text-zinc-900"
              >
                Terms of Service
              </Link>
              .
            </p>
          </Section>

          <Section title="11. Term and termination">
            <p>
              This DPA takes effect when the Controller subscribes to a Team
              plan and remains in effect for the duration of the subscription.
              Obligations relating to data deletion, confidentiality, and
              breach notification survive termination.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              This DPA is governed by the laws of the Commonwealth of
              Massachusetts. Any dispute shall be resolved in the state or
              federal courts located in Boston, Massachusetts.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              To execute this DPA, request modifications, or ask questions,
              email{" "}
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
