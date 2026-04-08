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
import { fetchPropertyBySlug } from "@/lib/api/properties-data";
import { toCamelCase } from "@/lib/api/camelcase";
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

/**
 * GET /api/v1/properties/by-slug/{slug} — fetch a single active property by
 * its URL slug. Useful for SEO-friendly external URLs that mirror the slug
 * shown in Nemovizor's own listing detail pages.
 *
 * Response shape, filtering, and rate limiting are identical to
 * /api/v1/properties/{id}.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const startedAt = Date.now();
  const { slug } = await context.params;

  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS.properties);
  const tap = createAuditTap({ endpoint: "/api/v1/properties/by-slug/{slug}", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  if (!slug || typeof slug !== "string" || slug.length < 1 || slug.length > 300) {
    return tap(apiError("VALIDATION_ERROR", "Invalid slug", 400));
  }

  const client = getClient();
  if (!client) {
    return tap(apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503));
  }

  const result = await fetchPropertyBySlug(client, slug, "v1");
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
