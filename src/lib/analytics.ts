import { after } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * First-party product analytics — the write side.
 *
 * Events go to the `analytics_events` table in the project's own Postgres.
 * There is no vendor SDK, no cookie, and nothing running in the browser: every
 * call below is made by server code in this repo, about work the server just
 * did. That is what keeps /legal/privacy ("We do not run any analytics or
 * tracking on snapExpense") and the cookie banner truthful, and it is why the
 * consent gate in CookieConsentProvider is *not* consulted here — there is no
 * third party to consent to and nothing is stored on the user's device.
 *
 * Read db/analytics_events.sql before adding anything. The short version:
 * `props` records the operation, never the person. No email, no IP, no user
 * agent, no merchant, no receipt total.
 *
 * TWO RULES, BOTH ABSOLUTE
 *
 *   1. Tracking never fails a request. Every path here swallows its errors.
 *      Losing a measurement is a gap in a chart; failing an extraction someone
 *      paid for, because the reporting table was busy, is a real outage caused
 *      by something that was only ever meant to watch.
 *
 *   2. Tracking never delays a response. Writes are scheduled with `after()`,
 *      so they run once the response has been sent. A receipt scan already
 *      makes the user wait on a vision model; it must not also wait on a row
 *      insert nobody is reading in real time.
 */

/**
 * Every event the app records.
 *
 * The union is the point: a typo in a call site becomes a type error rather
 * than a second, near-identical bar on the dashboard that nobody notices for a
 * month. The database column is plain text and does not enforce this — this is
 * the only enforcement there is, which is why new events belong here first.
 */
export type AnalyticsEvent =
  // Receipt pipeline. `receipt_uploaded` is recorded once the request is known
  // to be well-formed and permitted, so it counts real attempts rather than
  // malformed noise; the two outcomes below always follow it.
  | 'receipt_uploaded'
  | 'extraction_succeeded'
  | 'extraction_failed'
  // Written by the `expenses_analytics` trigger, not by this module — saving is
  // a direct browser-to-PostgREST write with no server route to instrument.
  // Listed here so the set of names has one home.
  | 'expense_saved'
  | 'expense_deleted'
  // Limits. Both are product signals, not just operational ones: the first is
  // the free tier doing its job, the second is someone hitting a wall.
  | 'free_quota_exhausted'
  | 'rate_limited'
  // Account lifecycle.
  | 'signed_up'
  | 'signed_in'
  | 'account_deleted'
  // Revenue. Sourced from the Stripe webhook rather than the checkout return
  // page, so a customer who closes the tab on the confirmation screen is still
  // counted — the money moved either way.
  | 'checkout_started'
  | 'subscription_activated'
  | 'subscription_canceled'
  | 'payment_failed'

/**
 * Values allowed in `props`. Deliberately narrow — no nested objects and no
 * arrays, because those are how a whole request body ends up in the analytics
 * table one careless spread at a time.
 */
export type AnalyticsProps = Record<string, string | number | boolean | null>

type TrackOptions = {
  /** Omit for events with no signed-in actor. */
  userId?: string | null
  props?: AnalyticsProps
}

/**
 * The actual insert. Separated from `track` so the scheduling decision and the
 * write are testable apart from each other.
 */
async function writeEvent(
  name: AnalyticsEvent,
  { userId, props }: TrackOptions,
): Promise<void> {
  try {
    const admin = createSupabaseAdmin()
    const { error } = await admin.from('analytics_events').insert({
      name,
      user_id: userId ?? null,
      props: props ?? {},
    })
    // Logged, not thrown. Nothing upstream can do anything useful with it, and
    // by the time this runs the response has already been sent.
    if (error) {
      console.error(`[analytics] failed to record "${name}"`, error.message)
    }
  } catch (err) {
    // createSupabaseAdmin throws when SUPABASE_SERVICE_ROLE_KEY is missing.
    // That is a real misconfiguration, but it is not this module's job to take
    // the request down over it — /api/extract already fails loudly on the same
    // variable for reasons that actually matter.
    console.error(`[analytics] failed to record "${name}"`, err)
  }
}

/**
 * Record an event. Returns immediately; the write happens after the response.
 *
 * Safe to call from Route Handlers, Server Components and Server Functions.
 * Deliberately not async and deliberately returns void — an `await` here would
 * reintroduce exactly the latency this is written to avoid, and making it
 * awaitable is an invitation to do so.
 */
export function track(name: AnalyticsEvent, options: TrackOptions = {}): void {
  try {
    after(() => writeEvent(name, options))
  } catch {
    // `after` throws outside a request scope — in unit tests, and in any script
    // that imports a route handler directly. Falling back to a floating promise
    // keeps those callers working; the catch on the end is what stops it
    // becoming an unhandled rejection, which in Node is fatal by default.
    void writeEvent(name, options).catch(() => {})
  }
}

/**
 * Round a duration into a coarse bucket.
 *
 * Storing the raw millisecond count would be marginally more precise and much
 * more identifying: an exact latency, paired with a timestamp, is close to a
 * fingerprint for a single request. Buckets answer the only question actually
 * being asked — "is extraction getting slower" — and answer it just as well.
 */
export function latencyBucket(ms: number): string {
  if (ms < 1_000) return '<1s'
  if (ms < 2_000) return '1-2s'
  if (ms < 5_000) return '2-5s'
  if (ms < 10_000) return '5-10s'
  if (ms < 30_000) return '10-30s'
  return '>30s'
}

/**
 * Round a byte count the same way and for the same reason.
 */
export function sizeBucket(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 0.5) return '<0.5MB'
  if (mb < 1) return '0.5-1MB'
  if (mb < 2) return '1-2MB'
  if (mb < 5) return '2-5MB'
  return '>5MB'
}
