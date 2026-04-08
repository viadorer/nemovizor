/**
 * Broker self-service webhook subscriptions CRUD.
 *
 * Parallel to /api/v1/webhooks but cookie-session-authed (not API key)
 * so the broker can manage subscriptions from the Nemovizor dashboard
 * after login. All reads/writes are scoped to resources owned by the
 * authenticated broker or their agency team.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { CreateWebhookBodySchema } from "@/lib/api/schemas/webhooks";
import {
  createWebhook,
  deleteWebhook,
  listWebhooksForOwner,
} from "@/lib/api/webhooks/repository";
import {
  primaryOwner,
  resolveBrokerScope,
} from "@/lib/api/broker-scope";

export const dynamic = "force-dynamic";

interface OwnerScope {
  brokerIds: string[];
  agencyId: string | null;
  ownBrokerId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminClient(): any | null {
  return supabaseAdmin;
}

// ─── GET: list caller's webhook subscriptions ─────────────────────────────

export async function GET() {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const scope = await resolveBrokerScope(auth.supabase, auth.user.id);
  const rows: unknown[] = [];

  // Agency subs
  if (scope.agencyId) {
    const r = await listWebhooksForOwner("agency", scope.agencyId);
    if (!Array.isArray(r)) return apiError("INTERNAL_ERROR", r.error, 500);
    rows.push(...r);
  }
  // Solo broker subs
  for (const bid of scope.brokerIds) {
    const r = await listWebhooksForOwner("broker", bid);
    if (!Array.isArray(r)) return apiError("INTERNAL_ERROR", r.error, 500);
    rows.push(...r);
  }

  return NextResponse.json({ data: rows });
}

// ─── POST: create a subscription for caller ───────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const parsed = await parseBody(req, CreateWebhookBodySchema);
  if (!parsed.ok) return parsed.response;

  const scope = await resolveBrokerScope(auth.supabase, auth.user.id);
  const owner = primaryOwner(scope);
  if (!owner) {
    return apiError("FORBIDDEN", "You don't have a broker or agency to own this subscription", 403);
  }

  const result = await createWebhook({
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    url: parsed.data.url,
    eventTypes: parsed.data.event_types,
    filter: parsed.data.filter ?? null,
  });
  if (!result.ok) {
    if (result.status === 409) return apiError("FORBIDDEN", result.error, 409);
    return apiError("INTERNAL_ERROR", result.error, result.status);
  }

  return NextResponse.json(
    { data: result.subscription, secret: result.plainSecret },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}

// ─── DELETE: remove caller's subscription ─────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return apiError("VALIDATION_ERROR", "Missing or invalid id query param", 400);
  }

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const scope: OwnerScope = await resolveBrokerScope(auth.supabase, auth.user.id);

  // Look up the row first to verify ownership.
  const { data: existing, error: fetchErr } = await client
    .from("webhook_subscriptions")
    .select("id, owner_type, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return apiError("INTERNAL_ERROR", fetchErr.message, 500);
  if (!existing) return apiError("NOT_FOUND", "Subscription not found", 404);

  const isOwnBroker =
    existing.owner_type === "broker" && scope.brokerIds.includes(existing.owner_id);
  const isOwnAgency = existing.owner_type === "agency" && scope.agencyId === existing.owner_id;
  if (!isOwnBroker && !isOwnAgency) {
    return apiError("FORBIDDEN", "You cannot delete this subscription", 403);
  }

  const result = await deleteWebhook(
    id,
    existing.owner_type as "broker" | "agency" | "admin",
    existing.owner_id,
  );
  if (!result.ok) {
    if (result.error === "not_found") return apiError("NOT_FOUND", "Subscription not found", 404);
    return apiError("INTERNAL_ERROR", result.error, 500);
  }
  return NextResponse.json({ ok: true });
}
