-- 044_webhooks.sql
--
-- Webhook subscription system: outbound webhooks for property mutations.
--
-- Architecture (see /Users/davidchoc/.claude/plans/foamy-hopping-moonbeam.md):
--   1. AFTER INSERT/UPDATE/DELETE trigger on `properties` writes to
--      `webhook_outbox` (one row per event). Coverage is 100% — even
--      direct service-role inserts from scraper scripts and manual
--      Supabase Studio edits emit events.
--   2. Vercel cron `*/5 * * * *` calls /api/cron/dispatch-webhooks which
--      reads pending outbox rows, fans them out to matching subscriptions,
--      signs each delivery with HMAC-SHA256 and POSTs.
--   3. webhook_deliveries records the result of every attempt for audit.
--
-- All three tables are service-role only (RLS blocks anon and authenticated
-- entirely). Clients interact via /api/v1/webhooks/* (api-key auth, scope
-- write:webhooks).

-- ─── 1. Subscriptions ──────────────────────────────────────────────────────

create table if not exists public.webhook_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  owner_type         text not null check (owner_type in ('broker','agency','admin')),
  owner_id           uuid not null,

  -- Where deliveries are POSTed.
  url                text not null,

  -- Encrypted secret used to sign payloads. AES-256-GCM, key from
  -- WEBHOOK_SECRET_ENCRYPTION_KEY env var. Format: "v1:<iv_hex>:<ciphertext_hex>:<auth_tag_hex>"
  secret_ciphertext  text not null,
  -- First 8 chars of the raw secret (e.g. "nws_abc1") for UI display only.
  secret_prefix      text not null,

  -- Which event types this subscription wants. Default: all property events.
  event_types        text[] not null default array[
    'property.created',
    'property.updated',
    'property.deleted',
    'property.price_changed'
  ],

  -- Optional JSON filter applied at dispatch time. Supported keys:
  --   { "category": ["apartment"], "city": "Praha", "country": ["cz"],
  --     "price_min": 1000000, "price_max": 10000000,
  --     "area_min": 30, "area_max": 200, "subtype": ["2+kk"] }
  -- See src/lib/api/webhooks/filter.ts for evaluator semantics.
  filter             jsonb,

  active             boolean not null default true,
  failure_count      integer not null default 0,  -- consecutive deliveries that failed
  disabled_at        timestamptz,                 -- set when auto-disabled (after 20 failures)
  last_delivered_at  timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists idx_webhook_subs_owner
  on public.webhook_subscriptions (owner_type, owner_id);

create index if not exists idx_webhook_subs_active
  on public.webhook_subscriptions (active) where active = true;

comment on table public.webhook_subscriptions is
  'Outbound webhook subscriptions. Service role only.';
comment on column public.webhook_subscriptions.secret_ciphertext is
  'AES-256-GCM encrypted webhook signing secret. Format: v1:iv:cipher:tag (hex).';

-- ─── 2. Outbox ─────────────────────────────────────────────────────────────

create table if not exists public.webhook_outbox (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,
  property_id     uuid,
  payload         jsonb not null,
  status          text not null default 'pending'
                  check (status in ('pending','delivering','delivered','failed')),
  attempt         integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz
);

create index if not exists idx_webhook_outbox_due
  on public.webhook_outbox (status, next_attempt_at)
  where status in ('pending','delivering');

create index if not exists idx_webhook_outbox_property
  on public.webhook_outbox (property_id);

create index if not exists idx_webhook_outbox_created
  on public.webhook_outbox (created_at desc);

comment on table public.webhook_outbox is
  'Pending webhook events captured by the properties trigger. Service role only.';

-- ─── 3. Deliveries (audit trail) ────────────────────────────────────────────

create table if not exists public.webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  outbox_id       uuid not null references public.webhook_outbox(id) on delete cascade,
  subscription_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  attempt         integer not null,
  status          text not null check (status in ('success','failure')),
  http_status     integer,
  latency_ms      integer,
  response_body   text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_sub
  on public.webhook_deliveries (subscription_id, created_at desc);

create index if not exists idx_webhook_deliveries_outbox
  on public.webhook_deliveries (outbox_id);

comment on table public.webhook_deliveries is
  'One row per delivery attempt. Service role only.';

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────

alter table public.webhook_subscriptions enable row level security;
alter table public.webhook_outbox        enable row level security;
alter table public.webhook_deliveries    enable row level security;

drop policy if exists "webhook_subs_no_anon" on public.webhook_subscriptions;
create policy "webhook_subs_no_anon"
  on public.webhook_subscriptions
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "webhook_outbox_no_anon" on public.webhook_outbox;
create policy "webhook_outbox_no_anon"
  on public.webhook_outbox
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "webhook_deliveries_no_anon" on public.webhook_deliveries;
create policy "webhook_deliveries_no_anon"
  on public.webhook_deliveries
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ─── 5. Trigger function ───────────────────────────────────────────────────

create or replace function public.nemovizor_webhook_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type  text;
  v_payload     jsonb;
  v_property_id uuid;
begin
  if (tg_op = 'INSERT') then
    v_event_type := 'property.created';
    v_property_id := new.id;
    v_payload := jsonb_build_object(
      'id', new.id,
      'slug', new.slug,
      'title', new.title,
      'listing_type', new.listing_type,
      'category', new.category,
      'subtype', new.subtype,
      'city', new.city,
      'country', new.country,
      'price', new.price,
      'price_currency', new.price_currency,
      'area', new.area,
      'latitude', new.latitude,
      'longitude', new.longitude,
      'broker_id', new.broker_id,
      'created_at', new.created_at
    );

  elsif (tg_op = 'UPDATE') then
    -- Soft delete is UPDATE active=false → emit deleted instead of updated.
    if (coalesce(old.active, true) = true and coalesce(new.active, true) = false) then
      v_event_type := 'property.deleted';
    elsif (old.price is distinct from new.price and new.price is not null) then
      v_event_type := 'property.price_changed';
    else
      v_event_type := 'property.updated';
    end if;

    v_property_id := new.id;
    v_payload := jsonb_build_object(
      'id', new.id,
      'slug', new.slug,
      'title', new.title,
      'listing_type', new.listing_type,
      'category', new.category,
      'subtype', new.subtype,
      'city', new.city,
      'country', new.country,
      'price', new.price,
      'price_currency', new.price_currency,
      'area', new.area,
      'broker_id', new.broker_id,
      'updated_at', new.updated_at
    );

    if (v_event_type = 'property.price_changed') then
      v_payload := v_payload || jsonb_build_object(
        'old_price', old.price,
        'new_price', new.price
      );
    end if;

  elsif (tg_op = 'DELETE') then
    v_event_type := 'property.deleted';
    v_property_id := old.id;
    v_payload := jsonb_build_object(
      'id', old.id,
      'slug', old.slug,
      'title', old.title,
      'broker_id', old.broker_id
    );
  end if;

  insert into public.webhook_outbox (event_type, property_id, payload)
  values (v_event_type, v_property_id, v_payload);

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_properties_webhook on public.properties;
create trigger trigger_properties_webhook
  after insert or update or delete on public.properties
  for each row
  execute function public.nemovizor_webhook_capture();
