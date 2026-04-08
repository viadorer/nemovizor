/**
 * GET /api/admin/api-audit — read the per-request audit log.
 *
 * Admin-only. Supports filtering by api_key_id, endpoint, status, and a
 * time window. Default returns the most recent 100 rows from the last
 * 24 hours.
 *
 * The endpoint is intentionally NOT in the public OpenAPI spec — it is
 * an internal operations tool, not a customer-facing API.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Admin authentication required", 401);

  const client = supabaseAdmin;
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const sp = req.nextUrl.searchParams;
  const apiKeyId = sp.get("api_key_id");
  const endpoint = sp.get("endpoint");
  const statusFilter = sp.get("status");
  const sinceParam = sp.get("since");
  const limitParam = sp.get("limit");

  const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(limitParam || "100", 10) || 100));
  const sinceIso = sinceParam
    ? new Date(sinceParam).toISOString()
    : new Date(Date.now() - 24 * 3_600_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  let query = c
    .from("api_request_log")
    .select("id, api_key_id, client_hash, endpoint, method, status, latency_ms, created_at", { count: "exact" })
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (apiKeyId) query = query.eq("api_key_id", apiKeyId);
  if (endpoint) query = query.eq("endpoint", endpoint);
  if (statusFilter) {
    const n = parseInt(statusFilter, 10);
    if (Number.isFinite(n)) query = query.eq("status", n);
  }

  const { data, error, count } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  // Aggregate quick stats over the same window (without limit) so the UI
  // can show "1234 requests in last 24h" without a second round trip.
  let aggQuery = c
    .from("api_request_log")
    .select("status, latency_ms", { count: "exact", head: false })
    .gte("created_at", sinceIso);
  if (apiKeyId) aggQuery = aggQuery.eq("api_key_id", apiKeyId);
  if (endpoint) aggQuery = aggQuery.eq("endpoint", endpoint);
  const { data: aggRows, count: totalCount } = await aggQuery;

  let success = 0;
  let clientErr = 0;
  let serverErr = 0;
  let rateLimited = 0;
  let latencySum = 0;
  let latencyN = 0;
  for (const r of (aggRows || []) as Array<{ status: number; latency_ms: number }>) {
    if (r.status >= 200 && r.status < 300) success++;
    else if (r.status === 429) rateLimited++;
    else if (r.status >= 400 && r.status < 500) clientErr++;
    else if (r.status >= 500) serverErr++;
    if (typeof r.latency_ms === "number") {
      latencySum += r.latency_ms;
      latencyN++;
    }
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    aggregate: {
      window_total: totalCount ?? 0,
      success,
      client_error: clientErr,
      server_error: serverErr,
      rate_limited: rateLimited,
      avg_latency_ms: latencyN > 0 ? Math.round(latencySum / latencyN) : 0,
    },
    window_since: sinceIso,
    limit,
  });
}
