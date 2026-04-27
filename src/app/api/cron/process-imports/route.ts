/**
 * Cron worker: /api/cron/process-imports
 *
 * Runs every minute via Vercel cron. Picks up pending import jobs
 * and processes items in chunks (20 per tick) to stay within the
 * 60-second Vercel function timeout.
 *
 * Processing order: agency (0) → branches (100+) → brokers (200+) → properties (300+)
 * This ensures dependencies (agency, branches) are resolved before
 * entities that reference them (brokers, properties).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { processImportItem } from "@/lib/import/processor";

export const dynamic = "force-dynamic";

const ITEMS_PER_TICK = 20;

export async function GET(req: NextRequest) {
  // CRON_SECRET gate
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return apiError("UNAUTHORIZED", "Invalid CRON_SECRET", 401);
    }
  }

  if (!supabaseAdmin) return apiError("SERVICE_UNAVAILABLE", "Admin client unavailable", 503);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;
  const startedAt = Date.now();

  // Find next job to process (FIFO)
  const { data: job, error: jobErr } = await client
    .from("import_jobs")
    .select("id, agency_id, external_source, deactivate_missing, total_items")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobErr) {
    // Graceful fallback if import tables don't exist yet (migration 049 not applied)
    if (jobErr.message?.includes("relation") && jobErr.message?.includes("does not exist")) {
      return NextResponse.json({ ok: true, message: "Import tables not initialized yet" });
    }
    return NextResponse.json({ ok: false, error: jobErr.message }, { status: 500 });
  }
  if (!job) return NextResponse.json({ ok: true, message: "No pending jobs" });

  // Mark as processing
  await client
    .from("import_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "pending"); // only update if still pending (idempotent)

  // Fetch next chunk of pending items
  const { data: items, error: itemsErr } = await client
    .from("import_job_items")
    .select("id, entity_type, external_id, payload")
    .eq("job_id", job.id)
    .eq("status", "pending")
    .order("sort_order", { ascending: true })
    .limit(ITEMS_PER_TICK);

  if (itemsErr) return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });

  let processedCount = 0;
  let failedCount = 0;
  let warnedCount = 0;
  let skippedCount = 0;

  const ctx = { agencyId: job.agency_id, externalSource: job.external_source };

  for (const item of items ?? []) {
    // Safety: don't exceed 50s (leave 10s margin for DB updates)
    if (Date.now() - startedAt > 50_000) break;

    // Mark item as processing
    await client
      .from("import_job_items")
      .update({ status: "processing" })
      .eq("id", item.id);

    const result = await processImportItem(
      client,
      item.entity_type,
      item.payload,
      ctx,
    );

    // Update item with result
    await client
      .from("import_job_items")
      .update({
        status: result.status,
        nemovizor_id: result.nemovizorId,
        nemovizor_slug: result.nemovizorSlug,
        action: result.action,
        warnings: result.warnings,
        errors: result.errors,
        processing_time_ms: result.processingTimeMs,
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    processedCount++;
    if (result.status === "error") failedCount++;
    if (result.status === "warning") warnedCount++;
    if (result.status === "skipped") skippedCount++;
  }

  // Update job counters
  if (processedCount > 0) {
    // Fetch current counts from DB (in case another tick ran concurrently)
    const { data: counts } = await client
      .from("import_job_items")
      .select("status")
      .eq("job_id", job.id);

    const statusCounts = { pending: 0, processing: 0, success: 0, warning: 0, error: 0, skipped: 0 };
    for (const row of counts ?? []) {
      statusCounts[row.status as keyof typeof statusCounts] =
        (statusCounts[row.status as keyof typeof statusCounts] || 0) + 1;
    }

    const completedItems = statusCounts.success + statusCounts.warning + statusCounts.error + statusCounts.skipped;
    const isComplete = statusCounts.pending === 0 && statusCounts.processing === 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobUpdate: Record<string, any> = {
      completed_items: completedItems,
      failed_items: statusCounts.error,
      warned_items: statusCounts.warning,
      skipped_items: statusCounts.skipped,
    };

    if (isComplete) {
      jobUpdate.status = "completed";
      jobUpdate.completed_at = new Date().toISOString();
    }

    await client
      .from("import_jobs")
      .update(jobUpdate)
      .eq("id", job.id);

    // Fire callback webhook if job just completed (with HMAC signature)
    if (isComplete && job.callback_url) {
      const signingKey = process.env.IMPORT_CALLBACK_SECRET || process.env.CRON_SECRET;
      if (!signingKey) {
        console.warn("[process-imports] No IMPORT_CALLBACK_SECRET or CRON_SECRET — skipping callback");
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const jobData: any = { ...jobUpdate, id: job.id };
          const payload = JSON.stringify(jobData);
          const { createHmac } = await import("node:crypto");
          const signature = createHmac("sha256", signingKey).update(payload).digest("hex");
          await fetch(job.callback_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Nemovizor-Signature": `sha256=${signature}`,
              "X-Nemovizor-Event": "import.completed",
            },
            body: payload,
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          // Best-effort — don't fail the cron
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    processed: processedCount,
    failed: failedCount,
    warned: warnedCount,
    skipped: skippedCount,
    elapsed_ms: Date.now() - startedAt,
  });
}
