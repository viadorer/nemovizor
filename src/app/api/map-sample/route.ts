import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/map-sample — lightweight sample of lat/lon points for Leaflet visual clustering
 * Returns a representative sample (max 3000) + total count for scaleFactor calculation.
 * No bbox — global sample so Leaflet can cluster naturally without re-fetching on pan.
 */
export async function GET(req: NextRequest) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const listingType = sp.get("listing_type");
  const category = sp.get("category");
  const city = sp.get("city");
  const country = sp.get("country");
  const priceMin = sp.get("price_min") ? Number(sp.get("price_min")) : null;
  const priceMax = sp.get("price_max") ? Number(sp.get("price_max")) : null;
  const areaMin = sp.get("area_min") ? Number(sp.get("area_min")) : null;
  const areaMax = sp.get("area_max") ? Number(sp.get("area_max")) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any): any {
    q = q.eq("active", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .neq("latitude", 0)
      .neq("longitude", 0);
    if (listingType) q = q.eq("listing_type", listingType);
    if (category) {
      const cats = category.split(",");
      q = cats.length === 1 ? q.eq("category", cats[0]) : q.in("category", cats);
    }
    if (city) q = q.eq("city", city);
    if (country) {
      const countries = country.split(",");
      q = countries.length === 1 ? q.eq("country", countries[0]) : q.in("country", countries);
    }
    if (priceMin) q = q.gte("price", priceMin);
    if (priceMax) q = q.lte("price", priceMax);
    if (areaMin) q = q.gte("area", areaMin);
    if (areaMax) q = q.lte("area", areaMax);
    return q;
  }

  const SAMPLE_LIMIT = 3000;
  const [countResult, sampleResult] = await Promise.all([
    applyFilters(client.from("properties").select("id", { count: "exact", head: true })),
    applyFilters(client.from("properties").select("latitude,longitude")).limit(SAMPLE_LIMIT),
  ]);

  if (sampleResult.error) {
    return NextResponse.json({ error: sampleResult.error.message }, { status: 500 });
  }

  const total: number = countResult.count ?? 0;
  const points = ((sampleResult.data || []) as { latitude: number; longitude: number }[]).map((r) => ({
    lat: r.latitude,
    lon: r.longitude,
  }));
  const scaleFactor = points.length > 0 ? total / points.length : 1;

  return NextResponse.json(
    { points, total, scaleFactor },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
