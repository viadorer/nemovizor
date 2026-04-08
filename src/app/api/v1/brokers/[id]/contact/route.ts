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
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

/**
 * GET /api/v1/brokers/{id}/contact — explicit, rate-limited PII access.
 *
 * Why this endpoint exists:
 *   The list/detail property endpoints (/api/v1/properties{,/[id]}) deliberately
 *   strip broker `phone` and `email` to prevent mass harvesting of personally
 *   identifiable information. Clients that need to display a single broker's
 *   contact (e.g. a property detail page that wants to show a "call" link)
 *   call THIS endpoint with the specific broker id, after a meaningful user
 *   action.
 *
 * Anti-harvesting:
 *   • Strict per-IP rate limit (10/min, configurable in TIER1_RATE_LIMITS).
 *   • API key callers get the per-key ceiling instead, but their requests
 *     are tracked (future audit log) so abuse can be detected and the key
 *     revoked.
 *
 * Response shape:
 *   200 — { data: { id, name, slug, phone, email } }
 *   400 — invalid uuid
 *   404 — broker not found or inactive
 *   429 — rate limit exceeded
 *   503 — Supabase not configured
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const { id } = await context.params;

  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["broker-contact"]);
  const tap = createAuditTap({ endpoint: "/api/v1/brokers/{id}/contact", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  if (!id || !UUID_RE.test(id)) {
    return tap(apiError("VALIDATION_ERROR", "Invalid broker id (must be a UUID)", 400));
  }

  const client = getClient();
  if (!client) {
    return tap(apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  const { data, error } = await c
    .from("brokers")
    .select("id, name, slug, phone, email")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return tap(apiError("INTERNAL_ERROR", error.message, 500));
  }
  if (!data) {
    return tap(apiError("NOT_FOUND", "Broker not found", 404));
  }

  return tap(NextResponse.json(
    {
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        phone: data.phone ?? null,
        email: data.email ?? null,
      },
    },
    {
      headers: {
        // Don't cache PII responses at the edge — keep them per-request only.
        "Cache-Control": "private, no-store",
        ...rateLimitHeaders(rl),
      },
    },
  ));
}
