-- 046_fix_filter_options_enum_cast.sql
--
-- Complete rewrite of nemovizor_filter_options:
--   1. price_currency is an ENUM — lower() needs explicit ::text cast
--   2. Add ALL missing filter parameters: country, city, subtype,
--      price_min, price_max, area_min, area_max
--   3. Case-insensitive country/city matching

drop function if exists public.nemovizor_filter_options(text, text[], uuid[], numeric, numeric, numeric, numeric);

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
    from (
      select category as value, count(*)::int as cnt
      from base where category is not null group by category
    ) t
  ),
  city_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (
      select city as value, count(*)::int as cnt
      from base where city is not null group by city order by count(*) desc limit 100
    ) t
  ),
  subtype_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (
      select subtype as value, count(*)::int as cnt
      from base where subtype is not null group by subtype
    ) t
  ),
  lt_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (
      select listing_type as value, count(*)::int as cnt
      from base where listing_type is not null group by listing_type
    ) t
  ),
  country_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (
      select country as value, count(*)::int as cnt
      from base where country is not null group by country
    ) t
  ),
  currency_agg as (
    select jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by cnt desc) as rows
    from (
      select price_currency_norm as value, count(*)::int as cnt
      from base group by price_currency_norm
    ) t
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
