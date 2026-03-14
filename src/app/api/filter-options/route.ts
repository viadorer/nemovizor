import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/filter-options — aggregate counts for filter dropdowns
 * Returns available filter values with counts, optionally filtered by current selections
 */
export async function GET(req: NextRequest) {
  const client = getSupabase();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const listingType = sp.get("listing_type") || null;
  const category = sp.get("category") || null;

  // Use fallback approach (standard Supabase queries, no custom RPC needed)
  return await fallbackFilterOptions(client, listingType, category);
}

/** Fallback using standard Supabase queries (no custom RPC needed) */
async function fallbackFilterOptions(
  client: ReturnType<typeof getSupabase>,
  listingType: string | null,
  category: string | null
) {
  if (!client) return NextResponse.json({ error: "No client" }, { status: 503 });

  // Fetch a lightweight subset to compute aggregates client-side
  let query = client
    .from("properties")
    .select("listing_type, category, subtype, city, price, area")
    .eq("active", true);

  if (listingType) query = query.eq("listing_type", listingType as string);
  if (category) {
    const cats = category.split(",");
    query = cats.length === 1 ? query.eq("category", cats[0]) : query.in("category", cats);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type FilterRow = { listing_type: string | null; category: string | null; subtype: string | null; city: string | null; price: number | null; area: number | null };
  const rows = (data || []) as FilterRow[];

  // Aggregate
  const categoryMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const subtypeMap = new Map<string, number>();
  const ltMap = new Map<string, number>();
  let priceMin = Infinity, priceMax = 0, areaMin = Infinity, areaMax = 0;

  for (const r of rows) {
    if (r.category) categoryMap.set(r.category, (categoryMap.get(r.category) || 0) + 1);
    if (r.city) cityMap.set(r.city, (cityMap.get(r.city) || 0) + 1);
    if (r.subtype) subtypeMap.set(r.subtype, (subtypeMap.get(r.subtype) || 0) + 1);
    if (r.listing_type) ltMap.set(r.listing_type, (ltMap.get(r.listing_type) || 0) + 1);
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
      priceRange: { min: priceMin === Infinity ? 0 : priceMin, max: priceMax },
      areaRange: { min: areaMin === Infinity ? 0 : areaMin, max: areaMax },
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
  );
}
