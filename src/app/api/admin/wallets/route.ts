import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/admin/wallets — list all wallets (admin only)
 * Query: user_id?, country?, page, limit, search
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { supabase } = auth;
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
  const userId = sp.get("user_id");
  const country = sp.get("country");

  const offset = (page - 1) * limit;

  let query = supabase
    .from("wallets")
    .select("id, user_id, country, currency, balance, credit_limit, frozen, created_at, updated_at", { count: "exact" });

  if (userId) query = query.eq("user_id", userId);
  if (country) query = query.eq("country", country);

  query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wallets = (data || []).map((w) => ({
    ...w,
    balance_display: (w.balance as number) / 100,
    credit_limit_display: (w.credit_limit as number) / 100,
  }));

  return NextResponse.json({ wallets, total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}

/**
 * PATCH /api/admin/wallets — admin actions: top-up, freeze, set credit limit
 * Body: { wallet_id, action: "credit" | "freeze" | "unfreeze" | "set_credit_limit", amount?, credit_limit?, description? }
 */
export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { supabase, user } = auth;
  const body = await req.json();
  const { wallet_id, action, amount, credit_limit, description } = body as {
    wallet_id: string; action: string; amount?: number; credit_limit?: number; description?: string;
  };

  if (!wallet_id || !action) {
    return NextResponse.json({ error: "wallet_id and action required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  switch (action) {
    case "credit": {
      if (!amount || amount <= 0) return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
      const amountCents = Math.round(amount * 100);
      const { data: txId, error } = await sb.rpc("wallet_credit", {
        p_wallet_id: wallet_id,
        p_amount: amountCents,
        p_category: "deposit",
        p_description: description || `Admin top-up: ${amount}`,
        p_reference_type: "manual",
        p_reference_id: null,
        p_created_by: user.id,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, transaction_id: txId, amount_credited: amount });
    }

    case "freeze": {
      const { error } = await supabase.from("wallets").update({ frozen: true, updated_at: new Date().toISOString() }).eq("id", wallet_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, frozen: true });
    }

    case "unfreeze": {
      const { error } = await supabase.from("wallets").update({ frozen: false, updated_at: new Date().toISOString() }).eq("id", wallet_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, frozen: false });
    }

    case "set_credit_limit": {
      if (credit_limit === undefined || credit_limit < 0) return NextResponse.json({ error: "credit_limit must be >= 0" }, { status: 400 });
      const limitCents = Math.round(credit_limit * 100);
      const { error } = await supabase.from("wallets").update({ credit_limit: limitCents, updated_at: new Date().toISOString() }).eq("id", wallet_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, credit_limit });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
