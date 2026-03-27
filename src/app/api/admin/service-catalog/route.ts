import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/admin/service-catalog — list all services + optional regional pricing
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { supabase } = auth;
  const sp = req.nextUrl.searchParams;
  const includeRegional = sp.get("include_regional") === "true";

  const { data: services, error } = await supabase
    .from("service_catalog")
    .select("*")
    .order("category")
    .order("base_price");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let regionalPricing: Record<string, unknown>[] = [];
  if (includeRegional) {
    const { data: rp } = await supabase.from("regional_pricing").select("*").order("country").order("city");
    regionalPricing = (rp || []) as Record<string, unknown>[];
  }

  return NextResponse.json({
    services: (services || []).map((s) => ({ ...s, base_price_display: (s.base_price as number) / 100 })),
    ...(includeRegional ? { regionalPricing: regionalPricing.map((r) => ({ ...r, price_display: ((r.price as number) || 0) / 100 })) } : {}),
  });
}

/**
 * POST /api/admin/service-catalog — create a new service
 */
export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = await req.json();
  const { code, name, description, base_price, currency, duration_days, category, metadata } = body;

  if (!code || !name || base_price === undefined || !category) {
    return NextResponse.json({ error: "code, name, base_price, category required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("service_catalog")
    .insert({
      code, name, description: description || null,
      base_price: Math.round((base_price as number) * 100),
      currency: currency || "czk",
      duration_days: duration_days || null,
      category,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ service: data }, { status: 201 });
}

/**
 * PATCH /api/admin/service-catalog — update a service
 */
export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Convert price to cents if provided
  if (updates.base_price !== undefined) {
    updates.base_price = Math.round((updates.base_price as number) * 100);
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await auth.supabase
    .from("service_catalog")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ service: data });
}

/**
 * DELETE /api/admin/service-catalog — deactivate a service
 */
export async function DELETE(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await auth.supabase
    .from("service_catalog")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
