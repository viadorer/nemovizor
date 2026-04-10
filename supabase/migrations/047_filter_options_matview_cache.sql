-- 047_filter_options_matview_cache.sql
--
-- Fix unfiltered /api/filter-options taking 7.6s on 73k rows.
-- Strategy: materialized view pre-aggregates the unfiltered baseline.
-- The RPC function checks if all params are null and returns the
-- cached matview result instead of re-scanning 73k rows.
--
-- Refresh: call REFRESH MATERIALIZED VIEW CONCURRENTLY after bulk
-- inserts/updates (e.g. after scraper runs). The cron job or a
-- Supabase webhook can trigger this.

-- ─── Materialized view ────────────────────────────────────────────────────

create materialized view if not exists public.mv_filter_options_baseline as
with base as (
  select
    listing_type,
    category,
    subtype,
    city,
    country,
    price,
    area,
    coalesce(nullif(lower(price_currency::text), ''), 'czk') as price_currency_norm
  from public.properties
  where active = true
),
cat_agg as (
  select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
  from (select category as value, count(*)::int as cnt from base where category is not null group by category) t
),
city_agg as (
  select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
  from (select city as value, count(*)::int as cnt from base where city is not null group by city order by count(*) desc limit 100) t
),
subtype_agg as (
  select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
  from (select subtype as value, count(*)::int as cnt from base where subtype is not null group by subtype) t
),
lt_agg as (
  select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
  from (select listing_type as value, count(*)::int as cnt from base where listing_type is not null group by listing_type) t
),
country_agg as (
  select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
  from (select country as value, count(*)::int as cnt from base where country is not null group by country) t
),
currency_agg as (
  select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
  from (select price_currency_norm as value, count(*)::int as cnt from base group by price_currency_norm) t
),
ranges as (
  select
    coalesce(min(price) filter (where price > 0), 0)::numeric as price_min,
    coalesce(max(price), 0)::numeric as price_max,
    coalesce(min(area)  filter (where area  > 0), 0)::numeric as area_min,
    coalesce(max(area), 0)::numeric as area_max
  from base
)
select jsonb_build_object(
  'categories',   coalesce((select rows from cat_agg),      '[]'::jsonb),
  'cities',       coalesce((select rows from city_agg),     '[]'::jsonb),
  'subtypes',     coalesce((select rows from subtype_agg),  '[]'::jsonb),
  'listingTypes', coalesce((select rows from lt_agg),       '[]'::jsonb),
  'countries',    coalesce((select rows from country_agg),  '[]'::jsonb),
  'currencies',   coalesce((select rows from currency_agg), '[]'::jsonb),
  'priceRange', jsonb_build_object(
    'min', (select price_min from ranges),
    'max', (select price_max from ranges)
  ),
  'areaRange', jsonb_build_object(
    'min', (select area_min from ranges),
    'max', (select area_max from ranges)
  )
) as result;

-- Unique index required for CONCURRENTLY refresh (matview needs a unique column)
-- Since there's only 1 row, we use a constant expression.
create unique index if not exists mv_filter_options_baseline_uniq
  on public.mv_filter_options_baseline ((1));

-- ─── Update RPC to use matview for unfiltered case ────────────────────────

create or replace function public.nemovizor_filter_options(
  p_listing_type text    default null,
  p_category     text[]  default null,
  p_subtype      text[]  default null,
  p_country      text[]  default null,
  p_city         text    default null,
  p_price_min    numeric default null,
  p_price_max    numeric default null,
  p_area_min     numeric default null,
  p_area_max     numeric default null,
  p_broker_ids   uuid[]  default null,
  p_sw_lat       numeric default null,
  p_sw_lon       numeric default null,
  p_ne_lat       numeric default null,
  p_ne_lon       numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- Fast path: if ALL filters are null, return pre-computed matview (< 1ms)
  if p_listing_type is null
     and p_category is null
     and p_subtype is null
     and p_country is null
     and p_city is null
     and p_price_min is null
     and p_price_max is null
     and p_area_min is null
     and p_area_max is null
     and p_broker_ids is null
     and p_sw_lat is null
  then
    select result into v_result from public.mv_filter_options_baseline limit 1;
    if v_result is not null then
      return v_result;
    end if;
    -- matview empty or not yet refreshed — fall through to live query
  end if;

  -- Filtered path: live query with all WHERE conditions
  with base as (
    select
      listing_type,
      category,
      subtype,
      city,
      country,
      price,
      area,
      coalesce(nullif(lower(price_currency::text), ''), 'czk') as price_currency_norm
    from public.properties
    where active = true
      and (p_listing_type is null or listing_type = p_listing_type)
      and (p_category is null or array_length(p_category, 1) is null
           or category = any(p_category))
      and (p_subtype is null or array_length(p_subtype, 1) is null
           or subtype = any(p_subtype))
      and (p_country is null or array_length(p_country, 1) is null
           or lower(country) = any(select lower(unnest) from unnest(p_country)))
      and (p_city is null or lower(city) = lower(p_city))
      and (p_price_min is null or price >= p_price_min)
      and (p_price_max is null or price <= p_price_max)
      and (p_area_min  is null or area  >= p_area_min)
      and (p_area_max  is null or area  <= p_area_max)
      and (p_broker_ids is null or array_length(p_broker_ids, 1) is null
           or broker_id = any(p_broker_ids))
      and (
        p_sw_lat is null or p_sw_lon is null or p_ne_lat is null or p_ne_lon is null
        or (latitude  >= p_sw_lat and latitude  <= p_ne_lat
            and longitude >= p_sw_lon and longitude <= p_ne_lon)
      )
  ),
  cat_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (select category as value, count(*)::int as cnt from base where category is not null group by category) t
  ),
  city_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (select city as value, count(*)::int as cnt from base where city is not null group by city order by count(*) desc limit 100) t
  ),
  subtype_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (select subtype as value, count(*)::int as cnt from base where subtype is not null group by subtype) t
  ),
  lt_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (select listing_type as value, count(*)::int as cnt from base where listing_type is not null group by listing_type) t
  ),
  country_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (select country as value, count(*)::int as cnt from base where country is not null group by country) t
  ),
  currency_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (select price_currency_norm as value, count(*)::int as cnt from base group by price_currency_norm) t
  ),
  ranges as (
    select
      coalesce(min(price) filter (where price > 0), 0)::numeric as price_min,
      coalesce(max(price), 0)::numeric as price_max,
      coalesce(min(area)  filter (where area  > 0), 0)::numeric as area_min,
      coalesce(max(area), 0)::numeric as area_max
    from base
  )
  select jsonb_build_object(
    'categories',   coalesce((select rows from cat_agg),      '[]'::jsonb),
    'cities',       coalesce((select rows from city_agg),     '[]'::jsonb),
    'subtypes',     coalesce((select rows from subtype_agg),  '[]'::jsonb),
    'listingTypes', coalesce((select rows from lt_agg),       '[]'::jsonb),
    'countries',    coalesce((select rows from country_agg),  '[]'::jsonb),
    'currencies',   coalesce((select rows from currency_agg), '[]'::jsonb),
    'priceRange', jsonb_build_object(
      'min', (select price_min from ranges),
      'max', (select price_max from ranges)
    ),
    'areaRange', jsonb_build_object(
      'min', (select area_min from ranges),
      'max', (select area_max from ranges)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ─── Cron-friendly refresh function ───────────────────────────────────────

create or replace function public.refresh_filter_options_baseline()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.mv_filter_options_baseline;
$$;

grant execute on function public.refresh_filter_options_baseline to service_role;

-- ─── Permissions ──────────────────────────────────────────────────────────

grant select on public.mv_filter_options_baseline to anon, authenticated, service_role;
grant execute on function public.nemovizor_filter_options to anon, authenticated, service_role;

-- ─── Add composite indexes for filtered queries ──────────────────────────

create index if not exists idx_properties_active_price
  on public.properties (price) where active = true;
create index if not exists idx_properties_active_area
  on public.properties (area) where active = true;
create index if not exists idx_properties_active_country_lower
  on public.properties (lower(country)) where active = true;
create index if not exists idx_properties_active_city_lower
  on public.properties (lower(city)) where active = true;
