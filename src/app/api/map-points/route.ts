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
  let query = client
    .from("properties")
    .select("id, latitude, longitude, price, price_currency, category, listing_type, title, slug, rooms_label")
    .eq("active", true);

  const listingType = sp.get("listing_type");
  const category = sp.get("category");
  const subtype = sp.get("subtype");
  const city = sp.get("city");

  if (listingType) query = query.eq("listing_type", listingType);
  if (category) {
    const cats = category.split(",");
    query = cats.length === 1 ? query.eq("category", cats[0]) : query.in("category", cats);
  }
  if (subtype) {
    const subs = subtype.split(",");
    query = subs.length === 1 ? query.eq("subtype", subs[0]) : query.in("subtype", subs);
  }
  if (city) query = query.eq("city", city);
  if (sp.get("price_min")) query = query.gte("price", Number(sp.get("price_min")));
  if (sp.get("price_max")) query = query.lte("price", Number(sp.get("price_max")));
  if (sp.get("area_min")) query = query.gte("area", Number(sp.get("area_min")));
  if (sp.get("area_max")) query = query.lte("area", Number(sp.get("area_max")));

  // Bounds filter (without PostGIS)
  if (sp.get("sw_lat")) {
    query = query.gte("latitude", Number(sp.get("sw_lat")));
    query = query.lte("latitude", Number(sp.get("ne_lat")));
    query = query.gte("longitude", Number(sp.get("sw_lon")));
    query = query.lte("longitude", Number(sp.get("ne_lon")));
  }

  query = query.limit(Math.min(Number(sp.get("limit") || "5000"), 5000));

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type MapRow = { id: string; latitude: number; longitude: number; price: number; price_currency: string | null; category: string; listing_type: string; title: string; slug: string; rooms_label: string };
  const points = ((data || []) as MapRow[]).map((p) => ({
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
  }));

  return NextResponse.json(
    { points, count: points.length },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
  );
}
