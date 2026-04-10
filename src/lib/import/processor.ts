/**
 * Import processor — dispatches import_job_items to entity-specific handlers.
 * Called by the cron worker for each pending item.
 */
import { processAgency } from "./process-agency";
import { processBranch } from "./process-branch";
import { processBroker } from "./process-broker";
import { processProperty } from "./process-property";

export interface ImportItemResult {
  status: "success" | "warning" | "error" | "skipped";
  errors: string[];
  warnings: string[];
  nemovizorId: string | null;
  nemovizorSlug: string | null;
  action: "created" | "updated" | "unchanged" | "deactivated" | null;
  processingTimeMs: number;
}

export interface JobContext {
  agencyId: string;
  externalSource: string;
}

/**
 * Process a single import job item.
 * Returns a result with status, IDs, warnings, and errors.
 */
export async function processImportItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  entityType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
  ctx: JobContext,
): Promise<ImportItemResult> {
  switch (entityType) {
    case "agency":
      return processAgency(supabase, ctx.agencyId, ctx.externalSource, payload);
    case "branch":
      return processBranch(supabase, ctx.agencyId, ctx.externalSource, payload);
    case "broker":
      return processBroker(supabase, ctx.agencyId, ctx.externalSource, payload);
    case "property":
      return processProperty(supabase, ctx.agencyId, ctx.externalSource, payload);
    default:
      return {
        status: "error",
        errors: [`Unknown entity type: ${entityType}`],
        warnings: [],
        nemovizorId: null,
        nemovizorSlug: null,
        action: null,
        processingTimeMs: 0,
      };
  }
}
