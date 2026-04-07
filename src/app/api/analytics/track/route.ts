import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { AnalyticsTrackBodySchema } from "@/lib/api/schemas/analytics-track";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/track
 * Accepts a JSON body that is either a single event object or an array of events.
 * Full contract: see OpenAPI at /api/openapi (AnalyticsTrackBody / AnalyticsTrackResponse).
 */
export async function POST(req: NextRequest) {
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["analytics-track"]);
  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return rateLimitResponse(rl);

  const client = getSupabase();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") || "";

  const parsed = await parseBody(req, AnalyticsTrackBodySchema);
  if (!parsed.ok) return parsed.response;

  const raw: Record<string, unknown>[] = Array.isArray(parsed.data)
    ? (parsed.data as Record<string, unknown>[])
    : [parsed.data as Record<string, unknown>];

  const rows = raw
    .map((e) => ({
      session_id: String(e.session_id || "").slice(0, 64),
      user_id: e.user_id ? String(e.user_id) : null,
      event_type: String(e.event_type || "").slice(0, 64),
      properties: (e.properties && typeof e.properties === "object" ? e.properties : {}) as Record<string, unknown>,
      url: String(e.url || "").slice(0, 500),
      referrer: String(e.referrer || "").slice(0, 500),
      ip_address: ip,
      user_agent: ua.slice(0, 300),
      device_type: String(e.device_type || "").slice(0, 16),
    }))
    .filter((r) => r.session_id && r.event_type);

  if (rows.length === 0)
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store", ...rateLimitHeaders(rl) } },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any).from("analytics_events").insert(rows);
  if (error) console.error("[analytics/track]", error.message);

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", ...rateLimitHeaders(rl) } },
  );
}
