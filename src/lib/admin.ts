/**
 * Who may see the analytics dashboard.
 *
 * There is no admin flag in the database and this deliberately does not add
 * one. A column is a thing that can be flipped by anything holding the service
 * role, and the entire population of admins here is "the person who owns the
 * business" — an environment variable is both simpler and harder to change by
 * accident, and changing it requires access to Vercel rather than to Postgres.
 *
 * Matched on email rather than user id. Supabase only ever puts a verified
 * address on a session — the whole sign-in flow is a magic link, so possession
 * of the inbox is proven before a session exists — and an id means finding a
 * UUID in a dashboard and pasting it somewhere without typos. Emails are what
 * anyone configuring this actually knows.
 */

/**
 * FAILS CLOSED. An unset or empty variable admits nobody, including in
 * development.
 *
 * The tempting alternative — "allow everyone when unset, so it works locally" —
 * is a single missing environment variable away from publishing the entire
 * business's numbers to every signed-in user in production. This way the
 * failure mode is a 404 for the owner, which is noticed immediately and fixed
 * by setting the variable.
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false

  const configured = process.env.ANALYTICS_ADMIN_EMAILS
  if (!configured) return false

  // Addresses are compared lowercased: Supabase stores what the user typed, and
  // an owner who requested their link as `Me@Example.com` should not be locked
  // out by the case of a letter.
  //
  // Whitespace is stripped per entry rather than trimmed off the whole string,
  // because the realistic way this variable gets written is a list pasted with
  // ", " separators or, on Vercel specifically, one that arrives carrying
  // newlines — the failure mode src/lib/env.ts exists for.
  const allowed = configured
    .split(',')
    .map((entry) => entry.replace(/\s+/g, '').toLowerCase())
    .filter(Boolean)

  return allowed.includes(email.replace(/\s+/g, '').toLowerCase())
}
