import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** GET /api/valuation/status?id=xxx — check if PDF is ready */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const { data } = await client
    .from("valuation_reports")
    .select("id, pdf_url, paid, estimated_price, price_range_min, price_range_max, price_per_m2")
    .eq("id", id)
    .single();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    pdf_url: data.pdf_url || null,
    paid: data.paid,
    ready: !!data.pdf_url,
  });
}
