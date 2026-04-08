/**
 * Broker self-service API audit log.
 *
 * Returns rows from `api_request_log` where `api_key_id` belongs to an
 * API key owned by the authenticated broker (or their agency team).
 * Anonymous requests (client_hash IS NOT NULL) are NEVER visible to
 * brokers — those are only in the admin dashboard.
 *
 * This scope rule is enforced by:
 *   1. Resolving the caller's broker scope
 *   2. Fetching their api_key ids from api_keys where owner matches
 *   3. Using .in("api_key_id", ids) in the audit query
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { resolveBrokerScope } from "@/lib/api/broker-scope";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminClient(): any | null {
  return supabaseAdmin;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const scope = await resolveBrokerScope(auth.supabase, auth.user.id);

  // Find all api_key ids owned by the caller's broker/agency.
  const ownerFilters: Array<{ type: "broker" | "agency"; ids: string[] }> = [];
  if (scope.brokerIds.length > 0) ownerFilters.push({ type: "broker", ids: scope.brokerIds });
  if (scope.agencyId) ownerFilters.push({ type: "agency", ids: [scope.agencyId] });
  if (ownerFilters.length === 0) {
    return NextResponse.json({
      data: [],
      total: 0,
      aggregate: { window_total: 0, success: 0, client_error: 0, server_error: 0, rate_limited: 0, avg_latency_ms: 0 },
    });
  }

  const keyIds: string[] = [];
  for (const f of ownerFilters) {
    const { data } = await client
      .from("api_keys")
      .select("id")
      .eq("owner_type", f.type)
      .in("owner_id", f.ids);
    if (data) {
      for (const row of data as Array<{ id: string }>) keyIds.push(row.id);
    }
  }
  if (keyIds.length === 0) {
    return NextResponse.json({
      data: [],
      total: 0,
      aggregate: { window_total: 0, success: 0, client_error: 0, server_error: 0, rate_limited: 0, avg_latency_ms: 0 },
    });
  }

  const sp = req.nextUrl.searchParams;
  const apiKeyFilter = sp.get("api_key_id"); // optional narrower filter
  const endpoint = sp.get("endpoint");
  const statusFilter = sp.get("status");
  const sinceParam = sp.get("since");
  const limitParam = sp.get("limit");

  const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(limitParam || "100", 10) || 100));
  const sinceIso = sinceParam
    ? new Date(sinceParam).toISOString()
    : new Date(Date.now() - 24 * 3_600_000).toISOString();

  // The broker's narrower filter must be a subset of their owned keys.
  let effectiveKeyIds = keyIds;
  if (apiKeyFilter) {
    if (!keyIds.includes(apiKeyFilter)) {
      return apiError("FORBIDDEN", "That API key does not belong to you", 403);
    }
    effectiveKeyIds = [apiKeyFilter];
  }

  let query = client
    .from("api_request_log")
    .select("id, api_key_id, endpoint, method, status, latency_ms, created_at", { count: "exact" })
    .in("api_key_id", effectiveKeyIds)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (endpoint) query = query.eq("endpoint", endpoint);
  if (statusFilter) {
    const n = parseInt(statusFilter, 10);
    if (Number.isFinite(n)) query = query.eq("status", n);
  }

  const { data, error, count } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  // Aggregate over the same window (without limit).
  let aggQuery = client
    .from("api_request_log")
    .select("status, latency_ms")
    .in("api_key_id", effectiveKeyIds)
    .gte("created_at", sinceIso);
  if (endpoint) aggQuery = aggQuery.eq("endpoint", endpoint);
  const { data: aggRows } = await aggQuery;

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
      window_total: (aggRows || []).length,
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
