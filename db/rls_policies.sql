-- Row Level Security for the expenses table
--
-- ⚠ REGENERATED 2026-08-10 by introspecting the live database.
--
-- This file previously declared four separate policies — one each for select,
-- insert, update and delete. Production has one policy covering all four
-- commands. The effect is identical (`user_id = auth.uid()` in both USING and
-- WITH CHECK), so nothing was insecure; the file was just describing a
-- different shape from the one that exists, which makes it useless as a
-- reference when you are trying to work out what is actually enforced.
--
-- Recorded as production has it.

alter table expenses enable row level security;

-- USING governs which rows are visible to select/update/delete; WITH CHECK
-- governs what insert/update may write. Both are the same condition here: a
-- user reaches exactly their own rows, and cannot stamp a row with anyone
-- else's id.
--
-- This is the real authorization boundary for expense data. src/proxy.ts is an
-- optimistic redirect for the sake of not flashing the wrong page, and says so
-- in its own header comment — if it were deleted, nothing would leak.
drop policy if exists "Users manage own expenses" on expenses;
create policy "Users manage own expenses"
  on expenses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
