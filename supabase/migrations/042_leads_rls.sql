-- 042_leads_rls.sql
--
-- Create the `leads` table (if it doesn't already exist) and enable
-- Row-Level Security on it.
--
-- Background: leads holds full PII (name, email, phone, address, free-form
-- notes). Earlier audit found that the existing supabase-types.ts referenced
-- a `leads` table but no migration ever created it (the type entry must have
-- been generated against a manually-created table on a different env). To
-- guarantee the schema exists across all environments AND that RLS is in
-- place, this migration is self-contained: it creates the table idempotently
-- and then applies the security policies.
--
-- Security model after this migration:
--   • anonymous + authenticated clients can INSERT (preserves /api/leads POST)
--   • anonymous clients cannot SELECT, UPDATE, or DELETE (CRITICAL)
--   • authenticated brokers/admins can SELECT and UPDATE
--   • only admins can DELETE
--   • the service role bypasses RLS entirely (used by /api/leads handler)

-- ─── 1. Table ──────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default '',
  email           text not null default '',
  phone           text not null default '',
  property_type   text not null default '',
  intent          text not null default '',
  address         text not null default '',
  note            text not null default '',
  source          text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_email on public.leads (email);
create index if not exists idx_leads_source on public.leads (source);

comment on table public.leads is 'Lead capture (PII). Anon: INSERT only. Authenticated brokers/admins: SELECT/UPDATE. Admins: DELETE. Service role bypasses RLS.';

-- ─── 2. Row-Level Security ─────────────────────────────────────────────────

alter table public.leads enable row level security;

-- Anonymous and authenticated users can submit leads (the /api/leads path
-- and any future broker self-service form). Service role bypasses this.
drop policy if exists "leads_insert_public" on public.leads;
create policy "leads_insert_public"
  on public.leads
  for insert
  to anon, authenticated
  with check (true);

-- Anonymous users cannot read leads under any circumstances.
drop policy if exists "leads_no_select_anon" on public.leads;
create policy "leads_no_select_anon"
  on public.leads
  for select
  to anon
  using (false);

-- Authenticated users may read leads only if they have role broker or admin.
drop policy if exists "leads_select_authenticated_brokers_admins" on public.leads;
create policy "leads_select_authenticated_brokers_admins"
  on public.leads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'broker')
    )
  );

-- Block anonymous mutations explicitly.
drop policy if exists "leads_no_update_anon" on public.leads;
create policy "leads_no_update_anon"
  on public.leads
  for update
  to anon
  using (false)
  with check (false);

drop policy if exists "leads_no_delete_anon" on public.leads;
create policy "leads_no_delete_anon"
  on public.leads
  for delete
  to anon
  using (false);

-- Authenticated brokers/admins may update leads (e.g. mark as contacted).
drop policy if exists "leads_update_authenticated_brokers_admins" on public.leads;
create policy "leads_update_authenticated_brokers_admins"
  on public.leads
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'broker')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'broker')
    )
  );

-- Only admins may permanently delete leads.
drop policy if exists "leads_delete_authenticated_admins" on public.leads;
create policy "leads_delete_authenticated_admins"
  on public.leads
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
