import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

/**
 * GET /api/properties – paginated, server-side filtered property list
 *
 * Query params:
 *   page (default 1), limit (default 24)
 *   listing_type, category, subtype, city
 *   price_min, price_max, area_min, area_max
 *   sort: price_asc | price_desc | newest | area_desc (default: featured)
 *
 * Returns: { data, total, page, pages, limit }
 */
export async function GET(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? "24")));
  const offset = (page - 1) * limit;

  // Build query with server-side filters
  let query = client
    .from("properties")
    .select("*, brokers(id, name, phone, photo, slug, agency_name)", { count: "exact" })
    .eq("active", true);

  // Apply filters
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

  const country = sp.get("country");
  if (country) {
    const countries = country.split(",");
    query = countries.length === 1 ? query.eq("country", countries[0]) : query.in("country", countries);
  }

  // Broker / Agency filter
  const brokerId = sp.get("broker_id");
  const agencyId = sp.get("agency_id");
  if (brokerId) {
    query = query.eq("broker_id", brokerId);
  } else if (agencyId) {
    const { data: agencyBrokers } = await client
      .from("brokers")
      .select("id")
      .eq("agency_id", agencyId);
    if (agencyBrokers && agencyBrokers.length > 0) {
      const ids = agencyBrokers.map((b: { id: string }) => b.id);
      query = query.in("broker_id", ids);
    } else {
      // No brokers in agency → no results
      return NextResponse.json({ data: [], total: 0, page, pages: 0, limit });
    }
  }

  if (sp.get("price_min")) query = query.gte("price", Number(sp.get("price_min")));
  if (sp.get("price_max")) query = query.lte("price", Number(sp.get("price_max")));
  if (sp.get("area_min")) query = query.gte("area", Number(sp.get("area_min")));
  if (sp.get("area_max")) query = query.lte("area", Number(sp.get("area_max")));

  // Bounds filter (map viewport)
  if (sp.get("sw_lat")) {
    query = query.gte("latitude", Number(sp.get("sw_lat")));
    query = query.lte("latitude", Number(sp.get("ne_lat")));
    query = query.gte("longitude", Number(sp.get("sw_lon")));
    query = query.lte("longitude", Number(sp.get("ne_lon")));
  }

  // Sort
  const sort = sp.get("sort") || "featured";
  switch (sort) {
    case "price_asc":
      query = query.gt("price", 0).order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.gt("price", 0).order("price", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "area_desc":
      query = query.order("area", { ascending: false });
      break;
    case "area_asc":
      query = query.order("area", { ascending: true });
      break;
    default: // "featured"
      query = query.order("featured", { ascending: false }).order("created_at", { ascending: false });
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;

  return NextResponse.json(
    { data, total, page, pages: Math.ceil(total / limit), limit },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

/** POST /api/properties – vložit novou nemovitost */
export async function POST(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = await req.json();

  // Validace povinných polí
  const required = ["slug", "title", "listing_type", "category", "subtype", "rooms_label", "price", "city", "district", "location_label", "latitude", "longitude", "area", "summary"];
  const missing = required.filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await client
    .from("properties")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}

/** PATCH /api/properties?id=xxx – update nemovitosti */
export async function PATCH(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing ?id parameter" }, { status: 400 });
  }

  const body = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("properties")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

/** DELETE /api/properties?id=xxx – smazat nemovitost */
export async function DELETE(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing ?id parameter" }, { status: 400 });
  }

  const { error } = await client.from("properties").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
