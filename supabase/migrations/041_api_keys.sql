-- 041_api_keys.sql
--
-- API keys for the public Nemovizor API.
-- One key per broker or per agency. Keys are never stored in plain text
-- — only a SHA-256 hash is persisted, plus a short visible prefix so the
-- admin UI / CLI can identify which key is which without revealing secrets.

create table if not exists public.api_keys (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  key_hash             text not null unique,                 -- sha256 hex
  key_prefix           text not null,                        -- first 8 chars of the raw key (display only)
  owner_type           text not null check (owner_type in ('broker', 'agency')),
  owner_id             uuid not null,
  scopes               text[] not null default array['public:read'],
  rate_limit_per_min   integer not null default 300,
  created_at           timestamptz not null default now(),
  last_used_at         timestamptz,
  expires_at           timestamptz,
  revoked_at           timestamptz
);

create index if not exists idx_api_keys_owner on public.api_keys (owner_type, owner_id);
create index if not exists idx_api_keys_key_prefix on public.api_keys (key_prefix);

-- Row Level Security: only service role (admin client) can touch this table.
-- The API key lookup path must use the admin client — never the anon key.
alter table public.api_keys enable row level security;

-- Block anon/auth completely; service role bypasses RLS automatically.
drop policy if exists "api_keys_no_anon" on public.api_keys;
create policy "api_keys_no_anon"
  on public.api_keys
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.api_keys is 'Hashed API keys for programmatic access to the Nemovizor public API. See src/lib/api/api-key.ts.';
comment on column public.api_keys.key_hash is 'SHA-256 hex of the raw key. The raw key is never stored.';
comment on column public.api_keys.key_prefix is 'First 8 chars of the raw key (including the `nvz_` prefix). Used for display only.';
comment on column public.api_keys.rate_limit_per_min is 'Per-key sliding-window rate limit ceiling in requests per minute.';
