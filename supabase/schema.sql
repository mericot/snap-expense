-- Run this in the Supabase SQL Editor to create the expenses table

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  date        date not null,
  merchant    text not null,
  amount      numeric(10, 2) not null,
  currency    text not null default 'USD',
  category    text,
  description text,
  image_url   text
);

-- Optional: enable Row Level Security (RLS)
alter table expenses enable row level security;

-- Allow all operations for now (tighten later with auth)
create policy "Allow all" on expenses
  for all
  using (true)
  with check (true);
