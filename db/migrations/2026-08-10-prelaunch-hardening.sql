-- 2026-08-10 — Pre-launch hardening.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once. It creates
-- one table, two functions, and replaces one policy. It changes no existing
-- data.
--
-- Three independent fixes, grouped because they all have to land before the
-- app is public.
--
--   1. Meter extractions instead of saved expenses (cost control).
--   2. Pin search_path on get_user_plan() — missed by 2026-08-09.
--   3. Stop the subscriptions INSERT policy from accepting a self-declared plan.
--
-- ---------------------------------------------------------------------------
-- 1. EXTRACTION QUOTA
-- ---------------------------------------------------------------------------
--
-- WHAT IS BROKEN
--
-- /api/extract enforced the free tier by counting rows in `expenses` for the
-- current month. But the Anthropic call is paid for *before* anything is
-- inserted, and inserting is the client's choice. A client that extracts and
-- never saves was never counted, so the free limit could be walked past
-- indefinitely. The only real ceiling was check_rate_limit's 20/hour — roughly
-- 480 vision calls a day, per account, on an unrestricted magic-link signup.
--
-- It was also wrong in the ordinary direction: the count did not exclude
-- soft-deleted rows, so deleting a receipt still consumed free quota.
--
-- THE FIX
--
-- Count the thing that costs money. Same atomic insert-on-conflict-increment
-- shape as check_rate_limit in db/rate_limits.sql, with the window widened from
-- the clock hour to the calendar month.
--
-- The two are complementary and both stay: check_rate_limit is a burst brake
-- that applies to everyone, this is a monthly allowance that only free accounts
-- are measured against.

create table if not exists extraction_quota (
  user_id          uuid not null references auth.users(id) on delete cascade,
  month_start      timestamptz not null,
  extraction_count int not null default 1,
  primary key (user_id, month_start)
);

alter table extraction_quota enable row level security;

-- Read-only to its owner. Nothing user-facing writes this; the RPC below is
-- security definer and does the writing.
drop policy if exists "Users can view own extraction quota" on extraction_quota;
create policy "Users can view own extraction quota"
  on extraction_quota for select
  using (user_id = auth.uid());

-- Atomic check-and-increment. Returns true if the extraction is allowed.
--
-- Increments first and compares after, so two requests racing cannot both see
-- "9 used" and both proceed. That does mean a request which is allowed and then
-- fails downstream has spent quota it did not use, which is why
-- refund_extraction_quota() exists below.
--
-- `set search_path` for the reason spelled out at length in
-- db/migrations/2026-08-09-pin-security-definer-search-path.sql: a security
-- definer function without one runs against the *caller's* search_path, which
-- is both a latent breakage and a privilege-escalation vector. `pg_temp` last so
-- a temp table cannot shadow a real one.
create or replace function check_extraction_quota(
  p_user_id uuid,
  p_max_extractions int default 10
) returns boolean
security definer
set search_path = public, pg_temp
as $$
declare
  v_month timestamptz := date_trunc('month', now());
  v_count int;
begin
  insert into extraction_quota (user_id, month_start, extraction_count)
  values (p_user_id, v_month, 1)
  on conflict (user_id, month_start)
  do update set extraction_count = extraction_quota.extraction_count + 1
  returning extraction_count into v_count;

  return v_count <= p_max_extractions;
end;
$$ language plpgsql;

-- Give back a unit of quota.
--
-- Called only when an extraction was allowed and then failed for a reason that
-- is ours rather than the user's — a timeout, or Anthropic being unavailable.
-- Without this, a free user with ten scans a month loses one to every transient
-- upstream error, which is a bad trade for a limit that small.
--
-- Floors at zero so a refund can never mint quota, however it is called.
create or replace function refund_extraction_quota(p_user_id uuid)
returns void
security definer
set search_path = public, pg_temp
as $$
begin
  update extraction_quota
  set extraction_count = greatest(extraction_count - 1, 0)
  where user_id = p_user_id
    and month_start = date_trunc('month', now());
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 2. get_user_plan() — pin search_path
-- ---------------------------------------------------------------------------
--
-- The 2026-08-09 migration pinned create_default_subscription() and
-- check_rate_limit() and missed this third security definer function, which has
-- the identical defect. Same reasoning as that migration; see it for the full
-- explanation. This also clears Supabase's `function_search_path_mutable` lint,
-- which will otherwise keep flagging the project.

create or replace function get_user_plan(p_user_id uuid)
returns table (
  plan text,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  seats int
)
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select
      s.plan,
      s.status,
      s.trial_ends_at,
      s.current_period_end,
      s.cancel_at_period_end,
      s.seats
    from subscriptions s
    where s.user_id = p_user_id
    limit 1;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 3. subscriptions INSERT policy — stop accepting a self-declared plan
-- ---------------------------------------------------------------------------
--
-- The old policy checked only `user_id = auth.uid()`. Nothing constrained
-- `plan`, so the statement it permitted was, in principle:
--
--   insert into subscriptions (user_id, plan) values (auth.uid(), 'pro');
--
-- That is not currently exploitable: on_auth_user_created already made the row
-- and `user_id` is unique, so the insert conflicts. The protection is an
-- accident of another feature rather than anything this policy does, and it
-- stops holding the moment any row is legitimately removed — which
-- /api/account/delete now does, through the service role.
--
-- Constrain the policy to what a user-initiated insert is actually for: a fresh
-- free row. Paid state arrives only from the Stripe webhook on the service role,
-- which RLS does not apply to.

drop policy if exists "Users can insert own subscription" on subscriptions;
create policy "Users can insert own subscription"
  on subscriptions for insert
  with check (
    user_id = auth.uid()
    and plan = 'free'
    and status = 'active'
    and stripe_subscription_id is null
    and stripe_customer_id is null
  );

-- ---------------------------------------------------------------------------
-- AFTERWARDS
-- ---------------------------------------------------------------------------
--
-- All four security definer functions should now report a pinned search_path:
--
--   select proname, proconfig from pg_proc
--   where proname in (
--     'create_default_subscription', 'check_rate_limit',
--     'check_extraction_quota', 'refund_extraction_quota', 'get_user_plan'
--   );
--
-- Every row should show {"search_path=public, pg_temp"}. A null proconfig is
-- the broken state.
