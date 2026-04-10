/**
 * GET /api/v1/import/jobs/{id}
 *
 * Get import job status + per-item results (when completed).
 * Requires API key with write:import scope, scoped to caller's agency.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { resolveAuthContext, requireScope } from "@/lib/api/auth-context";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authCtx = await resolveAuthContext(req, { name: "import-jobs", windowMs: 60_000, max: 120 });
  const scopeErr = requireScope(authCtx, "write:import");
  if (scopeErr) return scopeErr;

  if (authCtx.kind !== "apiKey" || !authCtx.apiKey || authCtx.apiKey.ownerType !== "agency") {
    return apiError("FORBIDDEN", "Import API requires an agency-scoped API key", 403);
  }

  if (!supabaseAdmin) return apiError("SERVICE_UNAVAILABLE", "Admin client unavailable", 503);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;

  const { data: job, error } = await client
    .from("import_jobs")
    .select("id, status, external_source, total_items, completed_items, failed_items, warned_items, skipped_items, payload_summary, created_at, started_at, completed_at")
    .eq("id", id)
    .eq("agency_id", authCtx.apiKey.ownerId)
    .maybeSingle();

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  if (!job) return apiError("NOT_FOUND", "Job not found", 404);

  // Include items when job is completed or failed
  let items = undefined;
  if (job.status === "completed" || job.status === "failed") {
    const { data: itemRows } = await client
      .from("import_job_items")
      .select("external_id, entity_type, status, nemovizor_id, nemovizor_slug, action, warnings, errors, processing_time_ms")
      .eq("job_id", id)
      .order("sort_order", { ascending: true });
    items = itemRows;
  }

  return NextResponse.json({
    ...job,
    items,
  });
}
