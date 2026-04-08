-- 043_api_audit_log.sql
--
-- Per-request audit log for the public Nemovizor API.
--
-- Goal: enable per-key activity inspection, abuse detection, error-rate
-- monitoring and basic latency observability — without compromising the
-- privacy of anonymous callers.
--
-- Privacy model:
--   • For API-key requests: full attribution (`api_key_id` is set).
--   • For anonymous requests: only a SHA-256 hash of the source IP, salted
--     with a daily-rotating value. Same IP hashed on different days produces
--     different digests, so we can rate-aggregate "unique callers per day"
--     without ever storing a re-identifiable IP.
--
-- Retention: 90 days, enforced by the /api/cron/cleanup-audit-log endpoint
-- registered in vercel.json.

create table if not exists public.api_request_log (
  id              uuid primary key default gen_random_uuid(),
  api_key_id      uuid references public.api_keys(id) on delete set null,
  client_hash     text,                  -- SHA-256(ip + daily salt) when anon
  endpoint        text not null,         -- e.g. "/api/v1/properties"
  method          text not null,         -- "GET" / "POST" / ...
  status          integer not null,
  latency_ms      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Per-key activity lookups (admin dashboard, abuse triage).
create index if not exists idx_api_request_log_key_time
  on public.api_request_log (api_key_id, created_at desc);

-- Retention sweep + global "recent activity" view.
create index if not exists idx_api_request_log_created_at
  on public.api_request_log (created_at desc);

-- Per-endpoint analytics (which paths get hammered).
create index if not exists idx_api_request_log_endpoint_time
  on public.api_request_log (endpoint, created_at desc);

-- Service role only — no public access. /api/* handlers will write through
-- the supabaseAdmin client (which bypasses RLS).
alter table public.api_request_log enable row level security;

drop policy if exists "api_request_log_no_anon" on public.api_request_log;
create policy "api_request_log_no_anon"
  on public.api_request_log
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.api_request_log is
  'Per-request audit log for /api/* endpoints. Service role only. anon/authenticated have zero access (use admin endpoints to read).';
comment on column public.api_request_log.client_hash is
  'SHA-256(IP + daily salt). NULL when api_key_id is set.';
