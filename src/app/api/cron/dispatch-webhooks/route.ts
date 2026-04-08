/**
 * Cron job: dispatch pending webhook events.
 *
 * Vercel cron runs every 5 minutes (see vercel.json) and GETs this endpoint.
 * The handler reads pending rows from `webhook_outbox`, fans them out to
 * matching subscriptions, signs each delivery and POSTs.
 *
 * Optional bearer auth via `CRON_SECRET` env var (Vercel cron sends it
 * automatically when configured). The dispatcher itself is idempotent
 * thanks to the `delivering` lock + 10-minute orphan reclaim window.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { dispatchPendingWebhooks } from "@/lib/api/webhooks/dispatcher";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || match[1] !== expected) {
      return apiError("UNAUTHORIZED", "Invalid cron secret", 401);
    }
  }

  const client = supabaseAdmin;
  if (!client) {
    return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);
  }

  const startedAt = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = await dispatchPendingWebhooks(client as any);
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: true,
    elapsed_ms: elapsedMs,
    ...summary,
  });
}
