/**
 * DELETE /api/v1/import/properties/{external_id}
 *
 * Synchronous single-property deactivation by external_id.
 * Convenience endpoint for real-time delisting outside of batch imports.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { resolveAuthContext, requireScope } from "@/lib/api/auth-context";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ external_id: string }> },
) {
  const { external_id } = await params;
  const authCtx = await resolveAuthContext(req, { name: "import-delete", windowMs: 60_000, max: 60 });
  const scopeErr = requireScope(authCtx, "write:import");
  if (scopeErr) return scopeErr;

  if (authCtx.kind !== "apiKey" || !authCtx.apiKey || authCtx.apiKey.ownerType !== "agency") {
    return apiError("FORBIDDEN", "Import API requires an agency-scoped API key", 403);
  }

  if (!supabaseAdmin) return apiError("SERVICE_UNAVAILABLE", "Admin client unavailable", 503);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;

  // Determine external_source from query or default
  const externalSource = req.nextUrl.searchParams.get("external_source") ?? "api";

  // Find property by external_id + verify it belongs to this agency's brokers
  const { data: property, error } = await client
    .from("properties")
    .select("id, slug, broker_id")
    .eq("external_id", external_id)
    .eq("external_source", externalSource)
    .eq("active", true)
    .maybeSingle();

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  if (!property) return apiError("NOT_FOUND", `Property with external_id "${external_id}" not found`, 404);

  // Verify broker belongs to this agency
  if (property.broker_id) {
    const { data: broker } = await client
      .from("brokers")
      .select("agency_id")
      .eq("id", property.broker_id)
      .maybeSingle();

    if (broker && broker.agency_id !== authCtx.apiKey.ownerId) {
      return apiError("FORBIDDEN", "Property belongs to a different agency", 403);
    }
  }

  // Deactivate
  await client
    .from("properties")
    .update({ active: false, extra_info: "prodano" })
    .eq("id", property.id);

  return NextResponse.json({
    ok: true,
    nemovizor_id: property.id,
    nemovizor_slug: property.slug,
    action: "deactivated",
  });
}
