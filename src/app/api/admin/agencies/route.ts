import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

// Allowed fields for agency insert/update (prevents unknown column errors)
const AGENCY_FIELDS = [
  // Core
  "name", "slug", "logo", "description", "phone", "email", "website",
  "seat_city", "seat_address", "founded_year", "total_brokers", "total_listings",
  "total_deals", "rating", "specializations", "parent_agency_id", "is_independent",
  "user_id", "active",
  // Extended profile (migration 036)
  "description_long", "motto", "mission", "values_text",
  "cover_photo", "gallery", "video_url", "video_type",
  // Social
  "linkedin", "instagram", "facebook", "twitter", "whatsapp",
  // Awards & service
  "awards", "certifications", "service_areas", "service_countries",
  "avg_response_time_hours", "total_sales_volume", "properties_sold_count",
  // CTA
  "newsletter_enabled", "cta_text", "cta_url", "calendly_url",
];

function pickAgencyFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of AGENCY_FIELDS) {
    if (key in body) result[key] = body[key];
  }
  return result;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const { searchParams } = new URL(request.url);

  // Single agency by ID (for edit form)
  const id = searchParams.get("id");
  if (id) {
    const { data, error } = await supabase.from("agencies").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "name";
  const order = searchParams.get("order") !== "desc";
  const offset = (page - 1) * limit;

  let query = supabase
    .from("agencies")
    .select(
      "id, name, slug, email, phone, website, seat_city, seat_address, founded_year, total_brokers, total_listings, total_deals, rating, specializations, logo, description, user_id, is_independent, created_at",
      { count: "exact" }
    );

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,seat_city.ilike.%${search}%`);
  }

  query = query.order(sort, { ascending: order }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const body = await request.json();

  if (!body.name || !body.slug) {
    return NextResponse.json({ error: "Nazev a slug jsou povinne" }, { status: 400 });
  }

  const safeBody = pickAgencyFields(body);
  const { data, error } = await supabase.from("agencies").insert(safeBody).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const updates = pickAgencyFields(body);
  const { error } = await supabase.from("agencies").update(updates).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/agencies?id=...
 * Soft-delete: archives the agency by setting a flag.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Soft-delete: set active = false
  const { error } = await supabase
    .from("agencies")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
