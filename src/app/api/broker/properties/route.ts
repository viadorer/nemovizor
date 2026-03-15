import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/** Helper: get broker IDs the current user is allowed to manage.
 *  - If user is a broker → own broker record
 *  - If user owns an agency → all brokers in that agency
 */
async function getAllowedBrokerIds(supabase: ReturnType<typeof Object>, userId: string) {
  const sb = supabase as import("@supabase/supabase-js").SupabaseClient;

  // Check if user is a broker
  const { data: myBroker } = await sb
    .from("brokers")
    .select("id, agency_id")
    .eq("user_id", userId)
    .single();

  // Check if user owns an agency
  const { data: myAgency } = await sb
    .from("agencies")
    .select("id")
    .eq("user_id", userId)
    .single();

  const agencyId = myAgency?.id || myBroker?.agency_id || null;

  if (agencyId) {
    // Get all brokers in the agency
    const { data: teamBrokers } = await sb
      .from("brokers")
      .select("id")
      .eq("agency_id", agencyId);
    return (teamBrokers ?? []).map((b: { id: string }) => b.id);
  }

  // Solo broker
  return myBroker ? [myBroker.id] : [];
}

/**
 * GET /api/broker/properties
 * Lists properties belonging to the broker (or their agency team).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase, user } = auth;
  const brokerIds = await getAllowedBrokerIds(supabase, user.id);

  // Build ownership filter: broker's team OR created by this user
  const ownerFilters: string[] = [];
  if (brokerIds.length > 0) {
    ownerFilters.push(`broker_id.in.(${brokerIds.join(",")})`);
  }
  ownerFilters.push(`created_by.eq.${user.id}`);
  const ownerFilter = ownerFilters.join(",");

  const { searchParams } = new URL(request.url);

  // Single property by ID (for edit form)
  const id = searchParams.get("id");
  if (id) {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .or(ownerFilter)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ data });
  }

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "created_at";
  const order = searchParams.get("order") === "asc";
  const offset = (page - 1) * limit;

  let query = supabase
    .from("properties")
    .select("id, title, slug, city, district, price, listing_type, category, active, featured, created_at, broker_id", { count: "exact" })
    .or(ownerFilter);

  if (search) {
    query = query.or(`title.ilike.%${search}%,city.ilike.%${search}%`);
  }

  query = query.order(sort, { ascending: order }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/broker/properties
 * Create a new property. Ensures broker_id belongs to the user's team.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase, user } = auth;
  const brokerIds = await getAllowedBrokerIds(supabase, user.id);

  const body = await request.json();

  if (!body.title || !body.slug) {
    return NextResponse.json({ error: "Nazev a slug jsou povinne" }, { status: 400 });
  }

  // Track who created it
  body.created_by = user.id;

  // Ensure broker_id is set and belongs to the user's team
  if (!body.broker_id || !brokerIds.includes(body.broker_id)) {
    // Default to first allowed broker (or null if admin without broker record)
    if (brokerIds.length > 0) {
      body.broker_id = brokerIds[0];
    } else {
      // Admin without broker record — allow creation without broker_id
      body.broker_id = null;
    }
  }

  const { data, error } = await supabase.from("properties").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

/**
 * PATCH /api/broker/properties
 * Update a property. Only allows editing properties belonging to the user's team.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase, user } = auth;
  const brokerIds = await getAllowedBrokerIds(supabase, user.id);

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Verify ownership: broker's team OR created by this user
  const { data: existing } = await supabase
    .from("properties")
    .select("broker_id, created_by")
    .eq("id", id)
    .single();

  const isOwner = existing && (
    (existing.broker_id && brokerIds.includes(existing.broker_id)) ||
    existing.created_by === user.id
  );

  if (!isOwner) {
    return NextResponse.json({ error: "Property not found or access denied" }, { status: 403 });
  }

  // Don't allow changing broker_id to someone outside the team
  if (updates.broker_id && !brokerIds.includes(updates.broker_id)) {
    delete updates.broker_id;
  }

  const { error } = await supabase.from("properties").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/broker/properties?id=...
 * Soft-delete: archives the property by setting active = false.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase, user } = auth;
  const brokerIds = await getAllowedBrokerIds(supabase, user.id);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Verify ownership: broker's team OR created by this user
  const { data: existing } = await supabase
    .from("properties")
    .select("broker_id, created_by")
    .eq("id", id)
    .single();

  const isOwner = existing && (
    (existing.broker_id && brokerIds.includes(existing.broker_id)) ||
    existing.created_by === user.id
  );

  if (!isOwner) {
    return NextResponse.json({ error: "Property not found or access denied" }, { status: 403 });
  }

  const { error } = await supabase
    .from("properties")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
