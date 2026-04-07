import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseQuery } from "@/lib/api/validate";
import { PropertiesQuerySchema } from "@/lib/api/schemas/properties";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";

// Ensure the handler runs on every request so the in-memory rate limiter
// actually sees traffic (otherwise Next.js may cache the response).
export const dynamic = "force-dynamic";

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

/**
 * GET /api/properties – paginated, server-side filtered property list
 *
 * Full query/response contract: see OpenAPI at /api/openapi (PropertiesQuery / PropertiesResponse).
 */
export async function GET(req: NextRequest) {
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS.properties);
  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return rateLimitResponse(rl);

  const client = getClient();
  if (!client) {
    return apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503);
  }

  const parsed = parseQuery(req.nextUrl.searchParams, PropertiesQuerySchema);
  if (!parsed.ok) return parsed.response;
  const q = parsed.data;

  const page = q.page ?? 1;
  const limit = q.limit ?? 24;
  const offset = (page - 1) * limit;

  // Build query with server-side filters
  let query = client
    .from("properties")
    .select("*, brokers(id, name, phone, photo, slug, agency_name)", { count: "exact" })
    .eq("active", true);

  if (q.listing_type) query = query.eq("listing_type", q.listing_type);
  if (q.category) {
    query = q.category.length === 1 ? query.eq("category", q.category[0]) : query.in("category", q.category);
  }
  if (q.subtype) {
    query = q.subtype.length === 1 ? query.eq("subtype", q.subtype[0]) : query.in("subtype", q.subtype);
  }
  if (q.city) query = query.eq("city", q.city);
  if (q.country) {
    query = q.country.length === 1 ? query.eq("country", q.country[0]) : query.in("country", q.country);
  }

  // Broker / Agency filter
  if (q.broker_id) {
    query = query.eq("broker_id", q.broker_id);
  } else if (q.agency_id) {
    const { data: agencyBrokers } = await client
      .from("brokers")
      .select("id")
      .eq("agency_id", q.agency_id);
    if (agencyBrokers && agencyBrokers.length > 0) {
      const ids = agencyBrokers.map((b: { id: string }) => b.id);
      query = query.in("broker_id", ids);
    } else {
      // No brokers in agency → no results
      return NextResponse.json({ data: [], total: 0, page, pages: 0, limit });
    }
  }

  if (q.price_min !== undefined) query = query.gte("price", q.price_min);
  if (q.price_max !== undefined) query = query.lte("price", q.price_max);
  if (q.area_min !== undefined) query = query.gte("area", q.area_min);
  if (q.area_max !== undefined) query = query.lte("area", q.area_max);

  // Bounds filter (map viewport)
  if (q.sw_lat !== undefined && q.ne_lat !== undefined && q.sw_lon !== undefined && q.ne_lon !== undefined) {
    query = query.gte("latitude", q.sw_lat);
    query = query.lte("latitude", q.ne_lat);
    query = query.gte("longitude", q.sw_lon);
    query = query.lte("longitude", q.ne_lon);
  }

  // Sort
  const sort = q.sort ?? "featured";
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
    return apiError("INTERNAL_ERROR", error.message, 500);
  }

  const total = count ?? 0;
  const now = new Date().toISOString();

  // Expire featured + filter placeholder URLs
  const isPlaceholder = (url: unknown) => typeof url === "string" && url.includes("placeholder.com");
  const rows = (data || []).map((row: Record<string, unknown>) => {
    const r = { ...row };
    if (r.featured && r.featured_until && (r.featured_until as string) < now) {
      r.featured = false;
    }
    if (isPlaceholder(r.image_src)) r.image_src = "/branding/placeholder.png";
    if (Array.isArray(r.images)) r.images = (r.images as string[]).filter((u) => !isPlaceholder(u));
    return r;
  });

  return NextResponse.json(
    { data: rows, total, page, pages: Math.ceil(total / limit), limit },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        ...rateLimitHeaders(rl),
      },
    },
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
