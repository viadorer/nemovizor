-- 049_import_api.sql
--
-- Async batch Import API for CRMs (PTF, Realman, etc.)
-- Database-driven job queue: import_jobs + import_job_items
-- Processed by Vercel cron /api/cron/process-imports every minute.

-- ─── Add external_id tracking to entities that lack it ────────────────────

alter table public.agencies add column if not exists external_id text;
alter table public.agencies add column if not exists external_source text;
create unique index if not exists idx_agencies_external
  on public.agencies (external_id, external_source) where external_id is not null;

alter table public.brokers add column if not exists external_id text;
alter table public.brokers add column if not exists external_source text;
create unique index if not exists idx_brokers_external
  on public.brokers (external_id, external_source) where external_id is not null;

alter table public.branches add column if not exists external_id text;
alter table public.branches add column if not exists external_source text;
create unique index if not exists idx_branches_external
  on public.branches (external_id, external_source) where external_id is not null;

-- ─── import_jobs ──────────────────────────────────────────────────────────

create table if not exists public.import_jobs (
  id                uuid primary key default gen_random_uuid(),
  api_key_id        uuid not null references public.api_keys(id),
  agency_id         uuid not null references public.agencies(id),
  external_source   text not null default 'api',
  status            text not null default 'pending'
                    check (status in ('pending', 'processing', 'completed', 'failed')),
  total_items       integer not null default 0,
  completed_items   integer not null default 0,
  failed_items      integer not null default 0,
  warned_items      integer not null default 0,
  skipped_items     integer not null default 0,
  callback_url      text,
  deactivate_missing boolean not null default false,
  payload_summary   jsonb,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz
);

create index if not exists idx_import_jobs_pending
  on public.import_jobs (status, created_at) where status in ('pending', 'processing');
create index if not exists idx_import_jobs_agency
  on public.import_jobs (agency_id, created_at desc);

-- ─── import_job_items ─────────────────────────────────────────────────────

create table if not exists public.import_job_items (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.import_jobs(id) on delete cascade,
  entity_type         text not null check (entity_type in ('agency', 'branch', 'broker', 'property')),
  external_id         text not null,
  sort_order          integer not null default 0,
  status              text not null default 'pending'
                      check (status in ('pending', 'processing', 'success', 'warning', 'error', 'skipped')),
  nemovizor_id        uuid,
  nemovizor_slug      text,
  action              text check (action in ('created', 'updated', 'unchanged', 'deactivated')),
  warnings            text[] not null default '{}',
  errors              text[] not null default '{}',
  processing_time_ms  integer,
  payload             jsonb not null,
  created_at          timestamptz not null default now(),
  processed_at        timestamptz
);

create index if not exists idx_import_job_items_job_order
  on public.import_job_items (job_id, sort_order);
create index if not exists idx_import_job_items_job_status
  on public.import_job_items (job_id, status);

-- ─── RLS: service role only ───────────────────────────────────────────────

alter table public.import_jobs enable row level security;
drop policy if exists "import_jobs_no_anon" on public.import_jobs;
create policy "import_jobs_no_anon"
  on public.import_jobs for all to anon, authenticated
  using (false) with check (false);

alter table public.import_job_items enable row level security;
drop policy if exists "import_job_items_no_anon" on public.import_job_items;
create policy "import_job_items_no_anon"
  on public.import_job_items for all to anon, authenticated
  using (false) with check (false);

-- ─── Comments ─────────────────────────────────────────────────────────────

comment on table public.import_jobs is
  'Async batch import jobs. Created by POST /api/v1/import/batch, processed by cron worker.';
comment on table public.import_job_items is
  'Individual entities within an import batch. Each row = one agency/branch/broker/property.';
comment on column public.import_job_items.sort_order is
  'Processing order: agency=0, branches=100+, brokers=200+, properties=300+. Ensures dependencies are resolved first.';
