import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";


export async function GET(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "created_at";
  const order = searchParams.get("order") === "asc";
  const offset = (page - 1) * limit;

  let query = supabase
    .from("properties")
    .select("id, title, slug, city, district, price, listing_type, category, active, featured, created_at, broker_id, project_id, brokers(name)", { count: "exact" });

  if (search) {
    query = query.or(`title.ilike.%${search}%,city.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  query = query.order(sort, { ascending: order }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("properties").update(updates).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
