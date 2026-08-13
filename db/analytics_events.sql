-- First-party product analytics.
--
-- Run after schema.sql, rls_policies.sql, subscriptions.sql, rate_limits.sql
-- and extraction_quota.sql.
--
-- Added 2026-08-13. This is the bootstrap copy of what
-- migrations/2026-08-13-analytics-events.sql applies to an existing project — a
-- fresh project should get the finished state from here rather than replaying
-- the migration.
--
-- WHY IT EXISTS, AND WHY IT IS NOT POSTHOG
--
-- The product tells people, in writing, that it does not track them:
-- /legal/privacy says "We do not run any analytics or tracking on snapExpense",
-- and the cookie banner says "No analytics, no tracking, no advertising". Those
-- statements are about *third-party* tracking — a vendor SDK in the browser,
-- setting its own cookies, shipping behaviour off to someone else's servers.
--
-- Nothing in this file does any of that. There is no client SDK, no cookie, no
-- device or browser fingerprint, no third party, and no data leaves the
-- database that already stores the receipts. Every row here is written
-- server-side by code in this repo, recording an action the service performed
-- on the user's behalf — the same category of record as a server log, which
-- every one of those pages already discloses.
--
-- That distinction is the whole reason for the design. Keep it true: the moment
-- something in `props` starts describing the *person* rather than the
-- *operation*, the promise on those pages stops being accurate and both they
-- and /legal/subprocessors have to change. See the note above `props`.
--
-- WHAT IS DELIBERATELY NOT RECORDED
--
--   - No merchant, total, tax or receipt image. Those are the customer's
--     financial records. Aggregate product questions ("how many receipts were
--     scanned", "what share of extractions fail") never need them, and a
--     reporting table is a bad place for money.
--   - No IP address, user agent, referrer, or session identifier.
--   - No email. `user_id` is the only identifier, it is a foreign key, and it
--     goes null when the account is deleted (see below).

create table if not exists analytics_events (
  id         bigint      generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Event name, e.g. 'receipt_uploaded'. Deliberately a plain text column and
  -- not an enum: adding an event should never require a migration, and an enum
  -- would make an unrecognised name an insert failure inside `after()` — a
  -- silent gap in the data at exactly the moment someone is shipping something
  -- new. The names in use are listed in src/lib/analytics.ts, which is the
  -- authority; this column only stores them.
  name       text        not null,

  -- Null for events with no signed-in actor, and null *afterwards* for every
  -- event belonging to a deleted account.
  --
  -- `on delete set null`, NOT `on delete cascade`. Cascade is the reflex here
  -- and it is wrong twice over. Practically, it rewrites history: /api/extract
  -- charges Anthropic for work that really happened, and one account deletion
  -- would retroactively erase it from the counts, so last month's numbers
  -- change every time someone leaves. Legally, erasure is satisfied by breaking
  -- the link to the person, which is exactly what this does — the surviving row
  -- says "an extraction succeeded at 14:02", which is not personal data about
  -- anyone.
  --
  -- This does mean unique-user counts are counts of *surviving* users. That is
  -- the honest reading of the data and is noted on the dashboard.
  user_id    uuid        references auth.users(id) on delete set null,

  -- Small, non-identifying facts about the operation: plan, media type,
  -- duration, failure reason, category.
  --
  -- NEVER put anything in here that identifies a person or describes their
  -- finances. Not email, not IP, not user agent, not merchant, not a receipt
  -- total. The privacy promise quoted at the top of this file is only true
  -- while that holds, and this column is the one place where breaking it is a
  -- one-line change that nobody reviews.
  props      jsonb       not null default '{}'::jsonb
);

-- Indexes.
--
-- Every dashboard query filters on a time range and then groups by `name`, so
-- both leading columns earn their place. Worth stating plainly because the
-- 2026-08-11 scaling review found `expenses` had no indexes at all: this table
-- grows strictly faster than that one — several rows per receipt rather than
-- one — and an unindexed sequential scan over it is the query that takes the
-- dashboard down first.
create index if not exists analytics_events_created_at_idx
  on analytics_events (created_at desc);

create index if not exists analytics_events_name_created_at_idx
  on analytics_events (name, created_at desc);

-- Partial: the null half is every deleted account's history, which no
-- per-user query ever wants and which would otherwise be the fastest-growing
-- part of the index.
create index if not exists analytics_events_user_id_created_at_idx
  on analytics_events (user_id, created_at desc)
  where user_id is not null;

-- RLS on, and deliberately NO policies.
--
-- This is not an oversight, so do not "fix" it by adding a select policy for
-- owners. RLS with zero policies denies everything to `anon` and
-- `authenticated`, which is the whole intent: PostgREST publishes every table
-- in `public`, so without this the analytics of the entire user base would be
-- readable at /rest/v1/analytics_events by anyone holding the anon key — which
-- is a public value shipped in the browser bundle.
--
-- The service role bypasses RLS and is the only thing that reads or writes
-- here: src/lib/analytics.ts for writes, the /admin/analytics dashboard for
-- reads. Both run on the server. A user has no reason to read this table —
-- their own receipts are in `expenses`, which is where their data lives and
-- where the owner policies belong.
alter table analytics_events enable row level security;

/* ---------------------------------------------------------------------------
   Capture for client-written rows.

   src/app/receipts/page.tsx inserts, updates and soft-deletes `expenses`
   directly over PostgREST from the browser — there is no server route in the
   middle to instrument. So saving a receipt cannot be recorded the way
   /api/extract records an extraction.

   A trigger is the answer rather than a new /api/events endpoint, for two
   reasons. It cannot be bypassed or forged: any write that lands in the table
   is counted exactly once, including ones made outside the app. And it adds no
   public surface — an events endpoint that the browser posts to is, by
   construction, an endpoint anyone can post anything to, and the numbers it
   produces are only as good as the client's honesty.
--------------------------------------------------------------------------- */

-- LOAD BEARING: the exception block.
--
-- This trigger runs inside the user's own INSERT transaction. Without the
-- handler, any failure in here — a constraint, a type error introduced by a
-- later edit, the table being mid-migration — aborts that transaction and the
-- user's receipt is not saved. Analytics must never be able to do that. A
-- dropped measurement is a gap in a chart; a dropped receipt is the product
-- failing at the one thing it does.
--
-- `security definer` because the caller is `authenticated`, which RLS gives no
-- access to (see above). search_path is pinned for the reason set out in
-- migrations/2026-08-09-pin-security-definer-search-path.sql, with pg_temp last
-- so a temp table cannot shadow a real one.
create or replace function record_expense_event()
returns trigger
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if tg_op = 'INSERT' then
      -- Category only. Merchant and total are the customer's financial data and
      -- are deliberately left in `expenses`; category is what answers "what do
      -- people actually scan", which is the question worth asking.
      insert into analytics_events (name, user_id, props)
      values (
        'expense_saved',
        new.user_id,
        jsonb_build_object('category', coalesce(new.category, 'Uncategorized'))
      );

    -- Only the null → not-null transition. `expenses` is soft-deleted by
    -- stamping `deleted_at`, and an ordinary edit is also an UPDATE, so without
    -- this condition every field change would be counted as a deletion.
    elsif tg_op = 'UPDATE'
      and old.deleted_at is null
      and new.deleted_at is not null then
      insert into analytics_events (name, user_id, props)
      values (
        'expense_deleted',
        new.user_id,
        jsonb_build_object(
          -- How long the receipt survived. Distinguishes "saved it by mistake
          -- and removed it immediately" from ordinary tidying up months later,
          -- which are different signals about the product.
          'age_seconds', floor(extract(epoch from (now() - new.created_at)))::bigint
        )
      );
    end if;
  exception when others then
    -- Swallowed on purpose. Surfaced as a warning so it is visible in the
    -- Postgres logs rather than truly silent.
    raise warning 'record_expense_event failed for % on expenses: %', tg_op, sqlerrm;
  end;

  return null; -- AFTER trigger; the return value is not used.
end;
$$ language plpgsql;

drop trigger if exists expenses_analytics on expenses;

-- AFTER, not BEFORE: the event should describe a write that actually committed.
create trigger expenses_analytics
  after insert or update on expenses
  for each row
  execute function record_expense_event();

-- Revoked for the same reason as the functions at the bottom of this file,
-- though the exposure is smaller: PostgREST does not publish functions
-- returning `trigger`, and calling one outside a trigger raises anyway. Applied
-- because it silences Supabase's `anon_security_definer_function_executable`
-- advisor, and a standing warning is how a real one later gets ignored.
--
-- This does NOT stop the trigger firing. Postgres checks EXECUTE on a trigger
-- function when the trigger is created, not each time it fires — verified
-- against the live database inside a rolled-back transaction, as the
-- `authenticated` role, with the revoke in place: the insert succeeded and the
-- event was still recorded. Worth knowing before "fixing" this line, because
-- the failure it looks like it should cause would be silent and total.
revoke execute on function record_expense_event() from public, anon, authenticated;

/* ---------------------------------------------------------------------------
   Read side.

   Aggregation happens in Postgres, not in the dashboard. Pulling raw rows into
   the page and counting them in JavaScript works for a week and then quietly
   becomes the slowest page in the app while transferring the entire event log
   to a serverless function to answer "how many were there".
--------------------------------------------------------------------------- */

-- Totals per event name over a window, with unique actors.
--
-- `count(distinct user_id)` ignores nulls, so deleted accounts drop out of the
-- unique count while their events stay in the total. That asymmetry is
-- deliberate — see the `user_id` note above — and the dashboard says so.
create or replace function analytics_event_totals(p_since timestamptz)
returns table (name text, event_count bigint, unique_users bigint)
security definer
set search_path = public, pg_temp
as $$
  select
    e.name,
    count(*)                  as event_count,
    count(distinct e.user_id) as unique_users
  from analytics_events e
  where e.created_at >= p_since
  group by e.name
  order by count(*) desc;
$$ language sql stable;

-- One row per day per event name, for the trend chart. `date_trunc` in UTC:
-- the alternative is a per-viewer timezone, which would make two people
-- comparing the same chart disagree about which day a receipt landed on.
create or replace function analytics_daily_counts(p_since timestamptz)
returns table (day date, name text, event_count bigint)
security definer
set search_path = public, pg_temp
as $$
  select
    date_trunc('day', e.created_at)::date as day,
    e.name,
    count(*)                              as event_count
  from analytics_events e
  where e.created_at >= p_since
  group by 1, 2
  order by 1, 2;
$$ language sql stable;

-- Extraction funnel, as one row.
--
-- Computed here rather than by subtracting numbers on the dashboard because the
-- relationship between these three is the thing most likely to be got wrong by
-- hand: an upload can fail, succeed, or be refused by the quota, and only the
-- first two are attempts the model was actually asked about.
create or replace function analytics_extraction_funnel(p_since timestamptz)
returns table (
  uploaded  bigint,
  succeeded bigint,
  failed    bigint,
  saved     bigint,
  quota_blocked bigint,
  rate_limited  bigint
)
security definer
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where name = 'receipt_uploaded')      as uploaded,
    count(*) filter (where name = 'extraction_succeeded')  as succeeded,
    count(*) filter (where name = 'extraction_failed')     as failed,
    count(*) filter (where name = 'expense_saved')         as saved,
    count(*) filter (where name = 'free_quota_exhausted')  as quota_blocked,
    count(*) filter (where name = 'rate_limited')          as rate_limited
  from analytics_events
  where created_at >= p_since;
$$ language sql stable;

-- LOAD BEARING, for the same reason as the revokes at the bottom of
-- extraction_quota.sql. PostgREST publishes every one of these at
-- /rest/v1/rpc/<name>, and Supabase grants EXECUTE to anon and authenticated by
-- default. They are `security definer`, so without these revokes the RLS policy
-- above is decoration: any holder of the anon key could read the whole
-- business's numbers — signups, revenue events, volumes — straight out of a
-- function that was added to keep the dashboard fast.
--
-- The dashboard calls them on the service role, which these revokes do not
-- affect.
revoke execute on function analytics_event_totals(timestamptz) from public, anon, authenticated;
revoke execute on function analytics_daily_counts(timestamptz) from public, anon, authenticated;
revoke execute on function analytics_extraction_funnel(timestamptz) from public, anon, authenticated;
