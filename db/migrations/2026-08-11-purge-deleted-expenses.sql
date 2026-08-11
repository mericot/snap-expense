-- 2026-08-11 — Actually delete deleted expenses.
--
-- WHAT IS BROKEN
--
-- "Delete" in the app is a soft delete: src/app/receipts/page.tsx stamps
-- `deleted_at` and every list query filters on `deleted_at is null`. The row
-- itself is never removed — merchant, date, total, tax and category stay in the
-- table indefinitely.
--
-- Nothing reads those rows. There is no undo in the UI, no support tooling, no
-- restore path. So the retained data has no purpose and is pure liability: the
-- retention policy and the notice on /receipts both tell the user their deleted
-- receipts are removed, and they were not.
--
-- (Account deletion is unaffected and was already correct — /api/account/delete
-- removes rows outright on the service role.)
--
-- THE FIX
--
-- Keep the soft delete, which makes the list feel instant and leaves room for
-- an undo later, but give it an expiry. Rows are purged 30 days after they were
-- deleted, by a nightly pg_cron job.
--
-- Thirty days is chosen to match what the copy now says, and is a real number
-- this time — it describes a job that exists, unlike the backup window removed
-- on 2026-08-10, which described infrastructure the free plan does not have.
--
-- FIRST RUN IS A NO-OP. Checked before applying: 17 expenses, 1 soft-deleted
-- on 2026-08-08, 0 older than 30 days. The existing one ages out around
-- 2026-09-07.

create extension if not exists pg_cron;

-- The retention window lives here, once, as a default. The parameter exists so
-- the job can be tested with a short interval without editing the function.
--
-- `security definer` because pg_cron runs it as the job owner rather than as
-- any user, and because RLS must not apply — this deletes across all users by
-- design. search_path pinned for the reason given at length in
-- 2026-08-09-pin-security-definer-search-path.sql.
create or replace function purge_deleted_expenses(p_older_than interval default interval '30 days')
returns integer
security definer
set search_path = public, pg_temp
as $$
declare
  v_purged int;
begin
  delete from expenses
   where deleted_at is not null
     and deleted_at < now() - p_older_than;

  get diagnostics v_purged = row_count;
  return v_purged;
end;
$$ language plpgsql;

-- LOAD BEARING, and the same trap as check_extraction_quota.
--
-- PostgREST would publish this at /rest/v1/rpc/purge_deleted_expenses, and
-- Supabase grants EXECUTE to anon and authenticated by default. It is
-- `security definer`, so RLS does not contain it, and it takes the retention
-- window as an argument — meaning any signed-in caller could invoke it with
-- `p_older_than => '0 seconds'` and permanently destroy every soft-deleted
-- receipt belonging to every user on the platform.
--
-- That is the most destructive endpoint this database could accidentally
-- expose. pg_cron runs as the job owner and is unaffected by these revokes.
revoke execute on function purge_deleted_expenses(interval) from public, anon, authenticated;

-- Nightly at 03:00 UTC. Unscheduled first so this migration can be re-run;
-- cron.unschedule raises if the job does not exist, hence the swallow.
do $$
begin
  perform cron.unschedule('purge-deleted-expenses');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'purge-deleted-expenses',
  '0 3 * * *',
  $$select public.purge_deleted_expenses()$$
);

-- ---------------------------------------------------------------------------
-- AFTERWARDS
-- ---------------------------------------------------------------------------
--
--   select jobname, schedule, active, command from cron.job
--    where jobname = 'purge-deleted-expenses';
--
-- After it has run at least once, check outcomes:
--
--   select status, return_message, start_time
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'purge-deleted-expenses')
--    order by start_time desc limit 5;
--
-- To change the window, edit the function's default — not the schedule.
