-- Persist the extraction's confidence alongside the receipt.
--
-- The model returns a confidence, and src/lib/receipt-schema.ts forces it down
-- to 'low' when the receipt disagrees with itself — subtotal + tax + tip not
-- matching the total is how a plausible-looking misread gets caught. Until now
-- that signal was emitted to analytics and then dropped at save time, so the
-- aggregate was visible on a dashboard while the individual receipt it applied
-- to was not. Nobody could answer "which of these fifteen should I check?".
--
-- Nullable on purpose. Every row that already exists predates the column and
-- has no confidence to record; NULL says "not assessed", which is honest and
-- distinct from 'high'. The UI treats only an explicit 'low' as needing review,
-- so existing receipts are unaffected.
--
-- Additive and non-breaking: no default, no backfill, no RLS change. The
-- existing policies are row-scoped by user_id and cover every column.
alter table expenses add column if not exists confidence text;

comment on column expenses.confidence is
  'Extraction confidence at save time: high, low, or null for rows saved before this column existed. Forced to low by the server''s consistency checks, so it is not purely the model''s own opinion.';
