import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/analytics/track
 * Accepts a JSON body that is either a single event object or an array of events.
 * Stores to analytics_events table (anon INSERT is allowed via RLS).
 */
export async function POST(req: NextRequest) {
  const client = getSupabase();
  if (!client) return NextResponse.json({ ok: false }, { status: 503 });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") || "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const raw = Array.isArray(body) ? body : [body];

  const rows = raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      session_id: String(e.session_id || "").slice(0, 64),
      user_id: e.user_id ? String(e.user_id) : null,
      event_type: String(e.event_type || "").slice(0, 64),
      properties: (e.properties && typeof e.properties === "object" ? e.properties : {}) as Record<string, unknown>,
      url: String(e.url || "").slice(0, 500),
      referrer: String(e.referrer || "").slice(0, 500),
      ip_address: ip,
      user_agent: ua.slice(0, 300),
      device_type: String(e.device_type || "").slice(0, 16),
    }))
    .filter((r) => r.session_id && r.event_type);

  if (rows.length === 0) return NextResponse.json({ ok: true });

  const { error } = await client.from("analytics_events").insert(rows);
  if (error) console.error("[analytics/track]", error.message);

  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
