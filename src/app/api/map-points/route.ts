import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/map-points — lightweight endpoint for map markers
 * Uses PostGIS RPC function for fast spatial queries
 * Returns: { points: [{ id, lat, lon, price, category, listing_type, title, slug, rooms_label }] }
 */
export async function GET(req: NextRequest) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;

  // Try RPC function first (PostGIS), fallback to simple query
  try {
    const { data: rpcData, error: rpcError } = await (client as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown[] | null; error: unknown }> }).rpc("get_map_points", {
      p_listing_type: sp.get("listing_type") || null,
      p_category: sp.get("category") || null,
      p_city: sp.get("city") || null,
      p_price_min: sp.get("price_min") ? Number(sp.get("price_min")) : null,
      p_price_max: sp.get("price_max") ? Number(sp.get("price_max")) : null,
      p_bounds_sw_lat: sp.get("sw_lat") ? Number(sp.get("sw_lat")) : null,
      p_bounds_sw_lon: sp.get("sw_lon") ? Number(sp.get("sw_lon")) : null,
      p_bounds_ne_lat: sp.get("ne_lat") ? Number(sp.get("ne_lat")) : null,
      p_bounds_ne_lon: sp.get("ne_lon") ? Number(sp.get("ne_lon")) : null,
      p_limit: sp.get("limit") ? Number(sp.get("limit")) : 5000,
    });

    if (!rpcError && rpcData) {
      return NextResponse.json(
        { points: rpcData, count: (rpcData as unknown[]).length },
        { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
      );
    }
  } catch {
    // RPC not available, use fallback
  }

  // Fallback: simple select (no PostGIS)
  const listingType = sp.get("listing_type");
  const category = sp.get("category");
  const subtype = sp.get("subtype");
  const city = sp.get("city");

  function buildQuery() {
    let q = client!
      .from("properties")
      .select("id, latitude, longitude, price, price_currency, category, listing_type, title, slug, rooms_label, image_src, subtype, area, district")
      .eq("active", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

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

  const maxPoints = Math.min(Number(sp.get("limit") || "5000"), 10000);

  // Supabase caps at 1000 rows per request — fetch pages in parallel
  type MapRow = { id: string; latitude: number; longitude: number; price: number; price_currency: string | null; category: string; listing_type: string; title: string; slug: string; rooms_label: string; image_src: string | null; subtype: string | null; area: number | null; district: string | null };
  const pageSize = 1000;
  const numPages = Math.ceil(maxPoints / pageSize);

  // Count query — separate builder without heavy select
  function buildCountQuery() {
    let q = client!
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

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

  // Fetch count + data pages in parallel
  const pagePromises = Array.from({ length: numPages }, (_, i) =>
    buildQuery().range(i * pageSize, (i + 1) * pageSize - 1)
  );
  const [countResult, ...pageResults] = await Promise.all([buildCountQuery(), ...pagePromises]);
  const totalCount = countResult.count ?? 0;

  const allRows: MapRow[] = [];
  for (const { data: pageData, error: pageError } of pageResults) {
    if (pageError) {
      return NextResponse.json({ error: pageError.message }, { status: 500 });
    }
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
    { points, count: points.length, total: totalCount, truncated: points.length < totalCount },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
  );
}
