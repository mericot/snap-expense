import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/admin'
import { Card, Eyebrow, cx } from '@/components/ui'

/**
 * The read side of first-party analytics.
 *
 * Server component, service role, no client JavaScript. Everything on the page
 * is aggregated in Postgres by the functions in db/analytics_events.sql — see
 * the note there about why counting rows in the page would not survive contact
 * with real volume.
 *
 * NOT LINKED FROM ANYWHERE, on purpose. There is no nav entry and no button;
 * the owner types the URL. A link in the app shell would be rendered for every
 * signed-in user and would tell all of them the page exists.
 */

export const metadata: Metadata = {
  title: 'Analytics',
  // Belt and braces with the robots.txt disallow. This one governs a page that
  // has somehow been crawled; that one governs whether it is fetched at all.
  robots: { index: false, follow: false },
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

const DEFAULT_RANGE = 30

type Totals = { name: string; event_count: number; unique_users: number }
type DailyCount = { day: string; name: string; event_count: number }
type Funnel = {
  uploaded: number
  succeeded: number
  failed: number
  saved: number
  quota_blocked: number
  rate_limited: number
}

/** Percentage of `whole`, rendered as text. Guards the empty database, where every denominator is zero. */
function share(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

/**
 * Fetch the three aggregates for a window ending now.
 *
 * Deliberately a plain async function rather than inline in the component.
 * "Now" is non-deterministic, and reading it during render is a real mistake in
 * this version of React — it is what the `react-hooks/purity` rule exists to
 * catch, because a value that changes between renders of the same output is how
 * a prerendered page ends up permanently frozen at build time. `connection()`
 * is the sanctioned way to say "this needs a real request first"; out here, the
 * clock is read at request time and the component stays pure.
 */
async function loadAnalytics(days: number) {
  await connection()

  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000
  const since = new Date(sinceMs).toISOString()
  const admin = createSupabaseAdmin()

  // Three independent queries, so they go together rather than in series.
  const [totals, daily, funnel] = await Promise.all([
    admin.rpc('analytics_event_totals', { p_since: since }),
    admin.rpc('analytics_daily_counts', { p_since: since }),
    admin.rpc('analytics_extraction_funnel', { p_since: since }),
  ])

  const dailyRows = (daily.data ?? []) as DailyCount[]

  return {
    totals: (totals.data ?? []) as Totals[],
    uploads: fillDailySeries(dailyRows, 'receipt_uploaded', sinceMs),
    funnel: ((funnel.data as Funnel[] | null)?.[0] ?? {
      uploaded: 0,
      succeeded: 0,
      failed: 0,
      saved: 0,
      quota_blocked: 0,
      rate_limited: 0,
    }) as Funnel,
    error: totals.error ?? daily.error ?? funnel.error,
  }
}

/**
 * One point per calendar day over the whole window, zeros included.
 *
 * `analytics_daily_counts` only returns days that have events, and a chart
 * that drops empty days renders them as adjacency — a week-long outage would
 * be invisible, which is precisely the week the chart exists to show. UTC
 * throughout, matching the `date_trunc` in the SQL.
 */
function fillDailySeries(
  rows: DailyCount[],
  name: string,
  sinceMs: number,
): { day: string; count: number }[] {
  const DAY_MS = 24 * 60 * 60 * 1000
  const counts = new Map(
    rows.filter((row) => row.name === name).map((row) => [row.day, row.event_count]),
  )

  // Truncate both endpoints to their UTC date, the same day boundary the rows
  // use, so the partial first day still gets its bar.
  const first = Date.parse(new Date(sinceMs).toISOString().slice(0, 10))
  const last = Date.parse(new Date().toISOString().slice(0, 10))

  const series: { day: string; count: number }[] = []
  for (let t = first; t <= last; t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10)
    series.push({ day, count: counts.get(day) ?? 0 })
  }
  return series
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 404, not 403. A 403 confirms the route exists and that the only thing
  // missing is being the right person, which is a fact worth not publishing.
  // `notFound()` makes the page indistinguishable from a typo for everyone
  // else — including signed-out visitors, since `user` is null for them and
  // isAdminEmail fails closed on undefined.
  if (!isAdminEmail(user?.email)) {
    notFound()
  }

  const params = await searchParams
  const requested = Number(params.range)
  // Any junk in the query string falls back to the default rather than
  // producing an invalid interval — `?range=abc` should show a dashboard, not
  // an error.
  const days = RANGES.some((r) => r.days === requested) ? requested : DEFAULT_RANGE

  const { totals, uploads, funnel, error: failed } = await loadAnalytics(days)

  if (failed) {
    // Shown rather than thrown. The overwhelmingly likely cause is that
    // db/migrations/2026-08-13-analytics-events.sql has not been run against
    // this environment yet, and saying so beats a generic error page — this is
    // a page only the owner can reach, so the detail is safe here.
    return (
      <Shell days={days}>
        <Card padding="lg">
          <p className="text-sm text-danger">Could not load analytics: {failed.message}</p>
          <p className="mt-2 text-sm text-text-tertiary">
            If this is the first deploy of this feature, run{' '}
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-[13px]">
              db/migrations/2026-08-13-analytics-events.sql
            </code>{' '}
            in the Supabase SQL editor.
          </p>
        </Card>
      </Shell>
    )
  }

  const peak = Math.max(1, ...uploads.map((row) => row.count))
  const anyUploads = uploads.some((row) => row.count > 0)

  return (
    <Shell days={days}>
      {/* The funnel, which is the question the whole table was built to answer:
          of the receipts people uploaded, how many came back usable, and how
          many did they think were worth keeping. */}
      <section className="mt-8">
        <Eyebrow>Receipt funnel</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Uploaded" value={funnel.uploaded} hint="Scans that reached the model" />
          <Stat
            label="Extracted"
            value={funnel.succeeded}
            hint={`${share(funnel.succeeded, funnel.uploaded)} of uploads`}
          />
          <Stat
            label="Saved"
            value={funnel.saved}
            hint={`${share(funnel.saved, funnel.succeeded)} of extractions`}
          />
          <Stat
            label="Failed"
            value={funnel.failed}
            hint={`${share(funnel.failed, funnel.uploaded)} of uploads`}
            tone={funnel.failed > 0 ? 'warning' : 'default'}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Hit free limit"
            value={funnel.quota_blocked}
            hint="Saw the upgrade prompt"
          />
          <Stat label="Rate limited" value={funnel.rate_limited} hint="Hourly burst brake" />
        </div>
      </section>

      {/* Uploads per day. A bar chart in CSS rather than a charting library:
          one series of at most 90 values does not justify shipping a runtime,
          and this page is meant to stay free of client JavaScript. */}
      <section className="mt-10">
        <Eyebrow>Receipts uploaded per day</Eyebrow>
        {!anyUploads ? (
          <Card padding="lg" className="mt-3">
            <p className="text-sm text-text-tertiary">No uploads in this range.</p>
          </Card>
        ) : (
          <Card padding="lg" className="mt-3">
            {/* `uploads` covers every day in the window, zeros included, so a
                quiet day is a visible gap rather than two busy days shaking
                hands across it. */}
            <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily upload counts">
              {uploads.map((row) => (
                <div key={row.day} className="group relative flex-1">
                  <div
                    className="w-full rounded-t-sm bg-text transition-opacity group-hover:opacity-70"
                    style={{ height: `${(row.count / peak) * 150}px` }}
                  />
                  {/* Native tooltip. No hover card, no state, no hydration. */}
                  <span className="absolute inset-0" title={`${row.day}: ${row.count}`} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-text-faint">
              <span>{uploads[0]?.day}</span>
              <span>peak {peak}/day</span>
              <span>{uploads[uploads.length - 1]?.day}</span>
            </div>
          </Card>
        )}
      </section>

      {/* Everything else, unopinionated. New events added to AnalyticsEvent in
          src/lib/analytics.ts show up here on their own — no change needed to
          this page, which is the point of grouping by name in SQL. */}
      <section className="mt-10">
        <Eyebrow>All events</Eyebrow>
        <Card padding="none" className="mt-3 overflow-hidden">
          {totals.length === 0 ? (
            <p className="p-5 text-sm text-text-tertiary">
              No events recorded in this range yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-tertiary">
                  <th className="px-5 py-3 font-medium">Event</th>
                  <th className="px-5 py-3 text-right font-medium">Count</th>
                  <th className="px-5 py-3 text-right font-medium">Users</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((row) => (
                  <tr key={row.name} className="border-b border-border-subtle last:border-0">
                    <td className="px-5 py-3 font-mono text-[13px] text-text-secondary">
                      {row.name}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.event_count}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-text-tertiary">
                      {row.unique_users}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <p className="mt-3 text-[13px] leading-relaxed text-text-faint">
          Users counts distinct <em>surviving</em> accounts. Deleting an account detaches its
          events rather than removing them, so totals stay stable over time while the user
          count does not include people who have left.
        </p>
      </section>
    </Shell>
  )
}

/** Page chrome and the range switcher, shared with the error state above. */
function Shell({ days, children }: { days: number; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">Analytics</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            First-party, server-side. No third party and nothing stored on anyone&apos;s device.
          </p>
        </div>

        {/* Plain links, so the range survives a refresh and can be bookmarked —
            and so this page needs no client component at all. */}
        <nav className="flex gap-1" aria-label="Time range">
          {RANGES.map((range) => (
            <Link
              key={range.days}
              href={`/admin/analytics?range=${range.days}`}
              aria-current={days === range.days ? 'page' : undefined}
              className={cx(
                'rounded-btn px-3 py-1.5 text-sm transition-colors',
                days === range.days
                  ? 'bg-text text-white'
                  : 'text-text-muted hover:bg-surface-sunken',
              )}
            >
              {range.label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </main>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: number
  hint?: string
  tone?: 'default' | 'warning'
}) {
  return (
    <Card padding="md">
      <p className="text-[13px] text-text-tertiary">{label}</p>
      <p
        className={cx(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'warning' ? 'text-warning' : 'text-text',
        )}
      >
        {value.toLocaleString()}
      </p>
      {hint && <p className="mt-1 text-[13px] text-text-faint">{hint}</p>}
    </Card>
  )
}
