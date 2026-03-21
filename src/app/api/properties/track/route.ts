import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_VIEW_TYPES = ["tip_impression", "listing_impression", "detail", "detail_click"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyIds, viewType } = body;

    if (!viewType || !VALID_VIEW_TYPES.includes(viewType)) {
      return NextResponse.json({ error: "Invalid view_type" }, { status: 400 });
    }

    // Support single ID or array of IDs (for batch tip impressions)
    const ids: string[] = Array.isArray(propertyIds) ? propertyIds : [propertyIds];

    if (ids.length === 0 || ids.length > 20) {
      return NextResponse.json({ error: "Invalid propertyIds" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;
    const referrer = request.headers.get("referer") || null;

    const rows = ids.map((propertyId) => ({
      property_id: propertyId,
      view_type: viewType,
      ip_address: ip,
      user_agent: userAgent,
      referrer: referrer,
    }));

    const { error } = await supabase.from("property_views").insert(rows);

    if (error) {
      console.error("Track error:", error);
      return NextResponse.json({ error: "Failed to track" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
