/**
 * POST /api/v1/import/batch
 *
 * Submit a batch import of agencies, branches, brokers, and/or properties.
 * Returns 202 with a job_id for polling. Processing happens asynchronously
 * via the /api/cron/process-imports worker.
 *
 * Requires API key with write:import scope and owner_type=agency.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { resolveAuthContext, requireScope } from "@/lib/api/auth-context";
import { TIER1_RATE_LIMITS, checkRateLimit, rateLimitResponse, rateLimitHeaders } from "@/lib/api/rate-limit";
import { parseBody } from "@/lib/api/validate";
import { ImportBatchBodySchema } from "@/lib/api/schemas/import";

export const dynamic = "force-dynamic";

const IMPORT_RATE_LIMIT = { name: "import-batch", windowMs: 60_000, max: 60 };
const MAX_ITEMS_PER_BATCH = 1000;

export async function POST(req: NextRequest) {
  const authCtx = await resolveAuthContext(req, IMPORT_RATE_LIMIT);

  // Require write:import scope
  const scopeErr = requireScope(authCtx, "write:import");
  if (scopeErr) return scopeErr;

  // Rate limit
  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return rateLimitResponse(rl);

  // Must be agency-scoped key
  if (authCtx.kind !== "apiKey" || !authCtx.apiKey) {
    return apiError("UNAUTHORIZED", "API key required", 401);
  }
  if (authCtx.apiKey.ownerType !== "agency") {
    return apiError("FORBIDDEN", "Import API requires an agency-scoped API key (owner_type=agency)", 403);
  }

  const agencyId = authCtx.apiKey.ownerId;

  // Parse body
  const parsed = await parseBody(req, ImportBatchBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const externalSource = body.external_source ?? "api";

  // Count items
  const agencyCount = body.agency ? 1 : 0;
  const branchCount = body.branches?.length ?? 0;
  const brokerCount = body.brokers?.length ?? 0;
  const propertyCount = body.properties?.length ?? 0;
  const totalItems = agencyCount + branchCount + brokerCount + propertyCount;

  if (totalItems === 0) {
    return apiError("VALIDATION_ERROR", "Batch is empty — provide at least one entity", 400);
  }
  if (totalItems > MAX_ITEMS_PER_BATCH) {
    return apiError("VALIDATION_ERROR", `Batch too large: ${totalItems} items (max ${MAX_ITEMS_PER_BATCH})`, 400);
  }

  if (!supabaseAdmin) {
    return apiError("SERVICE_UNAVAILABLE", "Admin client unavailable", 503);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;

  // Insert job
  const { data: job, error: jobErr } = await client
    .from("import_jobs")
    .insert({
      api_key_id: authCtx.apiKey.id,
      agency_id: agencyId,
      external_source: externalSource,
      total_items: totalItems,
      callback_url: body.callback_url ?? null,
      deactivate_missing: body.deactivate_missing ?? false,
      payload_summary: {
        agencies: agencyCount,
        branches: branchCount,
        brokers: brokerCount,
        properties: propertyCount,
      },
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return apiError("INTERNAL_ERROR", jobErr?.message ?? "Failed to create job", 500);
  }

  // Insert items with sort_order for dependency ordering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];

  if (body.agency) {
    items.push({
      job_id: job.id,
      entity_type: "agency",
      external_id: body.agency.external_id,
      sort_order: 0,
      payload: body.agency,
    });
  }

  body.branches?.forEach((b, i) => {
    items.push({
      job_id: job.id,
      entity_type: "branch",
      external_id: b.external_id,
      sort_order: 100 + i,
      payload: b,
    });
  });

  body.brokers?.forEach((b, i) => {
    items.push({
      job_id: job.id,
      entity_type: "broker",
      external_id: b.external_id,
      sort_order: 200 + i,
      payload: b,
    });
  });

  body.properties?.forEach((p, i) => {
    items.push({
      job_id: job.id,
      entity_type: "property",
      external_id: p.external_id,
      sort_order: 300 + i,
      payload: p,
    });
  });

  const { error: itemsErr } = await client.from("import_job_items").insert(items);
  if (itemsErr) {
    // Clean up the job
    await client.from("import_jobs").delete().eq("id", job.id);
    return apiError("INTERNAL_ERROR", itemsErr.message, 500);
  }

  return NextResponse.json(
    {
      job_id: job.id,
      status: "pending",
      total_items: totalItems,
      poll_url: `/api/v1/import/jobs/${job.id}`,
    },
    {
      status: 202,
      headers: rateLimitHeaders(rl),
    },
  );
}
