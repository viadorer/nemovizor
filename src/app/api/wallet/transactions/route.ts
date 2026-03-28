import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/wallet/transactions?wallet_id=xxx&page=1&limit=20
 * GET /api/wallet/transactions?all=true&page=1&limit=200  (all wallets)
 * Returns paginated transaction history for a wallet or all wallets.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;
  const sp = req.nextUrl.searchParams;
  const walletId = sp.get("wallet_id");
  const allWallets = sp.get("all") === "true";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
  const category = sp.get("category") || null;

  if (!walletId && !allWallets) return NextResponse.json({ error: "wallet_id or all=true required" }, { status: 400 });

  // ── All wallets mode ────────────────────────────────────────────────
  if (allWallets) {
    const { data: userWallets } = await supabase
      .from("wallets")
      .select("id, country, currency")
      .eq("user_id", user.id);

    if (!userWallets || userWallets.length === 0) {
      return NextResponse.json({ transactions: [], total: 0, page: 1, pages: 0 });
    }

    const walletIds = userWallets.map((w: { id: string }) => w.id);
    const walletMap = new Map(userWallets.map((w: { id: string; country: string; currency: string }) => [w.id, w]));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("wallet_transactions")
      .select("id, wallet_id, type, amount, credits, balance_before, balance_after, category, description, reference_type, reference_id, metadata, created_by, created_at", { count: "exact" })
      .in("wallet_id", walletIds);

    if (category) query = query.eq("category", category);
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const transactions = (data || []).map((t: Record<string, unknown>) => {
      const wInfo = walletMap.get(t.wallet_id as string);
      return {
        ...t,
        country: (wInfo as { country: string })?.country || "",
        currency: (wInfo as { currency: string })?.currency || "",
        credits: (t as { credits?: number }).credits || t.amount as number,
        amount_display: (t as { credits?: number }).credits || t.amount as number,
        balance_after_display: (t.balance_after as number),
      };
    });

    return NextResponse.json({
      transactions,
      total: count ?? 0,
      page,
      pages: Math.ceil((count ?? 0) / limit),
    });
  }

  // ── Single wallet mode ──────────────────────────────────────────────
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
    .select("id, type, amount, credits, balance_before, balance_after, category, description, reference_type, reference_id, metadata, created_by, created_at", { count: "exact" })
    .eq("wallet_id", walletId);

  if (category) query = query.eq("category", category);

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = (data || []).map((t: Record<string, unknown>) => ({
    ...t,
    credits: (t as { credits?: number }).credits || t.amount as number,
    amount_display: (t as { credits?: number }).credits || t.amount as number,
    balance_after_display: (t.balance_after as number),
  }));

  return NextResponse.json({
    transactions,
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
