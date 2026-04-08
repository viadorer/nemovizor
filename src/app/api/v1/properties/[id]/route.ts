import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";
import { fetchPropertyById } from "@/lib/api/properties-data";
import { toCamelCase } from "@/lib/api/camelcase";
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

/**
 * GET /api/v1/properties/{id} — fetch a single active property by UUID.
 *
 * Response shape: `{ data: PropertyDto }` where PropertyDto is camelCase
 * and runs through `v1PropertyView` (no business fields, no broker PII).
 *
 * Rate limit: shared with the list endpoint (`properties` bucket).
 *
 * Returns:
 *   200 — found
 *   400 — id is not a valid UUID
 *   404 — not found or inactive
 *   429 — rate limit exceeded
 *   503 — Supabase not configured
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const { id } = await context.params;

  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS.properties);
  const tap = createAuditTap({ endpoint: "/api/v1/properties/{id}", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  if (!id || !UUID_RE.test(id)) {
    return tap(apiError("VALIDATION_ERROR", "Invalid property id (must be a UUID)", 400));
  }

  const client = getClient();
  if (!client) {
    return tap(apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503));
  }

  const result = await fetchPropertyById(client, id, "v1");
  if (result === null) {
    return tap(apiError("NOT_FOUND", "Property not found", 404));
  }
  if (result && typeof result === "object" && "error" in result) {
    return tap(apiError("INTERNAL_ERROR", (result as { error: string }).error, 500));
  }

  const camel = toCamelCase({ data: result }) as Record<string, unknown>;

  return tap(NextResponse.json(camel, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      ...rateLimitHeaders(rl),
    },
  }));
}
