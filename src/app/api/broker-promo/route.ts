import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

/**
 * GET /api/broker-promo?city=Praha&seed=3
 *
 * Returns one promoted broker operating in the given city.
 * "Operates in city" = has active property listings in that city.
 * When multiple promoted brokers match, seed param rotates between them.
 */
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  const seed = parseInt(request.nextUrl.searchParams.get("seed") ?? "0", 10);

  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json(null);

  // Find promoted brokers that have active listings in the given city
  let query = sb
    .from("brokers")
    .select("id, name, slug, photo, agency_name, specialization, active_listings, rating, year_started")
    .eq("is_promoted", true);

  if (city) {
    // Subquery: broker IDs with active listings in this city
    const { data: cityBrokerIds } = await sb
      .from("properties")
      .select("broker_id")
      .eq("city", city)
      .eq("active", true)
      .not("broker_id", "is", null);

    if (!cityBrokerIds || cityBrokerIds.length === 0) {
      return NextResponse.json(null);
    }

    const ids = [...new Set(cityBrokerIds.map((r) => r.broker_id as string))];
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return NextResponse.json(null);

  // Rotate by seed
  const broker = data[seed % data.length];

  return NextResponse.json(broker, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
