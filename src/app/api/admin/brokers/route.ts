import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

// Allowed fields for broker insert/update (prevents unknown column errors)
const BROKER_FIELDS = [
  // Core
  "name", "slug", "email", "phone", "photo", "agency_name", "specialization",
  "active_listings", "rating", "total_deals", "bio", "agency_id", "user_id",
  "languages", "certifications", "year_started", "branch_id", "active",
  // Extended profile (migration 036)
  "title", "motto", "bio_short", "bio_long", "education", "license_number",
  "hobbies", "fun_fact", "video_url", "video_type", "cover_photo", "gallery", "awards",
  // Social
  "linkedin", "instagram", "facebook", "twitter", "website", "whatsapp", "calendly_url",
  // Expertise
  "specializations", "property_types", "service_areas",
  "price_range_min", "price_range_max",
  // Performance
  "total_sales_volume", "avg_response_time_hours", "response_rate_pct",
];

function pickBrokerFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of BROKER_FIELDS) {
    if (key in body) result[key] = body[key];
  }
  return result;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const { searchParams } = new URL(request.url);

  // Single broker by ID (for edit form)
  const id = searchParams.get("id");
  if (id) {
    const { data, error } = await supabase
      .from("brokers")
      .select("*, agencies(name)")
      .eq("id", id)
      .single();
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
    .from("brokers")
    .select("id, name, slug, email, phone, photo, agency_name, specialization, active_listings, rating, total_deals, bio, agency_id, user_id, languages, certifications, year_started, created_at, agencies(name)", { count: "exact" });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,agency_name.ilike.%${search}%`);
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

  if (!body.name) {
    return NextResponse.json({ error: "Jmeno je povinne" }, { status: 400 });
  }

  if (!body.slug) {
    body.slug = body.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  const safeBody = pickBrokerFields(body);
  const { data, error } = await supabase.from("brokers").insert(safeBody).select().single();

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

  const updates = pickBrokerFields(body);
  const { error } = await supabase.from("brokers").update(updates).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/brokers?id=...
 * Soft-delete: archives the broker by setting active_listings to -1 as archive marker.
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
    .from("brokers")
    .update({ active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
