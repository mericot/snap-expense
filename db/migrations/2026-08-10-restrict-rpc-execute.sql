-- 2026-08-10 — Close the RPC exposure on security definer functions.
--
-- WHAT IS BROKEN
--
-- PostgREST publishes every function in `public` as /rest/v1/rpc/<name>, and
-- Supabase grants EXECUTE on them to `anon` and `authenticated` by default.
-- Combine that with `security definer` and a user id taken as an argument, and
-- each of these is an HTTP endpoint that any caller with a session can invoke
-- for any user id they care to type.
--
-- Concretely, before this migration:
--
--   refund_extraction_quota  — POST it in a loop against your own id and your
--                              monthly counter goes to zero. Unlimited free
--                              extractions; the quota does not exist.
--   check_extraction_quota   — pass someone else's id and burn their allowance.
--   check_rate_limit         — same, for their hourly rate limit.
--   get_user_plan            — read any user's plan, status, period end and
--                              seat count. It is not called anywhere in the app.
--
-- These are all called from route handlers, which have the service role key.
-- The service role is not subject to these revokes, so nothing the app does
-- stops working. What stops working is calling them from a browser.
--
-- APPLIED IN TWO PARTS, AND THE ORDER MATTERS
--
-- Part 1 (check_extraction_quota, refund_extraction_quota, get_user_plan) was
-- applied on 2026-08-10, immediately. Safe to do at any time: the first two
-- were brand new and no deployed code called them, and the third has no callers
-- at all.
--
-- Part 2 below is check_rate_limit, and it is deliberately NOT applied yet. The
-- deployed /api/extract still calls it with the caller's own session. Revoking
-- it before that code ships would make every extraction fail its rate-limit
-- check and return 429 — receipt scanning would stop working for everyone.
--
-- ⚠ RUN PART 2 ONLY AFTER the branch that moves this call to the service role
-- is deployed. Verify first that the running /api/extract calls
-- `admin.rpc('check_rate_limit', ...)` and not `supabase.rpc(...)`.

-- ---------------------------------------------------------------------------
-- Part 1 — already applied 2026-08-10. Idempotent; safe to re-run.
-- ---------------------------------------------------------------------------

revoke execute on function public.check_extraction_quota(uuid, int) from public, anon, authenticated;
revoke execute on function public.refund_extraction_quota(uuid) from public, anon, authenticated;
revoke execute on function public.get_user_plan(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 2 — RUN AT DEPLOY, NOT BEFORE. See the warning above.
-- ---------------------------------------------------------------------------

-- revoke execute on function public.check_rate_limit(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- NOT REVOKED: create_default_subscription()
-- ---------------------------------------------------------------------------
--
-- Supabase's linter flags it alongside the others, but it is a trigger function
-- returning `trigger`, and Postgres refuses to call those over RPC — the
-- exposure is nominal. It is also the function whose last change broke signup
-- outright (see 2026-08-09), and it fires inside the transaction that creates a
-- user on a role none of this touches. Poking at its privileges to silence a
-- lint is a bad trade against re-breaking account creation.

-- ---------------------------------------------------------------------------
-- AFTERWARDS
-- ---------------------------------------------------------------------------
--
--   select p.proname,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed,
--          has_function_privilege('service_role', p.oid, 'EXECUTE') as service
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef order by p.proname;
--
-- Every row except create_default_subscription should read authed=false,
-- service=true.
