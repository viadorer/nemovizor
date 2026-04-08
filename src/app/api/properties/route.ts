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
import { fetchProperties } from "@/lib/api/properties-data";
import { createAuditTap } from "@/lib/api/audit-log";

// Ensure the handler runs on every request so the in-memory rate limiter
// actually sees traffic (otherwise Next.js may cache the response).
export const dynamic = "force-dynamic";

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

/**
 * GET /api/properties – paginated, server-side filtered property list (legacy
 * snake_case surface used by the Nemovizor frontend).
 *
 * Field filtering: applies `legacyPropertyView` via `fetchProperties()` →
 * removes broker PII (phone, email) but preserves all property business
 * fields (commission, mortgage_percent, …) for backwards compatibility.
 *
 * Full query/response contract: see OpenAPI at /api/openapi (PropertiesQuery / PropertiesResponse).
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS.properties);
  const tap = createAuditTap({ endpoint: "/api/properties", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  const client = getClient();
  if (!client) {
    return tap(apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503));
  }

  const parsed = parseQuery(req.nextUrl.searchParams, PropertiesQuerySchema);
  if (!parsed.ok) return tap(parsed.response);

  const result = await fetchProperties(client, parsed.data, "legacy");

  if ("error" in result) {
    return tap(apiError("INTERNAL_ERROR", result.error, 500));
  }

  // Legacy response keeps offset fields but also includes `next_cursor` so
  // clients can opportunistically switch to cursor pagination on the next
  // call. `next_cursor` is `null` on the last page; existing clients ignore
  // unknown fields, so this is non-breaking.
  const body: Record<string, unknown> = {
    data: result.data,
    total: result.total,
    page: result.page,
    pages: result.pages,
    limit: result.limit,
    next_cursor: result.next_cursor,
  };

  return tap(NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      ...rateLimitHeaders(rl),
    },
  }));
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
