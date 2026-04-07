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
import { toCamelCase, toSnakeKey } from "@/lib/api/camelcase";

/**
 * GET /api/v1/properties — public, recommended surface for external clients
 * and AI agents.
 *
 * Differences from /api/properties:
 *   • Removes broker PII (phone/email) AND property business fields
 *     (commission, mortgage_percent, …) — see `v1PropertyView`.
 *   • Response keys are camelCase.
 *   • Query params accept BOTH camelCase and snake_case (camelCase is
 *     normalised to snake_case before validation).
 *   • Supports cursor pagination via `?cursor=...`; response includes
 *     `nextCursor` field.
 *
 * Rate limit, auth context, and underlying SQL are shared with the legacy
 * /api/properties handler via `fetchProperties(..., "v1")`.
 */
export const dynamic = "force-dynamic";

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

/** Rewrite all camelCase keys in URLSearchParams back to snake_case. */
function normaliseQueryKeys(searchParams: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    out.append(toSnakeKey(key), value);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS.properties);
  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return rateLimitResponse(rl);

  const client = getClient();
  if (!client) {
    return apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503);
  }

  const normalisedParams = normaliseQueryKeys(req.nextUrl.searchParams);
  const parsed = parseQuery(normalisedParams, PropertiesQuerySchema);
  if (!parsed.ok) return parsed.response;

  const result = await fetchProperties(client, parsed.data, "v1");
  if ("error" in result) {
    return apiError("INTERNAL_ERROR", result.error, 500);
  }

  // Camelize the entire response (top-level keys + every row's nested keys).
  const camel = toCamelCase({
    data: result.data,
    total: result.total,
    page: result.page,
    pages: result.pages,
    limit: result.limit,
    next_cursor: result.next_cursor,
  }) as Record<string, unknown>;

  return NextResponse.json(camel, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      ...rateLimitHeaders(rl),
    },
  });
}
