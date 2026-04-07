import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseQuery } from "@/lib/api/validate";
import { MapPointsQuerySchema } from "@/lib/api/schemas/map-points";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/map-points — lightweight endpoint for map markers
 * Returns real property pins for Leaflet markerClusterGroup
 * At low zoom: up to 2000 pins from bbox (or global if no bbox)
 * At high zoom (≥13): up to 500 pins from bbox
 *
 * Full contract: see OpenAPI at /api/openapi (MapPointsQuery / MapPointsResponse).
 */
export async function GET(req: NextRequest) {
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["map-points"]);
  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return rateLimitResponse(rl);

  const client = getSupabase();
  if (!client) {
    return apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503);
  }

  const parsed = parseQuery(req.nextUrl.searchParams, MapPointsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const qp = parsed.data;

  const zoom = qp.zoom ?? 7;
  const isPinMode = zoom >= 13;
  const maxPoints = isPinMode ? 500 : 2000;

  // Broker / Agency filter
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
      return NextResponse.json({ points: [], count: 0, total: 0, truncated: false });
    }
  }

  function buildQuery() {
    let q = client!
      .from("properties")
      .select("id, latitude, longitude, price, price_currency, category, listing_type, title, slug, rooms_label, image_src, subtype, area, district")
      .eq("active", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .neq("latitude", 0)
      .neq("longitude", 0);

    if (qp.listing_type) q = q.eq("listing_type", qp.listing_type);
    if (qp.category) {
      q = qp.category.length === 1 ? q.eq("category", qp.category[0]) : q.in("category", qp.category);
    }
    if (qp.subtype) {
      q = qp.subtype.length === 1 ? q.eq("subtype", qp.subtype[0]) : q.in("subtype", qp.subtype);
    }
    if (qp.city) q = q.eq("city", qp.city);
    if (qp.country) {
      q = qp.country.length === 1 ? q.eq("country", qp.country[0]) : q.in("country", qp.country);
    }
    if (brokerIds) q = brokerIds.length === 1 ? q.eq("broker_id", brokerIds[0]) : q.in("broker_id", brokerIds);
    if (qp.price_min !== undefined) q = q.gte("price", qp.price_min);
    if (qp.price_max !== undefined) q = q.lte("price", qp.price_max);
    if (qp.area_min !== undefined) q = q.gte("area", qp.area_min);
    if (qp.area_max !== undefined) q = q.lte("area", qp.area_max);
    if (qp.sw_lat !== undefined && qp.ne_lat !== undefined && qp.sw_lon !== undefined && qp.ne_lon !== undefined) {
      q = q.gte("latitude", qp.sw_lat);
      q = q.lte("latitude", qp.ne_lat);
      q = q.gte("longitude", qp.sw_lon);
      q = q.lte("longitude", qp.ne_lon);
    }
    return q;
  }

  type MapRow = { id: string; latitude: number; longitude: number; price: number; price_currency: string | null; category: string; listing_type: string; title: string; slug: string; rooms_label: string; image_src: string | null; subtype: string | null; area: number | null; district: string | null };

  const pageSize = 1000;
  const numPages = Math.ceil(maxPoints / pageSize);
  const pagePromises = Array.from({ length: numPages }, (_, i) =>
    buildQuery().order("featured", { ascending: false }).order("price", { ascending: false }).range(i * pageSize, Math.min((i + 1) * pageSize - 1, maxPoints - 1))
  );

  const pageResults = await Promise.all(pagePromises);
  const allRows: MapRow[] = [];
  for (const { data: pageData, error: pageError } of pageResults) {
    if (pageError) return apiError("INTERNAL_ERROR", pageError.message, 500);
    const rows = (pageData || []) as MapRow[];
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }

  const points = allRows.map((p) => ({
    id: p.id,
    lat: p.latitude,
    lon: p.longitude,
    price: p.price,
    price_currency: p.price_currency,
    category: p.category,
    listing_type: p.listing_type,
    title: p.title,
    slug: p.slug,
    rooms_label: p.rooms_label,
    image_src: p.image_src,
    subtype: p.subtype,
    area: p.area,
    district: p.district,
  }));

  return NextResponse.json(
    { points, count: points.length, total: points.length, truncated: points.length >= maxPoints },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        ...rateLimitHeaders(rl),
      },
    }
  );
}
