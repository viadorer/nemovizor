/**
 * Cron job: delete `api_request_log` rows older than 90 days.
 *
 * Vercel registers this in vercel.json under `crons`. The endpoint is also
 * callable manually by anyone who knows the URL — Vercel cron jobs do not
 * require authentication by default — but the only thing it does is a
 * single bounded `delete from api_request_log where created_at < ...`,
 * which is idempotent and safe to invoke at any time.
 *
 * If `CRON_SECRET` is set, requests must include
 * `Authorization: Bearer <CRON_SECRET>` (matches Vercel's recommendation).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 90;

export async function GET(req: NextRequest) {
  // Optional bearer-token gate. Vercel cron requests include
  // `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET
  // is set in the project's environment.
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

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  const { error, count } = await c
    .from("api_request_log")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    console.error("[cron/cleanup-audit-log]", error.message);
    return apiError("INTERNAL_ERROR", error.message, 500);
  }

  return NextResponse.json({
    ok: true,
    deleted: count ?? 0,
    cutoff,
    retentionDays: RETENTION_DAYS,
  });
}
