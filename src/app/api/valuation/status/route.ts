import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseQuery } from "@/lib/api/validate";
import { ValuationStatusQuerySchema } from "@/lib/api/schemas/valuation";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/valuation/status?id=xxx — check if valuation PDF is ready.
 * Full contract: see OpenAPI at /api/openapi (ValuationStatusQuery / ValuationStatusResponse).
 */
export async function GET(req: NextRequest) {
  const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS["valuation-status"]);
  const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
  if (!rl.ok) return rateLimitResponse(rl);

  const parsed = parseQuery(req.nextUrl.searchParams, ValuationStatusQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase not configured", 503);

  const { data } = await client
    .from("valuation_reports")
    .select("id, pdf_url, paid, estimated_price, price_range_min, price_range_max, price_per_m2")
    .eq("id", id)
    .single();

  if (!data) return apiError("NOT_FOUND", "Valuation report not found", 404);

  return NextResponse.json(
    {
      id: data.id,
      pdf_url: data.pdf_url || null,
      paid: data.paid,
      ready: !!data.pdf_url,
    },
    { headers: rateLimitHeaders(rl) },
  );
}
