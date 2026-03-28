import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/wallet — returns the single unified wallet for the authenticated user
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;

  // Single wallet per user
  const { data, error } = await supabase
    .from("wallets")
    .select("id, credits, balance, currency, discount_pct, promo_balance, frozen, created_at, updated_at")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ wallet: null });
  }

  // Get exchange rates for display
  const { data: rates } = await supabase
    .from("credit_exchange_rates")
    .select("currency, currency_label, credits_per_unit")
    .eq("active", true)
    .order("currency");

  return NextResponse.json({
    wallet: {
      ...data,
      credits: data.credits || 0,
      discount_pct: data.discount_pct || 0,
      promo_balance: data.promo_balance || 0,
    },
    exchangeRates: rates || [],
  });
}

/**
 * POST /api/wallet — create a wallet for the user (if not exists)
 */
export async function POST() {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;

  // Check if wallet already exists
  const { data: existing } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Wallet already exists", wallet_id: existing.id }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("wallets")
    .insert({ user_id: user.id, currency: "credits", credits: 0, balance: 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ wallet: data }, { status: 201 });
}
