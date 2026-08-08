-- Subscriptions table — links Supabase auth users to Stripe billing state.
-- Run this in the Supabase SQL Editor after schema.sql and rls_policies.sql.

create table if not exists subscriptions (
  id                      uuid        primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  user_id                 uuid        not null references auth.users(id) on delete cascade unique,
  stripe_customer_id      text        unique,
  stripe_subscription_id  text        unique,
  stripe_price_id         text,
  plan                    text        not null default 'free'
    check (plan in ('free', 'pro', 'team')),
  status                  text        not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean     not null default false,
  seats                   int         not null default 1
    check (seats >= 1)
);

-- Auto-update updated_at (reuses the function from schema.sql)
create trigger set_subscriptions_updated_at
  before update on subscriptions
  for each row
  execute function update_updated_at();

-- Indexes for webhook lookups
create index if not exists idx_subscriptions_stripe_customer
  on subscriptions (stripe_customer_id);
create index if not exists idx_subscriptions_stripe_subscription
  on subscriptions (stripe_subscription_id);

-- Row Level Security
alter table subscriptions enable row level security;

-- Users can read their own subscription
create policy "Users can view own subscription"
  on subscriptions for select
  using (user_id = auth.uid());

-- Users can insert their own subscription (initial creation from checkout)
create policy "Users can insert own subscription"
  on subscriptions for insert
  with check (user_id = auth.uid());

-- Only the service role (webhook handler) should update subscriptions.
-- No user-facing update/delete policies — Stripe webhooks use the service
-- role key to sync state, preventing users from modifying their own plan.

-- Auto-create a free subscription when a user signs up
create or replace function create_default_subscription()
returns trigger as $$
begin
  insert into subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function create_default_subscription();

-- Helper: look up the current plan for a user (used by API routes to gate features)
create or replace function get_user_plan(p_user_id uuid)
returns table (
  plan text,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  seats int
) as $$
begin
  return query
    select
      s.plan,
      s.status,
      s.trial_ends_at,
      s.current_period_end,
      s.cancel_at_period_end,
      s.seats
    from subscriptions s
    where s.user_id = p_user_id
    limit 1;
end;
$$ language plpgsql security definer;
