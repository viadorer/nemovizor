import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import type { Database } from "@/lib/supabase-types";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { LeadsBodySchema } from "@/lib/api/schemas/leads";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import { resolveAuthContext } from "@/lib/api/auth-context";
import { createAuditTap } from "@/lib/api/audit-log";

export const dynamic = "force-dynamic";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let tap: ReturnType<typeof createAuditTap> = (r) => r;
  try {
    const authCtx = await resolveAuthContext(req, TIER1_RATE_LIMITS.leads);
    tap = createAuditTap({ endpoint: "/api/leads", method: "POST", authCtx, startedAt });

    const rl = await checkRateLimit(authCtx.rateLimitClientKey, authCtx.rateLimitConfig);
    if (!rl.ok) return tap(rateLimitResponse(rl));

    const parsed = await parseBody(req, LeadsBodySchema);
    if (!parsed.ok) return tap(parsed.response);
    const body = parsed.data;

    const sb = getClient();
    if (!sb) return tap(apiError("SERVICE_UNAVAILABLE", "DB not available", 503));

    const lead: LeadInsert = {
      name: body.name || "",
      email: body.email || "",
      phone: body.phone || "",
      property_type: body.propertyType || "",
      intent: body.intent || "",
      address: body.address || "",
      note: body.note || "",
      source: body.source || "prodat-page",
      created_at: new Date().toISOString(),
    };

    const { error } = await sb.from("leads").insert(lead as never);

    if (error) {
      console.error("Lead insert error:", error);
      return tap(apiError("INTERNAL_ERROR", error.message, 500));
    }

    return tap(NextResponse.json({ ok: true }, { headers: rateLimitHeaders(rl) }));
  } catch (e) {
    console.error("Lead API error:", e);
    return tap(apiError("INTERNAL_ERROR", "Internal error", 500));
  }
}
