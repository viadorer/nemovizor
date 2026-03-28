import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/admin/listing-pricing — list all listing pricing + volume discounts
 */
export async function GET() {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const [{ data: pricing }, { data: discounts }] = await Promise.all([
    auth.supabase.from("listing_pricing").select("*").eq("active", true).order("country").order("city"),
    auth.supabase.from("volume_discounts").select("*").order("country").order("min_listings"),
  ]);

  return NextResponse.json({
    pricing: (pricing || []).map((p: Record<string, unknown>) => ({
      ...p,
      price_display: (p.credits_per_day as number) || 0,
      credits_per_day: (p.credits_per_day as number) || 0,
    })),
    discounts: discounts || [],
  });
}

/**
 * POST /api/admin/listing-pricing — create/update a pricing entry
 */
export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = await req.json();
  const { country, region, city, listing_type, price_per_day, currency } = body;

  if (!country || price_per_day === undefined || !currency) {
    return NextResponse.json({ error: "country, price_per_day, currency required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("listing_pricing")
    .upsert({
      country,
      region: region || null,
      city: city || null,
      listing_type: listing_type || null,
      price_per_day: Math.round((price_per_day as number) * 100),
      currency,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "country,COALESCE(region, ''),COALESCE(city, ''),COALESCE(listing_type, '')" })
    .select()
    .single();

  if (error) {
    // Fallback: insert directly
    const { data: d2, error: e2 } = await auth.supabase
      .from("listing_pricing")
      .insert({
        country,
        region: region || null,
        city: city || null,
        listing_type: listing_type || null,
        price_per_day: Math.round((price_per_day as number) * 100),
        currency,
      })
      .select()
      .single();
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    return NextResponse.json({ pricing: d2 }, { status: 201 });
  }

  return NextResponse.json({ pricing: data }, { status: 201 });
}

/**
 * PATCH /api/admin/listing-pricing — update price
 */
export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { id, price_per_day, active } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (price_per_day !== undefined) {
    updates.credits_per_day = Math.round(price_per_day as number);
  }
  if (active !== undefined) updates.active = active;

  const { error } = await auth.supabase.from("listing_pricing").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/listing-pricing — deactivate
 */
export async function DELETE(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await auth.supabase.from("listing_pricing").update({ active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
