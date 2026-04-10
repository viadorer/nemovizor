/**
 * Broker import processor.
 * Dedup: external_id + external_source, fallback email within agency.
 * Links to agency, optionally to branch via branch_external_id.
 */
import type { ImportItemResult } from "./processor";
import { generateUniqueSlug } from "./slug-generator";

export async function processBroker(
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
    const { external_id, branch_external_id, ...fields } = payload;

    // Resolve branch_id from branch_external_id
    let branchId: string | null = null;
    if (branch_external_id) {
      const { data: branch } = await supabase
        .from("branches")
        .select("id")
        .eq("external_id", branch_external_id)
        .eq("external_source", externalSource)
        .maybeSingle();

      if (branch) {
        branchId = branch.id;
      } else {
        warnings.push(`Branch external_id "${branch_external_id}" not found`);
      }
    }

    // Try dedup by external_id first
    let existing = null;
    {
      const { data } = await supabase
        .from("brokers")
        .select("id, slug")
        .eq("external_id", external_id)
        .eq("external_source", externalSource)
        .maybeSingle();
      existing = data;
    }

    // Fallback: email within same agency
    if (!existing && fields.email) {
      const { data } = await supabase
        .from("brokers")
        .select("id, slug")
        .eq("email", fields.email)
        .eq("agency_id", agencyId)
        .maybeSingle();
      existing = data;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      agency_id: agencyId,
      agency_name: "", // will be filled if needed
      external_id,
      external_source: externalSource,
    };

    if (fields.name) row.name = fields.name;
    if (fields.email !== undefined) row.email = fields.email;
    if (fields.phone !== undefined) row.phone = fields.phone;
    if (fields.photo !== undefined) row.photo = fields.photo;
    if (fields.title !== undefined) row.title = fields.title;
    if (fields.bio !== undefined) row.bio = fields.bio;
    if (fields.specialization !== undefined) row.specialization = fields.specialization;
    if (fields.languages !== undefined) row.languages = fields.languages;
    if (fields.certifications !== undefined) row.certifications = fields.certifications;
    if (fields.year_started !== undefined) row.year_started = fields.year_started;
    if (fields.linkedin !== undefined) row.linkedin = fields.linkedin;
    if (fields.instagram !== undefined) row.instagram = fields.instagram;
    if (fields.facebook !== undefined) row.facebook = fields.facebook;
    if (fields.website !== undefined) row.website = fields.website;
    if (branchId) row.branch_id = branchId;

    if (existing) {
      delete row.agency_name; // don't overwrite on update
      const { data, error } = await supabase
        .from("brokers")
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
    row.slug = await generateUniqueSlug(supabase, "brokers", fields.name || "makler");
    row.active = true;

    const { data, error } = await supabase
      .from("brokers")
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
