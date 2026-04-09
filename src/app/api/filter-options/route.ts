import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseQuery } from "@/lib/api/validate";
import { FilterOptionsQuerySchema } from "@/lib/api/schemas/filter-options";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
  type RateLimitResult,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/filter-options — aggregate counts for filter dropdowns
 * Returns available filter values with counts, optionally filtered by current selections.
 * Full contract: see OpenAPI at /api/openapi (FilterOptionsQuery / FilterOptionsResponse).
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["filter-options"]);
  const tap = createAuditTap({ endpoint: "/api/filter-options", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  const client = getSupabase();
  if (!client) {
    return tap(apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503));
  }

  const parsed = parseQuery(req.nextUrl.searchParams, FilterOptionsQuerySchema);
  if (!parsed.ok) return tap(parsed.response);
  const qp = parsed.data;

  const listingType = qp.listing_type ?? null;
  const category = qp.category ?? null;
  const hasBounds =
    qp.sw_lat !== undefined && qp.sw_lon !== undefined && qp.ne_lat !== undefined && qp.ne_lon !== undefined;

  // Resolve broker IDs for agency filter
  let brokerIds: string[] | null = null;
  if (qp.broker_id) {
    brokerIds = [qp.broker_id];
  } else if (qp.agency_id) {
    const { data: agencyBrokers } = await client
      .from("brokers")
      .select("id")
      .eq("agency_id", qp.agency_id);
    if (agencyBrokers && agencyBrokers.length > 0) {
      brokerIds = agencyBrokers.map((b: { id: string }) => b.id);
    } else {
      return tap(NextResponse.json(
        {
          categories: [], cities: [], subtypes: [], listingTypes: [],
          priceRange: { min: 0, max: 0 }, areaRange: { min: 0, max: 0 },
        },
        { headers: rateLimitHeaders(rl) },
      ));
    }
  }

  const bounds = hasBounds
    ? { swLat: qp.sw_lat!, swLon: qp.sw_lon!, neLat: qp.ne_lat!, neLon: qp.ne_lon! }
    : null;

  // Fast path: call the SQL function from migration 045. This replaces a
  // 73-page runtime iteration (~7.6s on 72k rows) with a single GROUP BY
  // query (~100ms). Falls through to the legacy runtime aggregation if the
  // RPC is missing (migration not yet applied) or returns an error.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcClient = client as any;
    const { data: rpcData, error: rpcError } = await rpcClient.rpc(
      "nemovizor_filter_options",
      {
        p_listing_type: listingType ?? null,
        p_category: category ?? null,
        p_broker_ids: brokerIds ?? null,
        p_sw_lat: bounds?.swLat ?? null,
        p_sw_lon: bounds?.swLon ?? null,
        p_ne_lat: bounds?.neLat ?? null,
        p_ne_lon: bounds?.neLon ?? null,
      },
    );
    if (!rpcError && rpcData) {
      return tap(
        NextResponse.json(rpcData, {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
            ...rateLimitHeaders(rl),
          },
        }),
      );
    }
    if (rpcError) {
      console.warn(
        "[filter-options] RPC failed, falling back to runtime aggregation:",
        rpcError.message,
      );
    }
  } catch (e) {
    console.warn(
      "[filter-options] RPC threw, falling back:",
      e instanceof Error ? e.message : String(e),
    );
  }

  // Legacy slow path — kept as a fallback until migration 045 is applied
  // on every environment. Safe to delete once production is confirmed on
  // the RPC path.
  return tap(await fallbackFilterOptions(client, listingType, category, brokerIds, bounds, rl));
}

/** Fallback using standard Supabase queries (no custom RPC needed) */
async function fallbackFilterOptions(
  client: ReturnType<typeof getSupabase>,
  listingType: string | null,
  category: string[] | null,
  brokerIds: string[] | null = null,
  bounds: { swLat: number; swLon: number; neLat: number; neLon: number } | null = null,
  rl: RateLimitResult | null = null,
) {
  if (!client) return apiError("SERVICE_UNAVAILABLE", "No client", 503);

  // Fetch all active properties in pages (Supabase caps at 1000 per request)
  function buildQuery() {
    let q = client!
      .from("properties")
      .select("listing_type, category, subtype, city, country, price, area, price_currency")
      .eq("active", true);
    if (listingType) q = q.eq("listing_type", listingType);
    if (category) {
      q = category.length === 1 ? q.eq("category", category[0]) : q.in("category", category);
    }
    if (brokerIds) {
      q = brokerIds.length === 1 ? q.eq("broker_id", brokerIds[0]) : q.in("broker_id", brokerIds);
    }
    if (bounds) {
      q = q.gte("latitude", bounds.swLat).lte("latitude", bounds.neLat)
           .gte("longitude", bounds.swLon).lte("longitude", bounds.neLon);
    }
    return q;
  }

  const pageSize = 1000;
  const allData: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data: page, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) return apiError("INTERNAL_ERROR", error.message, 500);
    if (!page || page.length === 0) break;
    allData.push(...page);
    if (page.length < pageSize) break;
  }

  type FilterRow = { listing_type: string | null; category: string | null; subtype: string | null; city: string | null; country: string | null; price: number | null; area: number | null; price_currency: string | null };
  const rows = allData as FilterRow[];

  // Aggregate
  const categoryMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const subtypeMap = new Map<string, number>();
  const ltMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const currencyMap = new Map<string, number>();
  let priceMin = Infinity, priceMax = 0, areaMin = Infinity, areaMax = 0;

  for (const r of rows) {
    if (r.category) categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + 1);
    if (r.city) cityMap.set(r.city, (cityMap.get(r.city) || 0) + 1);
    if (r.subtype) subtypeMap.set(r.subtype, (subtypeMap.get(r.subtype) || 0) + 1);
    if (r.listing_type) ltMap.set(r.listing_type, (ltMap.get(r.listing_type) || 0) + 1);
    if (r.country) countryMap.set(r.country, (countryMap.get(r.country) || 0) + 1);
    const cur = (r.price_currency || "czk").toLowerCase();
    currencyMap.set(cur, (currencyMap.get(cur) || 0) + 1);
    if (r.price && r.price > 0) { priceMin = Math.min(priceMin, r.price); priceMax = Math.max(priceMax, r.price); }
    if (r.area && r.area > 0) { areaMin = Math.min(areaMin, r.area); areaMax = Math.max(areaMax, r.area); }
  }

  const toArr = (m: Map<string, number>) =>
    [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);

  return NextResponse.json(
    {
      categories: toArr(categoryMap),
      cities: toArr(cityMap).slice(0, 100),
      subtypes: toArr(subtypeMap),
      listingTypes: toArr(ltMap),
      countries: toArr(countryMap),
      currencies: toArr(currencyMap),
      priceRange: { min: priceMin === Infinity ? 0 : priceMin, max: priceMax },
      areaRange: { min: areaMin === Infinity ? 0 : areaMin, max: areaMax },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        ...(rl ? rateLimitHeaders(rl) : {}),
      },
    }
  );
}
