import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabase } from "@/lib/supabase";

function getClient() {
  return supabaseAdmin ?? supabase;
}

/** GET /api/properties – seznam nemovitostí */
export async function GET(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Number(searchParams.get("limit") ?? "50");

  const { data, error } = await client
    .from("properties")
    .select("id, slug, title, listing_type, category, city, price, active, featured")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: data.length, data });
}

/** POST /api/properties – vložit novou nemovitost */
export async function POST(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = await req.json();

  // Validace povinných polí
  const required = ["slug", "title", "listing_type", "category", "subtype", "rooms_label", "price", "city", "district", "location_label", "latitude", "longitude", "area", "summary"];
  const missing = required.filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await client
    .from("properties")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
