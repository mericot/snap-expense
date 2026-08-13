"use client";

import Link from "next/link";
import { useState } from "react";

const CATEGORIES = [
  { value: "general", label: "General inquiry" },
  { value: "billing", label: "Billing" },
  { value: "privacy", label: "Privacy" },
  { value: "account-deletion", label: "Account deletion" },
  { value: "dpa", label: "DPA request" },
] as const;

const CONTACT_EMAIL = "support@snap-expenses.com";

const SUBJECT_PREFIX: Record<string, string> = {
  general: "[snapExpense] General inquiry",
  billing: "[snapExpense] Billing inquiry",
  privacy: "[snapExpense] Privacy request",
  "account-deletion": "[snapExpense] Account deletion request",
  dpa: "[snapExpense] DPA request",
};

export default function ContactPage() {
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const subject = SUBJECT_PREFIX[category] ?? "[snapExpense] Contact";
  const body = `Name: ${name}\nEmail: ${email}\nCategory: ${CATEGORIES.find((c) => c.value === category)?.label ?? ""}\n\n${message}`;
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const isValid = category && name.trim() && email.trim() && message.trim();

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
            Contact Us
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Fill out the form below and your email client will open with
            everything pre-filled.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid) window.location.href = mailtoHref;
          }}
          className="space-y-5 rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-sm"
        >
          <Field label="Category">
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none"
            >
              <option value="" disabled>
                Select a category
              </option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </Field>

          <Field label="Message">
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              rows={5}
              className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </Field>

          {category === "account-deletion" && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              Account deletion is permanent. Before requesting deletion, you
              may want to{" "}
              <Link
                href="/"
                className="underline hover:text-amber-900"
              >
                export your data
              </Link>{" "}
              from the app. We will process your request within 30 days.
            </p>
          )}

          {category === "dpa" && (
            <p className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
              DPAs are available for customers on a paid plan. Please include your
              organization name and any specific requirements. You can review
              our standard DPA at{" "}
              <Link
                href="/legal/dpa"
                className="underline hover:text-blue-900"
              >
                /legal/dpa
              </Link>
              .
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open in email client
          </button>

          <p className="text-center text-xs text-zinc-400">
            Or email us directly at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline hover:text-zinc-600"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </form>

        <div className="space-y-4 text-sm text-zinc-700">
          <Section title="Response times">
            <p>
              We aim to respond within 2 business days. Account deletion and
              privacy requests are processed within 30 days as required by
              Massachusetts law (M.G.L. c.&nbsp;93H).
            </p>
          </Section>

          <Section title="Other resources">
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link
                  href="/legal/privacy"
                  className="underline hover:text-zinc-900"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="underline hover:text-zinc-900"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/refunds"
                  className="underline hover:text-zinc-900"
                >
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/dpa"
                  className="underline hover:text-zinc-900"
                >
                  Data Processing Agreement
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/subprocessors"
                  className="underline hover:text-zinc-900"
                >
                  Subprocessors
                </Link>
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
    </div>
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
