import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["admin", "broker"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);

  const agencyId = searchParams.get("agency_id");
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await supabase.from("branches").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  let query = supabase
    .from("branches")
    .select("id, name, slug, city, address, zip, phone, email, is_headquarters, agency_id, created_at");

  if (agencyId) {
    query = query.eq("agency_id", agencyId);
  }

  query = query.order("is_headquarters", { ascending: false }).order("name", { ascending: true });

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
