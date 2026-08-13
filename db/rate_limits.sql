-- Rate limiting for API endpoints (e.g. /api/extract)
-- Run this in the Supabase SQL Editor after schema.sql and rls_policies.sql

create table if not exists rate_limits (
  user_id       uuid not null references auth.users(id) on delete cascade,
  window_start  timestamptz not null,
  request_count int not null default 1,
  primary key (user_id, window_start)
);

alter table rate_limits enable row level security;

create policy "Users can view own rate limits"
  on rate_limits for select
  using (user_id = auth.uid());

-- Atomic check-and-increment. Returns true if the request is allowed.
-- p_max_requests: the per-window cap (easy to change per tier later).
-- Window is the current clock hour (e.g. 14:00–14:59).
--
-- `set search_path` for the same reason as create_default_subscription() in
-- subscriptions.sql — see the long note there. This one is not currently
-- broken: it is called over PostgREST, whose search_path does include `public`,
-- so `rate_limits` resolves. It is pinned anyway because "works because of the
-- caller's search_path" is the same latent bug, one caller away from biting.
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

-- Clean up old windows (optional — run periodically or via pg_cron)
-- delete from rate_limits where window_start < now() - interval '24 hours';
