/**
 * Cron job: refresh the mv_filter_options_baseline materialized view.
 *
 * The unfiltered /api/filter-options call reads from this matview (<1ms)
 * instead of scanning 73k rows (7.6s). Run this after scraper batches
 * or on a schedule (e.g. every 15 min via Vercel cron).
 *
 * Uses REFRESH MATERIALIZED VIEW CONCURRENTLY so readers are never blocked.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return apiError("UNAUTHORIZED", "Invalid CRON_SECRET", 401);
    }
  }

  if (!supabaseAdmin) {
    return apiError("SERVICE_UNAVAILABLE", "supabaseAdmin not configured", 503);
  }

  const started = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any).rpc("refresh_filter_options_baseline");
  const elapsed = Date.now() - started;

  if (error) {
    // Graceful fallback if matview doesn't exist yet (migration 047 not applied)
    if (error.message?.includes("does not exist")) {
      return NextResponse.json({ ok: true, message: "Matview not initialized yet", elapsed_ms: elapsed });
    }
    console.error("[refresh-filter-cache] failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message, elapsed_ms: elapsed }, { status: 500 });
  }

  return NextResponse.json({ ok: true, elapsed_ms: elapsed });
}
