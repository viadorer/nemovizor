import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * POST /api/wallet/purchase — purchase a service using wallet balance
 * Body: { service_code, country, property_id?, broker_id?, agency_id?, city?, listing_type?, property_category? }
 *
 * Flow:
 * 1. Look up service in catalog
 * 2. Get price (regional override or base)
 * 3. Find/create wallet for country
 * 4. Atomic debit via wallet_debit()
 * 5. Create purchase record
 * 6. Apply effects (e.g., set featured = true)
 */
export async function POST(req: Request) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized — broker or admin required" }, { status: 401 });

  const { supabase, user } = auth;
  const body = await req.json();

  const {
    service_code, country,
    property_id, broker_id, agency_id,
    city, listing_type, property_category,
  } = body as {
    service_code: string; country: string;
    property_id?: string; broker_id?: string; agency_id?: string;
    city?: string; listing_type?: string; property_category?: string;
  };

  if (!service_code || !country) {
    return NextResponse.json({ error: "service_code and country required" }, { status: 400 });
  }

  // 1. Get service price via RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: priceData, error: priceErr } = await sb.rpc("get_service_price", {
    p_service_code: service_code,
    p_country: country,
    p_city: city || null,
    p_listing_type: listing_type || null,
    p_property_category: property_category || null,
  });

  if (priceErr || !priceData || priceData.length === 0) {
    return NextResponse.json({ error: priceErr?.message || "Service not found or no price configured" }, { status: 404 });
  }

  const price = priceData[0].price as number;
  const currency = priceData[0].currency as string;

  // 2. Find or create wallet for this country
  let { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, credit_limit, frozen, currency")
    .eq("user_id", user.id)
    .eq("country", country)
    .single();

  if (!wallet) {
    // Auto-create wallet
    const { data: newWallet, error: createErr } = await supabase
      .from("wallets")
      .insert({ user_id: user.id, country, currency })
      .select("id, balance, credit_limit, frozen, currency")
      .single();
    if (createErr || !newWallet) {
      return NextResponse.json({ error: "Failed to create wallet: " + (createErr?.message || "") }, { status: 500 });
    }
    wallet = newWallet;
  }

  // 3. Pre-flight checks
  if (wallet.frozen) {
    return NextResponse.json({ error: "Wallet is frozen. Contact support." }, { status: 403 });
  }

  if (wallet.balance + wallet.credit_limit < price) {
    return NextResponse.json({
      error: "Insufficient funds",
      balance: wallet.balance / 100,
      credit_limit: wallet.credit_limit / 100,
      price_required: price / 100,
      currency,
    }, { status: 402 });
  }

  // 4. Get service duration
  const { data: serviceRow } = await supabase
    .from("service_catalog")
    .select("duration_days, category, name")
    .eq("code", service_code)
    .eq("active", true)
    .single();

  if (!serviceRow) {
    return NextResponse.json({ error: "Service not found or inactive" }, { status: 404 });
  }

  const expiresAt = serviceRow.duration_days
    ? new Date(Date.now() + serviceRow.duration_days * 86400_000).toISOString()
    : null;

  // 5. Create purchase record first (to get reference_id)
  const { data: purchase, error: purchaseErr } = await supabase
    .from("purchases")
    .insert({
      wallet_id: wallet.id,
      user_id: user.id,
      service_code,
      property_id: property_id || null,
      broker_id: broker_id || null,
      agency_id: agency_id || null,
      price_paid: price,
      currency,
      country,
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      status: "active",
    })
    .select("id")
    .single();

  if (purchaseErr || !purchase) {
    return NextResponse.json({ error: "Failed to create purchase: " + (purchaseErr?.message || "") }, { status: 500 });
  }

  // 6. Atomic debit via RPC
  const { data: txId, error: debitErr } = await sb.rpc("wallet_debit", {
    p_wallet_id: wallet.id,
    p_amount: price,
    p_category: serviceRow.category === "tip" ? "tip_purchase" : `${serviceRow.category}_fee`,
    p_description: `${serviceRow.name} — ${country.toUpperCase()}`,
    p_reference_type: "purchase",
    p_reference_id: purchase.id,
    p_created_by: user.id,
  });

  if (debitErr) {
    // Rollback purchase
    await supabase.from("purchases").update({ status: "cancelled" }).eq("id", purchase.id);
    return NextResponse.json({ error: "Payment failed: " + debitErr.message }, { status: 402 });
  }

  // 7. Apply service effects
  if (serviceRow.category === "tip" && property_id) {
    await supabase.from("properties").update({
      featured: true,
      featured_until: expiresAt,
    }).eq("id", property_id);
  }

  if (serviceRow.category === "broker_promo" && broker_id) {
    await supabase.from("brokers").update({ is_promoted: true }).eq("id", broker_id);
  }

  return NextResponse.json({
    success: true,
    purchase_id: purchase.id,
    transaction_id: txId,
    price_paid: price / 100,
    currency,
    expires_at: expiresAt,
  }, { status: 201 });
}

/**
 * GET /api/wallet/purchase — get price quote without purchasing
 * Query: service_code, country, city?, listing_type?, property_category?
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const service_code = url.searchParams.get("service_code");
  const country = url.searchParams.get("country");

  if (!service_code || !country) {
    return NextResponse.json({ error: "service_code and country required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;
  const { data: priceData, error } = await sb.rpc("get_service_price", {
    p_service_code: service_code,
    p_country: country,
    p_city: url.searchParams.get("city") || null,
    p_listing_type: url.searchParams.get("listing_type") || null,
    p_property_category: url.searchParams.get("property_category") || null,
  });

  if (error || !priceData || priceData.length === 0) {
    return NextResponse.json({ error: error?.message || "Price not found" }, { status: 404 });
  }

  const { data: service } = await auth.supabase
    .from("service_catalog")
    .select("name, description, duration_days, category")
    .eq("code", service_code)
    .eq("active", true)
    .single();

  return NextResponse.json({
    service_code,
    name: service?.name || service_code,
    description: service?.description,
    duration_days: service?.duration_days,
    category: service?.category,
    price: priceData[0].price / 100,
    price_raw: priceData[0].price,
    currency: priceData[0].currency,
    country,
  });
}
