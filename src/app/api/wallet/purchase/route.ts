import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * POST /api/wallet/purchase — purchase a service using wallet credits
 * Body: { service_code, property_id?, broker_id?, agency_id? }
 *
 * Uses unified credit system (1 credit = 1 kr).
 * Reads price from service_catalog.credits_price (fallback base_price/100).
 */
export async function POST(req: Request) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized — broker or admin required" }, { status: 401 });

  const { supabase, user } = auth;
  const body = await req.json();

  const {
    service_code,
    property_id, broker_id, agency_id,
  } = body as {
    service_code: string;
    property_id?: string; broker_id?: string; agency_id?: string;
  };

  if (!service_code) {
    return NextResponse.json({ error: "service_code required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1. Get service from catalog
  const { data: service } = await supabase
    .from("service_catalog")
    .select("code, name, description, base_price, duration_days, category, active, metadata")
    .eq("code", service_code)
    .eq("active", true)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found or inactive" }, { status: 404 });
  }

  // 2. Get price in credits — try credits_price column, fallback to base_price/100
  let creditPrice: number;
  const { data: catalogRow } = await sb.from("service_catalog").select("credits_price, base_price").eq("code", service_code).single();
  if (catalogRow?.credits_price && catalogRow.credits_price > 0) {
    creditPrice = Number(catalogRow.credits_price);
  } else {
    creditPrice = Math.round((catalogRow?.base_price || 0) / 100);
  }

  if (creditPrice <= 0) {
    return NextResponse.json({ error: "No price configured for this service" }, { status: 404 });
  }

  // 3. Find wallet (unified — one per user, country='global')
  let { data: wallet } = await supabase
    .from("wallets")
    .select("id, credits, frozen")
    .eq("user_id", user.id)
    .single();

  if (!wallet) {
    return NextResponse.json({ error: "No wallet found. Please contact support." }, { status: 404 });
  }

  // 4. Pre-flight checks
  if (wallet.frozen) {
    return NextResponse.json({ error: "Wallet is frozen. Contact support." }, { status: 403 });
  }

  if (wallet.credits < creditPrice) {
    return NextResponse.json({
      error: "Insufficient credits",
      credits: wallet.credits,
      price_required: creditPrice,
    }, { status: 402 });
  }

  // 5. Expiration date
  const expiresAt = service.duration_days
    ? new Date(Date.now() + service.duration_days * 86400_000).toISOString()
    : null;

  // 6. Create purchase record
  const { data: purchase, error: purchaseErr } = await supabase
    .from("purchases")
    .insert({
      wallet_id: wallet.id,
      user_id: user.id,
      service_code,
      property_id: property_id || null,
      broker_id: broker_id || null,
      agency_id: agency_id || null,
      price_paid: creditPrice,
      currency: "credits",
      country: "global",
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      status: "active",
    })
    .select("id")
    .single();

  if (purchaseErr || !purchase) {
    return NextResponse.json({ error: "Failed to create purchase: " + (purchaseErr?.message || "") }, { status: 500 });
  }

  // 7. Debit credits from wallet
  const newCredits = wallet.credits - creditPrice;
  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    type: "debit",
    amount: creditPrice,
    credits: creditPrice,
    balance_before: wallet.credits,
    balance_after: newCredits,
    category: mapCategory(service.category),
    description: `${service.name} (${creditPrice} kr)`,
    reference_type: "purchase",
    reference_id: purchase.id,
    created_by: user.id,
  });

  if (txErr) {
    await supabase.from("purchases").update({ status: "cancelled" }).eq("id", purchase.id);
    return NextResponse.json({ error: "Payment failed: " + txErr.message }, { status: 402 });
  }

  await supabase.from("wallets").update({ credits: newCredits }).eq("id", wallet.id);

  // 8. Apply service effects
  const cat = service.category;

  // TIP — featured property
  if ((cat === "tip") && property_id) {
    await supabase.from("properties").update({
      featured: true,
      featured_until: expiresAt,
    }).eq("id", property_id);
  }

  // TOP — top position in category
  if (service_code.startsWith("top_listing") && property_id) {
    await supabase.from("properties").update({
      top_position: true,
      top_until: expiresAt,
    }).eq("id", property_id);
  }

  // Broker promo
  if (cat === "broker_promo" && broker_id) {
    await supabase.from("brokers").update({ is_promoted: true }).eq("id", broker_id);
  }

  // Agency promo
  if (cat === "agency_promo" && agency_id) {
    await supabase.from("agencies").update({ is_promoted: true }).eq("id", agency_id);
  }

  // Listing basic/premium — mark as premium if premium
  if (cat === "listing" && property_id && service_code.includes("premium")) {
    await supabase.from("properties").update({ is_premium: true }).eq("id", property_id);
  }

  return NextResponse.json({
    success: true,
    purchase_id: purchase.id,
    price_paid: creditPrice,
    credits_remaining: newCredits,
    expires_at: expiresAt,
  }, { status: 201 });
}

function mapCategory(serviceCategory: string): string {
  switch (serviceCategory) {
    case "tip": return "tip_purchase";
    case "broker_promo": return "broker_promo";
    case "agency_promo": return "agency_promo";
    case "project": return "project_page";
    case "listing": return "listing_fee";
    default: return serviceCategory;
  }
}

/**
 * GET /api/wallet/purchase — get price quote without purchasing
 * Query: service_code
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const service_code = url.searchParams.get("service_code");

  if (!service_code) {
    return NextResponse.json({ error: "service_code required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { data: service } = await sb
    .from("service_catalog")
    .select("code, name, description, duration_days, category, credits_price, base_price")
    .eq("code", service_code)
    .eq("active", true)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const credits = service.credits_price > 0 ? Number(service.credits_price) : Math.round((service.base_price || 0) / 100);

  // Get wallet balance
  const { data: wallet } = await auth.supabase
    .from("wallets")
    .select("credits")
    .eq("user_id", auth.user.id)
    .single();

  return NextResponse.json({
    service_code: service.code,
    name: service.name,
    description: service.description,
    duration_days: service.duration_days,
    category: service.category,
    price: credits,
    wallet_credits: wallet?.credits ?? 0,
    can_afford: (wallet?.credits ?? 0) >= credits,
  });
}
