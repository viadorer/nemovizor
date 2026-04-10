/**
 * Agency import processor.
 * The API key owner IS the agency — we always update the owning agency's profile.
 */
import type { ImportItemResult } from "./processor";

export async function processAgency(
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

    // Build update object from payload (only set fields that are provided)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    if (fields.name) update.name = fields.name;
    if (fields.description !== undefined) update.description = fields.description;
    if (fields.phone !== undefined) update.phone = fields.phone;
    if (fields.email !== undefined) update.email = fields.email;
    if (fields.website !== undefined) update.website = fields.website;
    if (fields.logo !== undefined) update.logo = fields.logo;
    if (fields.seat_city !== undefined) update.seat_city = fields.seat_city;
    if (fields.seat_address !== undefined) update.seat_address = fields.seat_address;
    if (fields.founded_year !== undefined) update.founded_year = fields.founded_year;
    if (fields.specializations !== undefined) update.specializations = fields.specializations;

    // Always set external tracking
    update.external_id = external_id;
    update.external_source = externalSource;

    const { data, error } = await supabase
      .from("agencies")
      .update(update)
      .eq("id", agencyId)
      .select("id, slug")
      .maybeSingle();

    if (error) {
      return {
        status: "error",
        errors: [error.message],
        warnings,
        nemovizorId: null,
        nemovizorSlug: null,
        action: null,
        processingTimeMs: Date.now() - started,
      };
    }

    return {
      status: warnings.length > 0 ? "warning" : "success",
      errors: [],
      warnings,
      nemovizorId: data?.id ?? agencyId,
      nemovizorSlug: data?.slug ?? null,
      action: "updated",
      processingTimeMs: Date.now() - started,
    };
  } catch (err) {
    return {
      status: "error",
      errors: [err instanceof Error ? err.message : String(err)],
      warnings,
      nemovizorId: null,
      nemovizorSlug: null,
      action: null,
      processingTimeMs: Date.now() - started,
    };
  }
}
