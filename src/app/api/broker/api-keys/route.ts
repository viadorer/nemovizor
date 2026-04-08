/**
 * Broker self-service API keys CRUD.
 *
 * Parallel to /api/admin/api-keys but scoped to the authenticated broker's
 * own keys only (or their whole agency team's keys if they own an agency).
 * Uses cookie session auth via requireAuth(["broker","admin"]), not API key
 * auth — brokers manage keys from the Nemovizor dashboard after login.
 *
 * Security model:
 *   • requireAuth gates the route to role broker/admin
 *   • resolveBrokerScope() returns the ownerId(s) the caller may act on
 *   • listing filters by owner_type/owner_id; creation uses the caller's
 *     primary owner (agency > solo broker); deletion verifies the row
 *     belongs to one of the caller's broker/agency scopes
 *
 * Why duplicate admin logic instead of reusing /api/admin/api-keys?
 * The admin route uses requireAuth(["admin"]) and sees all rows. Brokers
 * need their own scoped view, and admin endpoints should never be
 * callable by brokers. Separate handler = clean authz boundary.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { CreateApiKeyBodySchema } from "@/lib/api/schemas/admin-api-keys";
import {
  DEFAULT_SCOPES,
  generateApiKey,
  hashApiKey,
  prefixApiKey,
} from "@/lib/api/api-key";
import {
  primaryOwner,
  resolveBrokerScope,
} from "@/lib/api/broker-scope";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminClient(): any | null {
  return supabaseAdmin;
}

interface OwnerScope {
  brokerIds: string[];
  agencyId: string | null;
  ownBrokerId: string | null;
}

/**
 * Build the OR clause used to list keys owned by the caller.
 *   (owner_type='broker' AND owner_id IN (brokerIds))
 *   OR (owner_type='agency' AND owner_id = agencyId)
 */
function listOwnerFilter(scope: OwnerScope): Array<{ type: "broker" | "agency"; ids: string[] }> {
  const filters: Array<{ type: "broker" | "agency"; ids: string[] }> = [];
  if (scope.brokerIds.length > 0) filters.push({ type: "broker", ids: scope.brokerIds });
  if (scope.agencyId) filters.push({ type: "agency", ids: [scope.agencyId] });
  return filters;
}

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const scope = await resolveBrokerScope(auth.supabase, auth.user.id);
  const filters = listOwnerFilter(scope);
  if (filters.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Supabase .or() doesn't handle this shape cleanly — run separate
  // queries and merge client-side. Row counts are small (≤50).
  const rows: unknown[] = [];
  for (const f of filters) {
    const { data, error } = await client
      .from("api_keys")
      .select(
        "id, name, key_prefix, owner_type, owner_id, scopes, rate_limit_per_min, created_at, last_used_at, expires_at, revoked_at",
      )
      .eq("owner_type", f.type)
      .in("owner_id", f.ids)
      .order("created_at", { ascending: false });
    if (error) return apiError("INTERNAL_ERROR", error.message, 500);
    if (data) rows.push(...data);
  }

  return NextResponse.json({ data: rows });
}

// ─── POST ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const parsed = await parseBody(req, CreateApiKeyBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const scope = await resolveBrokerScope(auth.supabase, auth.user.id);

  // A broker can only create keys for owners within their own scope.
  // An agency owner may pass an explicit brokerId from their team, or
  // their own agency id. Anything else is a hard 403 — we do NOT silently
  // rewrite the target, because that would mask escalation attempts.
  const allowedBroker =
    body.owner_type === "broker" && scope.brokerIds.includes(body.owner_id);
  const allowedAgency = body.owner_type === "agency" && scope.agencyId === body.owner_id;
  if (!allowedBroker && !allowedAgency) {
    // Only fall through to the primary owner when the caller explicitly
    // asked to create for themselves AND has no broker-scope data — this
    // shouldn't normally happen since the form prefills the id.
    const fallback = primaryOwner(scope);
    if (!fallback) {
      return apiError("FORBIDDEN", "You don't have a broker or agency to own this key", 403);
    }
    return apiError(
      "FORBIDDEN",
      `You can only create keys for your own broker${scope.agencyId ? " or agency team" : ""}`,
      403,
    );
  }

  const requested = { type: body.owner_type, id: body.owner_id };

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = prefixApiKey(rawKey);

  const { data, error } = await client
    .from("api_keys")
    .insert({
      name: body.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      owner_type: requested.type,
      owner_id: requested.id,
      scopes: body.scopes && body.scopes.length > 0 ? body.scopes : DEFAULT_SCOPES,
      rate_limit_per_min: body.rate_limit_per_min ?? 300,
      expires_at: body.expires_at ?? null,
    })
    .select(
      "id, name, key_prefix, owner_type, owner_id, scopes, rate_limit_per_min, created_at, last_used_at, expires_at, revoked_at",
    )
    .single();

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return NextResponse.json({ data, rawKey }, { status: 201 });
}

// ─── DELETE (soft revoke) ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return apiError("VALIDATION_ERROR", "Missing or invalid id query param", 400);
  }

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const scope = await resolveBrokerScope(auth.supabase, auth.user.id);
  const filters = listOwnerFilter(scope);
  if (filters.length === 0) {
    return apiError("FORBIDDEN", "You don't own any brokers or agencies", 403);
  }

  // Verify the key belongs to the caller's scope BEFORE revoking.
  const { data: existing, error: fetchErr } = await client
    .from("api_keys")
    .select("id, owner_type, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return apiError("INTERNAL_ERROR", fetchErr.message, 500);
  if (!existing) return apiError("NOT_FOUND", "API key not found", 404);

  const isOwnBroker =
    existing.owner_type === "broker" && scope.brokerIds.includes(existing.owner_id);
  const isOwnAgency = existing.owner_type === "agency" && scope.agencyId === existing.owner_id;
  if (!isOwnBroker && !isOwnAgency) {
    return apiError("FORBIDDEN", "You cannot revoke this key", 403);
  }

  const { error } = await client
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return NextResponse.json({ ok: true });
}
