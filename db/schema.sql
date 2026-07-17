-- expenses table (matches live Supabase schema)

create table if not exists expenses (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  merchant    text        not null,
  date        date        not null,
  total       numeric(10, 2) not null,
  tax         numeric(10, 2),
  category    text
);

-- Auto-update updated_at on row changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on expenses
  for each row
  execute function update_updated_at();
