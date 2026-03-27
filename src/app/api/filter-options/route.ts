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
  const brokerId = sp.get("broker_id") || null;
  const agencyId = sp.get("agency_id") || null;

  // Resolve broker IDs for agency filter
  let brokerIds: string[] | null = null;
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
      return NextResponse.json({
        categories: [], cities: [], subtypes: [], listingTypes: [],
        priceRange: { min: 0, max: 0 }, areaRange: { min: 0, max: 0 },
      });
    }
  }

  // Use fallback approach (standard Supabase queries, no custom RPC needed)
  return await fallbackFilterOptions(client, listingType, category, brokerIds);
}

/** Fallback using standard Supabase queries (no custom RPC needed) */
async function fallbackFilterOptions(
  client: ReturnType<typeof getSupabase>,
  listingType: string | null,
  category: string | null,
  brokerIds: string[] | null = null,
) {
  if (!client) return NextResponse.json({ error: "No client" }, { status: 503 });

  // Fetch all active properties in pages (Supabase caps at 1000 per request)
  function buildQuery() {
    let q = client!
      .from("properties")
      .select("listing_type, category, subtype, city, country, price, area, price_currency")
      .eq("active", true);
    if (listingType) q = q.eq("listing_type", listingType as string);
    if (category) {
      const cats = category.split(",");
      q = cats.length === 1 ? q.eq("category", cats[0]) : q.in("category", cats);
    }
    if (brokerIds) {
      q = brokerIds.length === 1 ? q.eq("broker_id", brokerIds[0]) : q.in("broker_id", brokerIds);
    }
    return q;
  }

  const pageSize = 1000;
  const allData: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data: page, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
  );
}
