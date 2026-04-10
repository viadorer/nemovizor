/**
 * Branch import processor.
 * Upserts by external_id + external_source. Links to the owning agency.
 */
import type { ImportItemResult } from "./processor";
import { generateUniqueSlug } from "./slug-generator";

export async function processBranch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  agencyId: string,
  externalSource: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<ImportItemResult> {
  const started = Date.now();
  const warnings: string[] = [];

  try {
    const { external_id, ...fields } = payload;

    // Check if branch already exists
    const { data: existing } = await supabase
      .from("branches")
      .select("id, slug")
      .eq("external_id", external_id)
      .eq("external_source", externalSource)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      agency_id: agencyId,
      external_id,
      external_source: externalSource,
    };

    if (fields.name) row.name = fields.name;
    if (fields.address !== undefined) row.address = fields.address;
    if (fields.city !== undefined) row.city = fields.city;
    if (fields.zip !== undefined) row.zip = fields.zip;
    if (fields.phone !== undefined) row.phone = fields.phone;
    if (fields.email !== undefined) row.email = fields.email;
    if (fields.latitude !== undefined) row.latitude = fields.latitude;
    if (fields.longitude !== undefined) row.longitude = fields.longitude;
    if (fields.is_headquarters !== undefined) row.is_headquarters = fields.is_headquarters;

    if (existing) {
      // UPDATE
      const { data, error } = await supabase
        .from("branches")
        .update(row)
        .eq("id", existing.id)
        .select("id, slug")
        .maybeSingle();

      if (error) return errResult(error.message, warnings, started);

      return {
        status: warnings.length > 0 ? "warning" : "success",
        errors: [],
        warnings,
        nemovizorId: data?.id ?? existing.id,
        nemovizorSlug: data?.slug ?? existing.slug,
        action: "updated",
        processingTimeMs: Date.now() - started,
      };
    }

    // INSERT
    row.slug = await generateUniqueSlug(supabase, "branches", fields.name || "branch");

    const { data, error } = await supabase
      .from("branches")
      .insert(row)
      .select("id, slug")
      .maybeSingle();

    if (error) return errResult(error.message, warnings, started);

    return {
      status: warnings.length > 0 ? "warning" : "success",
      errors: [],
      warnings,
      nemovizorId: data?.id ?? null,
      nemovizorSlug: data?.slug ?? null,
      action: "created",
      processingTimeMs: Date.now() - started,
    };
  } catch (err) {
    return errResult(err instanceof Error ? err.message : String(err), [], started);
  }
}

function errResult(msg: string, warnings: string[], started: number): ImportItemResult {
  return {
    status: "error",
    errors: [msg],
    warnings,
    nemovizorId: null,
    nemovizorSlug: null,
    action: null,
    processingTimeMs: Date.now() - started,
  };
}
