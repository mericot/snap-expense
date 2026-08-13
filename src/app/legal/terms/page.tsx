import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing your use of the snapExpense receipt-tracking service.",
};

const LAST_UPDATED = "August 8, 2026";

export default function TermsPage() {
  return (
    <main className="flex-1 bg-zinc-50 px-4 py-10 font-sans">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            &larr; Back to snapExpense
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
            Terms of Service
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-700">
          <Section title="1. Agreement to terms">
            <p>
              By accessing or using snapExpense (&ldquo;the Service&rdquo;),
              you agree to be bound by these Terms of Service
              (&ldquo;Terms&rdquo;). If you do not agree, do not use the
              Service. snapExpense is operated as a sole proprietorship in
              Boston, Massachusetts (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
              &ldquo;our&rdquo;).
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 13 years old to use the Service. By using
              snapExpense, you represent that you meet this requirement and that
              any information you provide is accurate.
            </p>
          </Section>

          <Section title="3. Accounts">
            <p>
              You sign in with a magic-link email. You are responsible for
              maintaining the security of your email account and for all
              activity that occurs under your snapExpense account. Notify us
              promptly at{" "}
              <a
                href="mailto:support@snap-expenses.com"
                className="underline hover:text-zinc-900"
              >
                support@snap-expenses.com
              </a>{" "}
              if you suspect unauthorized access.
            </p>
          </Section>

          <Section title="4. Free and paid plans">
            <p>
              snapExpense offers a free tier and paid subscription plans. The
              features and limits of each plan are described on our{" "}
              <Link
                href="/pricing"
                className="underline hover:text-zinc-900"
              >
                pricing page
              </Link>
              .
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong>Free plan.</strong> Available at no cost, subject to
                usage limits (currently 10 receipts per month). We may adjust
                free-tier limits with reasonable notice.
              </li>
              <li>
                <strong>Paid plans.</strong> Billed in advance on a recurring
                basis (monthly or annually, depending on the plan selected).
                Prices exclude sales tax, which is added at checkout where
                applicable. All amounts are in US dollars.
              </li>
              <li>
                <strong>Trials.</strong> Paid plans may include a 14-day free
                trial. You will not be charged during the trial period. We will
                email you before the trial ends and your first charge is
                processed.
              </li>
            </ul>
          </Section>

          <Section title="5. Billing and auto-renewal">
            <p>
              Paid subscriptions renew automatically at the end of each billing
              period unless you cancel before renewal. The renewal amount,
              renewal date, and billing interval are shown at checkout and in
              your account settings. You authorize us to charge your payment
              method on file for each renewal.
            </p>
            <p className="mt-2">
              Card details are handled entirely by our payment processor. We
              never see or store your card number.
            </p>
          </Section>

          <Section title="6. Cancellation">
            <p>
              You may cancel your subscription at any time from Settings.
              Cancellation takes effect at the end of the current paid period
              &mdash; you retain access to paid features until then. After
              cancellation, your account reverts to the free plan. Your data
              remains accessible and exportable.
            </p>
          </Section>

          <Section title="7. Refunds">
            <p>
              You may request a full refund within 14 days of any charge. To
              request a refund, email us at{" "}
              <a
                href="mailto:support@snap-expenses.com"
                className="underline hover:text-zinc-900"
              >
                support@snap-expenses.com
              </a>
              . Refunds are processed to the original payment method. See our{" "}
              <Link
                href="/legal/refunds"
                className="underline hover:text-zinc-900"
              >
                refund policy
              </Link>{" "}
              for full details.
            </p>
          </Section>

          <Section title="8. Acceptable use">
            <p>You agree not to:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                Use the Service for any unlawful purpose or to process
                fraudulent documents.
              </li>
              <li>
                Attempt to gain unauthorized access to the Service, other
                accounts, or our systems.
              </li>
              <li>
                Interfere with or disrupt the Service, including by
                circumventing rate limits or security measures.
              </li>
              <li>
                Use automated means (bots, scrapers) to access the Service
                except through our published API, if any.
              </li>
              <li>
                Upload content that is malicious, obscene, or infringes on
                third-party rights.
              </li>
            </ul>
            <p className="mt-2">
              We may suspend or terminate accounts that violate these terms.
            </p>
          </Section>

          <Section title="9. Your content">
            <p>
              You retain ownership of all data you upload, including receipt
              images and expense records (&ldquo;Your Content&rdquo;). By using
              the Service, you grant us a limited license to process Your
              Content solely to provide and improve the Service &mdash; for
              example, sending receipt images to our AI provider for text
              extraction.
            </p>
            <p className="mt-2">
              We do not sell Your Content, use it for advertising, or train AI
              models on your receipts. Receipt images are not retained after
              extraction is complete.
            </p>
          </Section>

          <Section title="10. AI-powered extraction">
            <p>
              snapExpense uses third-party AI services (currently
              Anthropic&rsquo;s Claude) to extract data from receipt images.
              AI-extracted data may contain errors. You are responsible for
              reviewing and correcting extracted values before relying on them
              for financial, tax, or legal purposes. snapExpense is not an
              accounting service and does not provide financial advice.
            </p>
          </Section>

          <Section title="11. Data and privacy">
            <p>
              Our collection and use of personal data is described in our{" "}
              <Link
                href="/legal/privacy"
                className="underline hover:text-zinc-900"
              >
                Privacy Policy
              </Link>
              , which is incorporated into these Terms. You may export or
              delete your data at any time from the app, or request full
              account deletion by contacting us.
            </p>
          </Section>

          <Section title="12. Availability and changes">
            <p>
              We strive to keep the Service available but do not guarantee
              uninterrupted access. We may modify, suspend, or discontinue
              features with reasonable notice. If we make changes that
              materially reduce paid-plan functionality, you may cancel for a
              prorated refund of the unused portion of your current billing
              period.
            </p>
          </Section>

          <Section title="13. Intellectual property">
            <p>
              The Service, its design, code, and branding are owned by
              snapExpense. These Terms do not grant you any rights to our
              trademarks or intellectual property beyond what is needed to use
              the Service.
            </p>
          </Section>

          <Section title="14. Disclaimer of warranties">
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; without warranties of any kind, express or
              implied, including but not limited to merchantability, fitness for
              a particular purpose, and non-infringement. We do not warrant that
              AI extraction results will be accurate or error-free.
            </p>
          </Section>

          <Section title="15. Limitation of liability">
            <p>
              To the maximum extent permitted by law, snapExpense shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits, data, or goodwill,
              arising out of or related to your use of the Service. Our total
              liability for any claim shall not exceed the amount you paid us
              in the 12 months preceding the claim, or $100, whichever is
              greater.
            </p>
          </Section>

          <Section title="16. Consumer protection">
            <p>
              Nothing in these Terms limits your rights under Massachusetts
              consumer protection law (M.G.L. c.&nbsp;93A), which prohibits
              unfair or deceptive business practices. If you believe we have
              engaged in an unfair or deceptive practice, you may contact us
              or file a complaint with the Massachusetts Attorney
              General&rsquo;s Office.
            </p>
          </Section>

          <Section title="17. Governing law">
            <p>
              These Terms are governed by the laws of the Commonwealth of
              Massachusetts, without regard to conflict-of-law principles. Any
              dispute arising from these Terms or the Service shall be resolved
              in the state or federal courts located in Boston, Massachusetts.
            </p>
          </Section>

          <Section title="18. Changes to these terms">
            <p>
              We may update these Terms from time to time. Material changes
              will be communicated via email or a notice in the Service at
              least 30 days before they take effect. Continued use after the
              effective date constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="19. Contact">
            <p>
              Questions about these Terms? Email us at{" "}
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
