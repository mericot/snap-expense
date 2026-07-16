-- Run this in the Supabase SQL Editor to create the expenses table
-- If the table already exists, drop it first: DROP TABLE IF EXISTS expenses;

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  merchant    text not null,
  date        date not null,
  total       numeric(10, 2) not null,
  tax         numeric(10, 2),
  category    text
);

-- Enable Row Level Security
alter table expenses enable row level security;

-- Each user can only see and modify their own rows
create policy "Users manage own expenses" on expenses
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
