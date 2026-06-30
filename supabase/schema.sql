-- Run this in the Supabase SQL Editor to create the expenses table
-- If the table already exists, drop it first: DROP TABLE IF EXISTS expenses;

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  merchant    text not null,
  date        date not null,
  total       numeric(10, 2) not null,
  tax         numeric(10, 2),
  category    text
);

-- Enable Row Level Security
alter table expenses enable row level security;

-- Allow all operations (tighten later with auth)
create policy "Allow all" on expenses
  for all
  using (true)
  with check (true);
