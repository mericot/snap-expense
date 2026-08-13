-- expenses table
--
-- ⚠ REGENERATED 2026-08-10 by introspecting the live database. The previous
-- version of this file claimed to match production and did not, in ways that
-- would have broken anyone who bootstrapped from it:
--
--   - It declared an `updated_at` column. Production has no such column.
--   - It declared a `set_updated_at` trigger on this table. Production has no
--     trigger on `expenses` at all. (The `update_updated_at` function does
--     exist, but only `subscriptions` uses it.)
--   - It omitted `deleted_at` entirely — the column the app soft-deletes with,
--     and which src/app/receipts/page.tsx both filters on and writes.
--
-- So a fresh project built from the old file had a column the app never writes,
-- a trigger for it, and was missing the one column the receipts list depends
-- on. Everything below now matches `pg_attribute` on the live project.
--
-- Run order for a fresh project:
--   1. schema.sql            (this file)
--   2. rls_policies.sql
--   3. subscriptions.sql
--   4. rate_limits.sql
--   5. extraction_quota.sql
--   6. analytics_events.sql
--   7. migrations/*.sql in date order

create table if not exists expenses (
  id          uuid           primary key default gen_random_uuid(),
  created_at  timestamptz    not null default now(),
  merchant    text           not null,
  date        date           not null,
  total       numeric(10, 2) not null,
  tax         numeric(10, 2),
  category    text,
  -- No `default auth.uid()` in production. The app always supplies user_id
  -- explicitly on insert, and RLS rejects a row that is not the caller's, so
  -- the default was never load bearing. Recorded as-is rather than "improved",
  -- because the point of this file is to reproduce production.
  user_id     uuid           not null references auth.users(id) on delete cascade,
  -- Soft delete. Rows are never removed by the app on delete — it stamps this
  -- and filters on `deleted_at is null`. Account deletion is the exception and
  -- removes rows outright, via the service role.
  deleted_at  timestamptz
);

-- update_updated_at() lives here because subscriptions.sql attaches a trigger
-- that uses it. Nothing on `expenses` uses it, despite the name suggesting a
-- general utility.
--
-- Not `security definer`, so no search_path pin is needed — it runs as the
-- caller and touches only the row already being written.
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
