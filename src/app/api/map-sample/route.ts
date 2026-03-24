import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/map-sample — random sample of lat/lon points for Leaflet visual clustering
 * Uses get_map_sample RPC (ORDER BY RANDOM()) so sample is geographically representative.
 * Returns max 3000 points + total count for scaleFactor calculation.
 * No bbox — global sample so Leaflet clusters naturally without re-fetching on pan.
 */
export async function GET(req: NextRequest) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const listingType = sp.get("listing_type") || null;
  const category = sp.get("category") || null;
  const priceMin = sp.get("price_min") ? Number(sp.get("price_min")) : null;
  const priceMax = sp.get("price_max") ? Number(sp.get("price_max")) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RpcClient = { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown[] | null; error: unknown }> };

  try {
    const [countResult, sampleResult] = await Promise.all([
      // Count total matching properties
      (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = client.from("properties")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .not("latitude", "is", null)
          .neq("latitude", 0);
        if (listingType) q = q.eq("listing_type", listingType);
        if (category) {
          const cats = category.split(",");
          q = cats.length === 1 ? q.eq("category", cats[0]) : q.in("category", cats);
        }
        if (priceMin) q = q.gte("price", priceMin);
        if (priceMax) q = q.lte("price", priceMax);
        return q;
      })(),
      // Random sample via RPC
      (client as unknown as RpcClient).rpc("get_map_sample", {
        p_limit: 3000,
        p_listing_type: listingType,
        p_category: category,
        p_price_min: priceMin,
        p_price_max: priceMax,
      }),
    ]);

    const total: number = (countResult as { count: number | null }).count ?? 0;

    if (!sampleResult.error && sampleResult.data) {
      const points = (sampleResult.data as { lat: number; lon: number }[]).filter(
        (r) => r.lat && r.lon
      );
      const scaleFactor = points.length > 0 ? total / points.length : 1;
      return NextResponse.json(
        { points, total, scaleFactor },
        { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
      );
    }

    if (sampleResult.error) {
      console.error("[map-sample] RPC error:", sampleResult.error);
    }
  } catch (e) {
    console.error("[map-sample] error:", e);
  }

  // Fallback: stratified sample using 3 offset ranges for geographic spread
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any): any {
    q = q.eq("active", true).not("latitude", "is", null).neq("latitude", 0);
    if (listingType) q = q.eq("listing_type", listingType);
    if (category) {
      const cats = category.split(",");
      q = cats.length === 1 ? q.eq("category", cats[0]) : q.in("category", cats);
    }
    if (priceMin) q = q.gte("price", priceMin);
    if (priceMax) q = q.lte("price", priceMax);
    return q;
  }

  const countRes = await applyFilters(
    client.from("properties").select("id", { count: "exact", head: true })
  );
  const total = countRes.count ?? 0;
  const step = Math.floor(total / 3);

  const [b1, b2, b3] = await Promise.all([
    applyFilters(client.from("properties").select("latitude,longitude")).range(0, 999),
    step > 1000
      ? applyFilters(client.from("properties").select("latitude,longitude")).range(step, step + 999)
      : Promise.resolve({ data: [], error: null }),
    step * 2 > 2000
      ? applyFilters(client.from("properties").select("latitude,longitude")).range(step * 2, step * 2 + 999)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const rows = [
    ...((b1.data || []) as { latitude: number; longitude: number }[]),
    ...((b2.data || []) as { latitude: number; longitude: number }[]),
    ...((b3.data || []) as { latitude: number; longitude: number }[]),
  ];
  const points = rows.filter((r) => r.latitude && r.longitude).map((r) => ({ lat: r.latitude, lon: r.longitude }));
  const scaleFactor = points.length > 0 ? total / points.length : 1;

  return NextResponse.json(
    { points, total, scaleFactor },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
  );
}
