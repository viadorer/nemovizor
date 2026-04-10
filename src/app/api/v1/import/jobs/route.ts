/**
 * GET /api/v1/import/jobs
 *
 * List recent import jobs for the calling agency.
 * Requires API key with write:import scope.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { resolveAuthContext, requireScope } from "@/lib/api/auth-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authCtx = await resolveAuthContext(req, { name: "import-jobs", windowMs: 60_000, max: 120 });
  const scopeErr = requireScope(authCtx, "write:import");
  if (scopeErr) return scopeErr;

  if (authCtx.kind !== "apiKey" || !authCtx.apiKey || authCtx.apiKey.ownerType !== "agency") {
    return apiError("FORBIDDEN", "Import API requires an agency-scoped API key", 403);
  }

  if (!supabaseAdmin) return apiError("SERVICE_UNAVAILABLE", "Admin client unavailable", 503);

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20"), 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;
  const { data, error } = await client
    .from("import_jobs")
    .select("id, status, external_source, total_items, completed_items, failed_items, warned_items, skipped_items, payload_summary, created_at, started_at, completed_at")
    .eq("agency_id", authCtx.apiKey.ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return NextResponse.json({ data: data ?? [] });
}
