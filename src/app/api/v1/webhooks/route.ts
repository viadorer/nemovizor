/**
 * POST   /api/v1/webhooks  — create a webhook subscription
 * GET    /api/v1/webhooks  — list the caller's subscriptions
 *
 * Both require an API key with the `write:webhooks` scope. The plain
 * webhook signing secret is returned ONCE in the POST response — store it
 * immediately, the DB only keeps an encrypted copy that the dispatcher
 * can decrypt at delivery time.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import {
  CreateWebhookBodySchema,
} from "@/lib/api/schemas/webhooks";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext, requireScope } from "@/lib/api/auth-context";
import { createAuditTap } from "@/lib/api/audit-log";
import {
  createWebhook,
  listWebhooksForOwner,
} from "@/lib/api/webhooks/repository";

export const dynamic = "force-dynamic";

function ownerFromAuthCtx(
  authCtx: Awaited<ReturnType<typeof resolveAuthContext>>,
): { type: "broker" | "agency" | "admin"; id: string } | null {
  if (authCtx.kind !== "apiKey" || !authCtx.apiKey) return null;
  return { type: authCtx.apiKey.ownerType, id: authCtx.apiKey.ownerId };
}

// ─── POST: create ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["broker-analytics"]);
  const tap = createAuditTap({ endpoint: "/api/v1/webhooks", method: "POST", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  const scopeBlock = requireScope(authCtx, "write:webhooks");
  if (scopeBlock) return tap(scopeBlock);

  const owner = ownerFromAuthCtx(authCtx);
  if (!owner) {
    return tap(apiError("UNAUTHORIZED", "API key required", 401));
  }

  const parsed = await parseBody(req, CreateWebhookBodySchema);
  if (!parsed.ok) return tap(parsed.response);

  const result = await createWebhook({
    ownerType: owner.type,
    ownerId: owner.id,
    url: parsed.data.url,
    eventTypes: parsed.data.event_types,
    filter: parsed.data.filter ?? null,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return tap(apiError("FORBIDDEN", result.error, 409));
    }
    return tap(apiError("INTERNAL_ERROR", result.error, result.status));
  }

  return tap(NextResponse.json(
    {
      data: result.subscription,
      // The plain secret is returned ONCE. Caller MUST store it now.
      secret: result.plainSecret,
    },
    {
      status: 201,
      headers: { "Cache-Control": "private, no-store", ...rateLimitHeaders(rl) },
    },
  ));
}

// ─── GET: list ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["broker-analytics"]);
  const tap = createAuditTap({ endpoint: "/api/v1/webhooks", method: "GET", authCtx, startedAt });

  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return tap(rateLimitResponse(rl));

  const scopeBlock = requireScope(authCtx, "write:webhooks");
  if (scopeBlock) return tap(scopeBlock);

  const owner = ownerFromAuthCtx(authCtx);
  if (!owner) return tap(apiError("UNAUTHORIZED", "API key required", 401));

  const result = await listWebhooksForOwner(owner.type, owner.id);
  if (!Array.isArray(result)) {
    return tap(apiError("INTERNAL_ERROR", result.error, 500));
  }

  return tap(NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "private, no-store", ...rateLimitHeaders(rl) } },
  ));
}
