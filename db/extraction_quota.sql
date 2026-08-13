-- Free-tier extraction metering.
--
-- Run after schema.sql, rls_policies.sql, subscriptions.sql and rate_limits.sql.
--
-- Added 2026-08-10. This is the bootstrap copy of what
-- migrations/2026-08-10-prelaunch-hardening.sql and
-- migrations/2026-08-10-restrict-rpc-execute.sql apply to an existing project —
-- a fresh project should get the finished state from here rather than replaying
-- migrations.
--
-- WHY IT EXISTS
--
-- /api/extract used to enforce the free tier by counting rows in `expenses` for
-- the current month. That measured the wrong event. Anthropic is paid for
-- during the request, and whether the result is ever saved is the client's
-- choice — so extract-and-never-save was free and uncounted, and the only real
-- ceiling on a free account was check_rate_limit's hourly cap.
--
-- This counts the thing that costs money. Same atomic shape as
-- check_rate_limit in rate_limits.sql, with the window widened from the clock
-- hour to the calendar month. The two are complementary and both are used:
-- check_rate_limit is a burst brake for everyone, this is a monthly allowance
-- only free accounts are measured against.

create table if not exists extraction_quota (
  user_id          uuid not null references auth.users(id) on delete cascade,
  month_start      timestamptz not null,
  extraction_count int not null default 1,
  primary key (user_id, month_start)
);

alter table extraction_quota enable row level security;

-- Read-only to its owner. Nothing user-facing writes this; the functions below
-- are security definer and do the writing.
drop policy if exists "Users can view own extraction quota" on extraction_quota;
create policy "Users can view own extraction quota"
  on extraction_quota for select
  using (user_id = auth.uid());

-- Atomic check-and-increment. Returns true if the extraction is allowed.
--
-- Increments first and compares after, so two concurrent requests cannot both
-- observe "9 used" and both proceed.
--
-- Note that a rejected call increments too. That is deliberate and harmless:
-- the caller is blocked either way, check_rate_limit caps how fast they can
-- retry, and the counter resets monthly. It does mean the column counts
-- attempts rather than successes once someone is over their limit.
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
-- is ours — a timeout, or Anthropic being unavailable. Without it, a free user
-- with ten scans a month loses one to every transient upstream error.
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

-- LOAD BEARING. PostgREST publishes both functions above at
-- /rest/v1/rpc/<name>, and Supabase grants EXECUTE to anon and authenticated by
-- default. Both are security definer and take the user id as an argument, so
-- without these revokes they are endpoints any signed-in caller can invoke for
-- any user id.
--
-- refund_extraction_quota is the sharp one: a loop against it zeroes your own
-- counter, which buys unlimited extractions and makes this whole file
-- pointless. check_extraction_quota lets one user burn another's allowance.
--
-- /api/extract calls both on the service role, which these revokes do not
-- affect — and which is the only context where p_user_id is a value the server
-- decided rather than one a caller supplied.
revoke execute on function check_extraction_quota(uuid, int) from public, anon, authenticated;
revoke execute on function refund_extraction_quota(uuid) from public, anon, authenticated;
