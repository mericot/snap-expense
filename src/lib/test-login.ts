import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * The gate in front of /api/test-login — the one address that can sign in
 * without a magic link.
 *
 * Everything about whether the bypass exists at all is decided here, so there
 * is exactly one place to read when the question is "can this be used against
 * production?". The route handler does the sign-in; this file decides whether
 * it is allowed to.
 *
 * Three independent conditions have to hold, and any one of them failing turns
 * the endpoint into a 404:
 *
 * 1. `TEST_LOGIN_EMAIL` is set. Only this address can be signed into. It is not
 *    a pattern or a domain — an exact address, compared case-insensitively.
 * 2. `TEST_LOGIN_SECRET` is set and long enough to not be guessable.
 * 3. The deployment is not production.
 *
 * (1) and (2) are the real control: an environment that does not have these
 * variables has no bypass, in the same way it has no Stripe key. (3) is the
 * belt to that pair of braces — it means pasting the variables into the wrong
 * Vercel environment is a dud rather than a live account bypass.
 *
 * Server-only. `TEST_LOGIN_SECRET` must never be given a NEXT_PUBLIC_ prefix or
 * it ships in the browser bundle and the bypass becomes public. The login page
 * knows `NEXT_PUBLIC_TEST_LOGIN_EMAIL` (harmless — an address with no secret
 * opens nothing) and asks the tester to type the secret.
 */

/**
 * 32 characters of `openssl rand -base64 24`. Short enough to paste, long
 * enough that the online brute force this is exposed to is not worth modelling.
 * A too-short secret disables the bypass rather than weakening it — a
 * misconfiguration should fail closed and loudly, not quietly accept `test123`.
 */
const MIN_SECRET_LENGTH = 32

export type TestLoginConfig = {
  /** Lower-cased. The only address the bypass will sign in. */
  email: string
  secret: string
}

/**
 * Vercel sets this to `production` only for the production deployment; previews
 * get `preview` and `next dev` gets nothing at all. Self-hosted builds set
 * nothing either, which is why this is the third check and not the first.
 */
function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production'
}

/**
 * `null` means the bypass does not exist here. Callers must treat that as
 * "route not found", not as "unauthorized" — see the route handler.
 */
export function testLoginConfig(): TestLoginConfig | null {
  if (isProductionDeployment()) return null

  const email = process.env.TEST_LOGIN_EMAIL?.trim().toLowerCase()
  const secret = process.env.TEST_LOGIN_SECRET

  if (!email || !secret) return null

  if (secret.length < MIN_SECRET_LENGTH) {
    // Deliberately noisy. The failure mode this prevents is someone setting a
    // weak secret, seeing a 404, and assuming the feature is broken rather than
    // refusing them.
    console.error(
      `TEST_LOGIN_SECRET is ${secret.length} characters; ${MIN_SECRET_LENGTH} is the minimum. The test-login route is disabled.`,
    )
    return null
  }

  return { email, secret }
}

/**
 * Constant-time secret comparison.
 *
 * `timingSafeEqual` throws on length-mismatched buffers, and the lengths are
 * themselves worth not leaking, so both sides are hashed to a fixed 32 bytes
 * first and the digests are compared. This is the standard shape; the hash is
 * not doing any security work of its own here.
 */
export function secretMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false
  return timingSafeEqual(sha256(expected), sha256(given))
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest()
}

export function emailMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false
  return given.trim().toLowerCase() === expected
}
