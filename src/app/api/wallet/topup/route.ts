import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/wallet/topup
 * Admin or self top-up wallet.
 * Body: { wallet_id: string, amount: number (in main units, e.g. 100 = 100 CZK), note?: string }
 */
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.wallet_id || !body?.amount || body.amount <= 0) {
    return NextResponse.json({ error: "wallet_id and positive amount required" }, { status: 400 });
  }

  // Get wallet to determine currency multiplier
  const { data: wallet, error: wErr } = await client
    .from("wallets")
    .select("id, currency, balance, user_id")
    .eq("id", body.wallet_id)
    .single();

  if (wErr || !wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  // Convert main units to smallest unit (haléře/cents)
  const multiplier = 100; // all currencies use 100 subunits
  const amountSmallest = Math.round(body.amount * multiplier);

  const { data: txId, error } = await client.rpc("wallet_credit", {
    p_wallet_id: wallet.id,
    p_amount: amountSmallest,
    p_category: "deposit",
    p_description: body.note || `Dobití ${body.amount} ${wallet.currency.toUpperCase()}`,
    p_reference_type: "manual",
  });

  if (error) {
    console.error("[wallet/topup]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fetch updated balance
  const { data: updated } = await client
    .from("wallets")
    .select("balance")
    .eq("id", wallet.id)
    .single();

  return NextResponse.json({
    ok: true,
    transaction_id: txId,
    new_balance: (updated?.balance || 0) / multiplier,
    currency: wallet.currency,
  });
}
