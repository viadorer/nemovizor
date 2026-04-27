-- 050_performance_indexes.sql
--
-- Missing indexes identified during audit (2026-04-23):
-- 1. brokers(agency_id) — used by filter-options RPC and agency detail
-- 2. api_request_log(api_key_id) — for per-key audit dashboard
-- 3. api_request_log(client_hash) — for per-IP analytics
-- 4. import_job_items(job_id, status) — already exists (idx_import_job_items_job_status)
--    but adding here as note
--
-- Note: We use plain CREATE INDEX (not CONCURRENTLY) because Supabase migrations
-- run inside transactions. If the table is large and locking is a concern,
-- run CREATE INDEX CONCURRENTLY manually outside this migration.

-- ─── brokers.agency_id ────────────────────────────────────────────────────

create index if not exists idx_brokers_agency_id
  on public.brokers (agency_id) where agency_id is not null;

-- ─── api_request_log ──────────────────────────────────────────────────────

create index if not exists idx_api_request_log_api_key
  on public.api_request_log (api_key_id, created_at desc) where api_key_id is not null;

create index if not exists idx_api_request_log_client_hash
  on public.api_request_log (client_hash, created_at desc) where client_hash is not null;

create index if not exists idx_api_request_log_endpoint
  on public.api_request_log (endpoint, created_at desc);

-- ─── properties helpful composite indexes ─────────────────────────────────

-- For typical "byty na prodej v ČR" filter combinations
create index if not exists idx_properties_active_listing_category_country
  on public.properties (listing_type, category, country) where active = true;

-- For broker's listing pages (sorted by created_at)
create index if not exists idx_properties_broker_created
  on public.properties (broker_id, created_at desc) where active = true;

-- ─── Comments ─────────────────────────────────────────────────────────────

comment on index public.idx_brokers_agency_id is
  'Used by filter-options RPC for agency-scoped broker resolution.';
comment on index public.idx_api_request_log_api_key is
  'Per-API-key audit dashboard — list recent requests by key.';
comment on index public.idx_properties_active_listing_category_country is
  'Common filter combination: listing_type + category + country.';
