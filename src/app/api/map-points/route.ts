import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/map-points — lightweight endpoint for map markers
 * Returns real property pins for Leaflet markerClusterGroup
 * At low zoom: up to 2000 pins from bbox (or global if no bbox)
 * At high zoom (≥13): up to 500 pins from bbox
 */
export async function GET(req: NextRequest) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const zoom = Math.min(20, Math.max(1, parseInt(sp.get("zoom") || "7", 10)));
  const isPinMode = zoom >= 13;
  const maxPoints = isPinMode ? 500 : 2000;

  type RpcClient = { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown[] | null; error: unknown }> };

  // ── Try get_map_points RPC first (skip if country filter active — RPC lacks p_country) ──
  const skipRpc = !!sp.get("country");
  try {
    if (skipRpc) throw new Error("country filter — use fallback");
    const { data: rpcData, error: rpcError } = await (client as unknown as RpcClient).rpc("get_map_points", {
      p_listing_type: sp.get("listing_type") || null,
      p_category: sp.get("category") || null,
      p_city: sp.get("city") || null,
      p_price_min: sp.get("price_min") ? Number(sp.get("price_min")) : null,
      p_price_max: sp.get("price_max") ? Number(sp.get("price_max")) : null,
      p_bounds_sw_lat: sp.get("sw_lat") ? Number(sp.get("sw_lat")) : null,
      p_bounds_sw_lon: sp.get("sw_lon") ? Number(sp.get("sw_lon")) : null,
      p_bounds_ne_lat: sp.get("ne_lat") ? Number(sp.get("ne_lat")) : null,
      p_bounds_ne_lon: sp.get("ne_lon") ? Number(sp.get("ne_lon")) : null,
      p_limit: maxPoints,
    });

    if (!rpcError && rpcData && (rpcData as unknown[]).length > 0) {
      const points = rpcData as unknown[];
      return NextResponse.json(
        { points, count: points.length, total: points.length, truncated: points.length >= maxPoints },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }
    if (rpcError) console.error("[map-points] RPC error:", rpcError);
  } catch (e) {
    console.error("[map-points] RPC exception:", e);
  }

  // ── Fallback: direct SELECT ───────────────────────────────────────────────
  const listingType = sp.get("listing_type");
  const category = sp.get("category");
  const subtype = sp.get("subtype");
  const city = sp.get("city");
  const countryParam = sp.get("country");

  // Broker / Agency filter
  let brokerIds: string[] | null = null;
  const brokerId = sp.get("broker_id");
  const agencyId = sp.get("agency_id");
  if (brokerId) {
    brokerIds = [brokerId];
  } else if (agencyId) {
    const { data: agencyBrokers } = await client
      .from("brokers")
      .select("id")
      .eq("agency_id", agencyId);
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

    if (listingType) q = q.eq("listing_type", listingType);
    if (category) {
      const cats = category.split(",");
      q = cats.length === 1 ? q.eq("category", cats[0]) : q.in("category", cats);
    }
    if (subtype) {
      const subs = subtype.split(",");
      q = subs.length === 1 ? q.eq("subtype", subs[0]) : q.in("subtype", subs);
    }
    if (city) q = q.eq("city", city);
    if (countryParam) {
      const countries = countryParam.split(",");
      q = countries.length === 1 ? q.eq("country", countries[0]) : q.in("country", countries);
    }
    if (brokerIds) q = brokerIds.length === 1 ? q.eq("broker_id", brokerIds[0]) : q.in("broker_id", brokerIds);
    if (sp.get("price_min")) q = q.gte("price", Number(sp.get("price_min")));
    if (sp.get("price_max")) q = q.lte("price", Number(sp.get("price_max")));
    if (sp.get("area_min")) q = q.gte("area", Number(sp.get("area_min")));
    if (sp.get("area_max")) q = q.lte("area", Number(sp.get("area_max")));
    if (sp.get("sw_lat")) {
      q = q.gte("latitude", Number(sp.get("sw_lat")));
      q = q.lte("latitude", Number(sp.get("ne_lat")));
      q = q.gte("longitude", Number(sp.get("sw_lon")));
      q = q.lte("longitude", Number(sp.get("ne_lon")));
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
    if (pageError) return NextResponse.json({ error: pageError.message }, { status: 500 });
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
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
