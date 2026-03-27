import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/billing/charge-day
 * Called on property activation to bill the first day.
 * Body: { property_id: string }
 * Also callable from nightly cron without body to run full daily billing.
 */
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const propertyId = body.property_id;

  if (propertyId) {
    // Bill single property for today
    const { data, error } = await client.rpc("bill_listing_day", {
      p_property_id: propertyId,
      p_date: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      console.error("[billing/charge-day]", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      transaction_id: data,
      already_billed: data === null,
    });
  }

  // No property_id = run full daily billing (cron mode)
  const cronKey = req.headers.get("x-cron-key") || req.nextUrl.searchParams.get("key");
  const expectedKey = process.env.CRON_SECRET || process.env.BILLING_CRON_KEY;
  if (expectedKey && cronKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await client.rpc("run_daily_billing", {
    p_date: new Date().toISOString().slice(0, 10),
  });

  if (error) {
    console.error("[billing/cron]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.log("[billing/cron] result:", result);

  return NextResponse.json({ ok: true, ...result });
}
