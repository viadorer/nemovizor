/**
 * GET /api/subscriptions/status
 *
 * Returns the caller's active API subscription (or null if none).
 * Used by the dashboard to show plan banner + pre-fill key creation.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Login required", 401);

  if (!supabaseAdmin) {
    return apiError("SERVICE_UNAVAILABLE", "Admin client unavailable", 503);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;
  const { data, error } = await client
    .from("api_subscriptions")
    .select(
      "id, plan_tier, status, rate_limit_per_min, max_webhooks, scopes, current_period_end, cancel_at, created_at",
    )
    .eq("user_id", auth.user.id)
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscriptions/status] Query error:", error.message);
    return apiError("INTERNAL_ERROR", error.message, 500);
  }

  return NextResponse.json({ data: data ?? null });
}
