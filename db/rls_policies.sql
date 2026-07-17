-- Row Level Security for expenses table

alter table expenses enable row level security;

-- Users can only read their own expenses
create policy "Users can view own expenses"
  on expenses for select
  using (user_id = auth.uid());

-- Users can only insert expenses stamped with their own user_id
create policy "Users can insert own expenses"
  on expenses for insert
  with check (user_id = auth.uid());

-- Users can only update rows they own
create policy "Users can update own expenses"
  on expenses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can only delete rows they own
create policy "Users can delete own expenses"
  on expenses for delete
  using (user_id = auth.uid());
