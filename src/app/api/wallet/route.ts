import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/wallet — returns all wallets for the authenticated user
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("wallets")
    .select("id, country, currency, balance, credit_limit, frozen, created_at, updated_at")
    .eq("user_id", user.id)
    .order("country");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Format balance for display (divide by 100)
  const wallets = (data || []).map((w) => ({
    ...w,
    balance_display: w.balance / 100,
    credit_limit_display: w.credit_limit / 100,
  }));

  return NextResponse.json({ wallets });
}

/**
 * POST /api/wallet — create a wallet for a country (if not exists)
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;
  const body = await req.json();
  const { country, currency } = body;

  if (!country || !currency) {
    return NextResponse.json({ error: "country and currency required" }, { status: 400 });
  }

  // Check if wallet already exists
  const { data: existing } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", user.id)
    .eq("country", country)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Wallet already exists for this country", wallet_id: existing.id }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("wallets")
    .insert({ user_id: user.id, country, currency })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ wallet: data }, { status: 201 });
}
