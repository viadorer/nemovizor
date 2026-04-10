-- 048_api_subscriptions.sql
--
-- Stripe Subscriptions for API key monetization.
-- Ties Stripe subscription lifecycle to API key rate limits and scopes.

-- ─── api_subscriptions ────────────────────────────────────────────────────

create table if not exists public.api_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id      text not null,
  stripe_subscription_id  text not null unique,
  stripe_price_id         text not null,
  plan_tier               text not null check (plan_tier in ('starter', 'pro', 'enterprise')),
  status                  text not null default 'incomplete'
                          check (status in ('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'paused')),
  rate_limit_per_min      integer not null,
  max_webhooks            integer not null default 10,
  scopes                  text[] not null default array['read:public'],
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at               timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_api_subscriptions_user
  on public.api_subscriptions (user_id);
create index if not exists idx_api_subscriptions_customer
  on public.api_subscriptions (stripe_customer_id);

-- RLS: service role only (same pattern as api_keys in 041)
alter table public.api_subscriptions enable row level security;

drop policy if exists "api_subscriptions_no_anon" on public.api_subscriptions;
create policy "api_subscriptions_no_anon"
  on public.api_subscriptions
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Auto-update updated_at
create trigger trigger_api_subscriptions_updated_at
  before update on public.api_subscriptions
  for each row
  execute function update_updated_at();

-- ─── ALTER api_keys: link to subscription ─────────────────────────────────

alter table public.api_keys
  add column if not exists subscription_id uuid references public.api_subscriptions(id) on delete set null;

create index if not exists idx_api_keys_subscription
  on public.api_keys (subscription_id) where subscription_id is not null;

-- ─── ALTER profiles: store Stripe customer ID ─────────────────────────────

alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists idx_profiles_stripe_customer
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

-- ─── Comments ─────────────────────────────────────────────────────────────

comment on table public.api_subscriptions is
  'Stripe subscription records for API key tiers (Starter/Pro/Enterprise). Denormalized plan limits for fast lookups.';
comment on column public.api_subscriptions.plan_tier is
  'Tier name: starter (990 CZK/mo), pro (4900 CZK/mo), enterprise (19900 CZK/mo).';
comment on column public.api_subscriptions.rate_limit_per_min is
  'Rate limit ceiling from the subscribed plan. Propagated to linked api_keys on plan changes.';
comment on column public.api_keys.subscription_id is
  'Links key to its subscription. NULL = free-tier or legacy key (keeps working at existing rate).';
