/**
 * GET    /api/v1/webhooks/{id}  — fetch a single subscription owned by caller
 * PATCH  /api/v1/webhooks/{id}  — update url / event_types / filter / active
 * DELETE /api/v1/webhooks/{id}  — remove
 *
 * All require an API key with the `write:webhooks` scope.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { UpdateWebhookBodySchema } from "@/lib/api/schemas/webhooks";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext, requireScope } from "@/lib/api/auth-context";
import { createAuditTap } from "@/lib/api/audit-log";
import {
  deleteWebhook,
  getWebhook,
  updateWebhook,
} from "@/lib/api/webhooks/repository";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ownerFromAuthCtx(
  authCtx: Awaited<ReturnType<typeof resolveAuthContext>>,
): { type: "broker" | "agency" | "admin"; id: string } | null {
  if (authCtx.kind !== "apiKey" || !authCtx.apiKey) return null;
  return { type: authCtx.apiKey.ownerType, id: authCtx.apiKey.ownerId };
}

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const { id } = await context.params;
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["broker-analytics"]);
  const tap = createAuditTap({ endpoint: "/api/v1/webhooks/{id}", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  const scopeBlock = requireScope(authCtx, "write:webhooks");
  if (scopeBlock) return tap(scopeBlock);

  if (!id || !UUID_RE.test(id)) {
    return tap(apiError("VALIDATION_ERROR", "Invalid subscription id (must be UUID)", 400));
  }

  const owner = ownerFromAuthCtx(authCtx);
  if (!owner) return tap(apiError("UNAUTHORIZED", "API key required", 401));

  const result = await getWebhook(id, owner.type, owner.id);
  if (result === null) return tap(apiError("NOT_FOUND", "Subscription not found", 404));
  if (result && typeof result === "object" && "error" in result) {
    return tap(apiError("INTERNAL_ERROR", (result as { error: string }).error, 500));
  }

  return tap(NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "private, no-store", ...rateLimitHeaders(rl) } },
  ));
}

// ─── PATCH ─────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const { id } = await context.params;
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["broker-analytics"]);
  const tap = createAuditTap({ endpoint: "/api/v1/webhooks/{id}", method: "PATCH", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  const scopeBlock = requireScope(authCtx, "write:webhooks");
  if (scopeBlock) return tap(scopeBlock);

  if (!id || !UUID_RE.test(id)) {
    return tap(apiError("VALIDATION_ERROR", "Invalid subscription id (must be UUID)", 400));
  }

  const owner = ownerFromAuthCtx(authCtx);
  if (!owner) return tap(apiError("UNAUTHORIZED", "API key required", 401));

  const parsed = await parseBody(req, UpdateWebhookBodySchema);
  if (!parsed.ok) return tap(parsed.response);

  const result = await updateWebhook(id, owner.type, owner.id, {
    url: parsed.data.url,
    eventTypes: parsed.data.event_types,
    filter: parsed.data.filter,
    active: parsed.data.active,
  });
  if (result === null) return tap(apiError("NOT_FOUND", "Subscription not found", 404));
  if (result && typeof result === "object" && "error" in result) {
    return tap(apiError("INTERNAL_ERROR", (result as { error: string }).error, 500));
  }

  return tap(NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "private, no-store", ...rateLimitHeaders(rl) } },
  ));
}

// ─── DELETE ────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const { id } = await context.params;
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["broker-analytics"]);
  const tap = createAuditTap({ endpoint: "/api/v1/webhooks/{id}", method: "DELETE", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  const scopeBlock = requireScope(authCtx, "write:webhooks");
  if (scopeBlock) return tap(scopeBlock);

  if (!id || !UUID_RE.test(id)) {
    return tap(apiError("VALIDATION_ERROR", "Invalid subscription id (must be UUID)", 400));
  }

  const owner = ownerFromAuthCtx(authCtx);
  if (!owner) return tap(apiError("UNAUTHORIZED", "API key required", 401));

  const result = await deleteWebhook(id, owner.type, owner.id);
  if (!result.ok) {
    if (result.error === "not_found") return tap(apiError("NOT_FOUND", "Subscription not found", 404));
    return tap(apiError("INTERNAL_ERROR", result.error, 500));
  }

  return tap(NextResponse.json({ ok: true }, { headers: rateLimitHeaders(rl) }));
}
