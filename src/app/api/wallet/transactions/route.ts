import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/wallet/transactions?wallet_id=xxx&page=1&limit=20
 * Returns paginated transaction history for a wallet.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;
  const sp = req.nextUrl.searchParams;
  const walletId = sp.get("wallet_id");
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
  const category = sp.get("category") || null;

  if (!walletId) return NextResponse.json({ error: "wallet_id required" }, { status: 400 });

  // Verify wallet ownership
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, user_id")
    .eq("id", walletId)
    .single();

  if (!wallet || wallet.user_id !== user.id) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  const offset = (page - 1) * limit;

  let query = supabase
    .from("wallet_transactions")
    .select("id, type, amount, balance_before, balance_after, category, description, reference_type, reference_id, metadata, created_by, created_at", { count: "exact" })
    .eq("wallet_id", walletId);

  if (category) query = query.eq("category", category);

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = (data || []).map((t) => ({
    ...t,
    amount_display: t.amount / 100,
    balance_before_display: t.balance_before / 100,
    balance_after_display: t.balance_after / 100,
  }));

  return NextResponse.json({
    transactions,
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
