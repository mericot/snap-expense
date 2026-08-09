-- 2026-08-09 — Pin search_path on the two security definer functions.
--
-- Run this in the Supabase SQL Editor. It is safe to run more than once, and it
-- changes no data — only two function definitions.
--
-- WHAT IS BROKEN
--
-- No new user can be created. Signing up with a magic link fails with
-- "Database error saving new user" and no account is made. Existing users are
-- unaffected: signing in does not insert into auth.users, so the broken trigger
-- never fires for them. That is why this has gone unnoticed — the trigger
-- landed on 2026-08-08 with the Stripe work (f00eda9), the most recent real
-- signup was 2026-08-07, and every subscriptions row in the table was created
-- by the backfill in that same migration rather than by the trigger.
--
-- WHY
--
-- create_default_subscription() is `security definer` but was never given a
-- search_path, so it inherits the caller's. Inserts into auth.users only ever
-- come from GoTrue, whose role (supabase_auth_admin) is configured with
-- `search_path=auth`. `public` is not on it. So the trigger's unqualified
-- `insert into subscriptions` resolved against `auth` only:
--
--   ERROR: relation "subscriptions" does not exist
--
-- which aborts the enclosing transaction — the one inserting the user.
--
-- check_rate_limit() has the identical shape but is not currently failing: it
-- is called over PostgREST, whose search_path does include `public`. It is
-- pinned here too rather than left as the same bug waiting for a second caller.
--
-- Pinning search_path on a security definer function is also the fix for
-- Supabase's `function_search_path_mutable` lint: without it, a caller can
-- point an unqualified name at an object of their own and have it executed with
-- the definer's privileges. `pg_temp` goes last so a temp table cannot shadow a
-- real one.
--
-- AFTERWARDS
--
-- Verify with a real signup, or:
--
--   select proname, proconfig from pg_proc
--   where proname in ('create_default_subscription', 'check_rate_limit');
--
-- Both rows should show {"search_path=public, pg_temp"}. proconfig of null is
-- the broken state.

create or replace function create_default_subscription()
returns trigger
security definer
set search_path = public, pg_temp
as $$
begin
  insert into subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$ language plpgsql;

create or replace function check_rate_limit(
  p_user_id uuid,
  p_max_requests int default 20
) returns boolean
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count int;
begin
  insert into rate_limits (user_id, window_start, request_count)
  values (p_user_id, v_window, 1)
  on conflict (user_id, window_start)
  do update set request_count = rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$ language plpgsql;
