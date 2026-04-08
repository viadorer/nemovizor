/**
 * GET /api/admin/webhooks  — admin view of all webhook subscriptions across
 *                            owners, plus optional recent deliveries.
 *
 * Query params:
 *   include_deliveries=true   → also return last 50 deliveries (joined view)
 *   limit=N                   → max subscriptions to return (default 100, max 500)
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
  const includeDeliveries = sp.get("include_deliveries") === "true";
  const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(sp.get("limit") || "100", 10) || 100));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;

  const { data: subs, error: subErr } = await c
    .from("webhook_subscriptions")
    .select(
      "id, owner_type, owner_id, url, secret_prefix, event_types, filter, active, failure_count, disabled_at, last_delivered_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (subErr) return apiError("INTERNAL_ERROR", subErr.message, 500);

  // Outbox aggregate stats
  const { data: outboxAgg } = await c
    .from("webhook_outbox")
    .select("status")
    .order("created_at", { ascending: false })
    .limit(1000);
  const outboxStats: Record<string, number> = { pending: 0, delivering: 0, delivered: 0, failed: 0 };
  for (const row of (outboxAgg || []) as Array<{ status: string }>) {
    outboxStats[row.status] = (outboxStats[row.status] || 0) + 1;
  }

  let deliveries: unknown[] | undefined;
  if (includeDeliveries) {
    const { data: dels } = await c
      .from("webhook_deliveries")
      .select("id, outbox_id, subscription_id, attempt, status, http_status, latency_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    deliveries = dels ?? [];
  }

  return NextResponse.json({
    data: subs ?? [],
    outbox_stats: outboxStats,
    deliveries,
  });
}
