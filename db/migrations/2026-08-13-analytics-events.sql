-- 2026-08-13 — First-party product analytics.
--
-- Run this in the Supabase SQL Editor. It is safe to run more than once and it
-- changes no existing data: it adds one table, three read functions, and one
-- trigger on `expenses`.
--
-- The full rationale — why this is first-party rather than a vendor SDK, why
-- `on delete set null` rather than cascade, why the trigger has an exception
-- block, and what must never go in `props` — is in db/analytics_events.sql,
-- which is the bootstrap copy of the finished state. Read that file before
-- changing anything here.
--
-- WHAT THIS ADDS
--
--   analytics_events            table, RLS on with no policies (service role only)
--   record_expense_event()      trigger fn — captures saves and soft-deletes that
--                               the browser writes straight to PostgREST
--   expenses_analytics          the trigger itself, AFTER INSERT OR UPDATE
--   analytics_event_totals()    read fn for the dashboard
--   analytics_daily_counts()    read fn for the dashboard
--   analytics_extraction_funnel() read fn for the dashboard
--
-- THE ONE RISK IN HERE
--
-- `expenses_analytics` fires inside the user's own INSERT transaction. If it
-- ever throws, the receipt is not saved. That is why record_expense_event()
-- wraps its whole body in an exception handler that downgrades any failure to a
-- warning. Do not remove it, and do not add a statement to that function
-- outside the block.
--
-- AFTERWARDS
--
-- Save a receipt in the app, then:
--
--   select name, user_id, props, created_at
--   from analytics_events order by id desc limit 5;
--
-- One 'expense_saved' row should be there. Then confirm the table is not
-- readable with the anon key — this must return an empty array or a permission
-- error, never rows:
--
--   curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/analytics_events?select=*" \
--     -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"

create table if not exists analytics_events (
  id         bigint      generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text        not null,
  -- set null, not cascade: erasure breaks the link to the person without
  -- rewriting last month's totals every time an account is deleted.
  user_id    uuid        references auth.users(id) on delete set null,
  -- Non-identifying facts about the operation only. Never email, IP, user
  -- agent, merchant or receipt total.
  props      jsonb       not null default '{}'::jsonb
);

create index if not exists analytics_events_created_at_idx
  on analytics_events (created_at desc);

create index if not exists analytics_events_name_created_at_idx
  on analytics_events (name, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on analytics_events (user_id, created_at desc)
  where user_id is not null;

-- No policies, on purpose. PostgREST publishes every table in `public`, and the
-- anon key is a public value in the browser bundle; RLS with zero policies is
-- what stops the whole business's numbers being readable with it. The service
-- role bypasses RLS and is the only reader and writer.
alter table analytics_events enable row level security;

create or replace function record_expense_event()
returns trigger
security definer
set search_path = public, pg_temp
as $$
begin
  -- LOAD BEARING. See the header: without this handler a failure in here
  -- aborts the user's own insert and loses their receipt.
  begin
    if tg_op = 'INSERT' then
      insert into analytics_events (name, user_id, props)
      values (
        'expense_saved',
        new.user_id,
        jsonb_build_object('category', coalesce(new.category, 'Uncategorized'))
      );

    -- Only the null → not-null transition: an ordinary edit is also an UPDATE.
    elsif tg_op = 'UPDATE'
      and old.deleted_at is null
      and new.deleted_at is not null then
      insert into analytics_events (name, user_id, props)
      values (
        'expense_deleted',
        new.user_id,
        jsonb_build_object(
          'age_seconds', floor(extract(epoch from (now() - new.created_at)))::bigint
        )
      );
    end if;
  exception when others then
    raise warning 'record_expense_event failed for % on expenses: %', tg_op, sqlerrm;
  end;

  return null;
end;
$$ language plpgsql;

drop trigger if exists expenses_analytics on expenses;

create trigger expenses_analytics
  after insert or update on expenses
  for each row
  execute function record_expense_event();

-- Silences Supabase's `anon_security_definer_function_executable` advisor. Does
-- NOT stop the trigger firing: Postgres checks EXECUTE at CREATE TRIGGER time,
-- not on each fire. Verified against the live database in a rolled-back
-- transaction as the `authenticated` role — insert succeeded, event recorded.
revoke execute on function record_expense_event() from public, anon, authenticated;

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

-- LOAD BEARING, exactly as in extraction_quota.sql. These are security definer
-- and PostgREST publishes them at /rest/v1/rpc/<name> with EXECUTE granted to
-- authenticated by default — without the revokes, the RLS above is decoration.
revoke execute on function analytics_event_totals(timestamptz) from public, anon, authenticated;
revoke execute on function analytics_daily_counts(timestamptz) from public, anon, authenticated;
revoke execute on function analytics_extraction_funnel(timestamptz) from public, anon, authenticated;
