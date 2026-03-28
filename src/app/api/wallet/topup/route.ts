import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabase } from "@/lib/supabase";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion });
}

/**
 * POST /api/wallet/topup
 * Body: { user_id, currency, amount }
 * Creates a Stripe Checkout session for credit purchase.
 *
 * Body: { wallet_id, amount, note }  (admin manual topup — no Stripe)
 */
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabase() as any;
  if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // ── Mode 1: Admin manual topup (no Stripe) ──────────────────────────
  if (body.wallet_id && body.amount && !body.currency) {
    const { data: wallet, error: wErr } = await client
      .from("wallets")
      .select("id, credits, user_id")
      .eq("id", body.wallet_id)
      .single();

    if (wErr || !wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    const credits = Math.round(body.amount);
    const newBalance = (wallet.credits || 0) + credits;

    const { error: txErr } = await client.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "credit",
      credits,
      balance_before: wallet.credits || 0,
      balance_after: newBalance,
      category: "deposit",
      description: body.note || `Ruční dobití ${credits} kr`,
      reference_type: "manual",
      created_by: wallet.user_id,
    });
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 400 });

    await client.from("wallets").update({ credits: newBalance }).eq("id", wallet.id);

    return NextResponse.json({ ok: true, credits: newBalance });
  }

  // ── Mode 2: Stripe Checkout ──────────────────────────────────────────
  const { user_id, currency = "czk", amount } = body as {
    user_id: string;
    currency: string;
    amount: number;
  };

  if (!user_id || !amount || amount <= 0) {
    return NextResponse.json({ error: "user_id and positive amount required" }, { status: 400 });
  }

  // Get exchange rate
  const { data: rate } = await client
    .from("credit_exchange_rates")
    .select("credits_per_unit")
    .eq("currency", currency.toLowerCase())
    .eq("active", true)
    .single();

  if (!rate) {
    return NextResponse.json({ error: `No exchange rate for ${currency}` }, { status: 400 });
  }

  const creditsToAdd = Math.round(amount * rate.credits_per_unit);

  // Stripe expects amount in smallest currency unit (cents/haléře)
  // HUF and JPY are zero-decimal currencies
  const zeroDecimal = ["huf", "jpy", "krw", "clp", "pyg", "rwf", "ugx", "vnd"];
  const stripeAmount = zeroDecimal.includes(currency.toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);

  const origin = req.headers.get("origin") || "http://localhost:3000";

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: stripeAmount,
            product_data: {
              name: `${creditsToAdd.toLocaleString("cs")} kreditů — Nemovizor`,
              description: `Dobití ${amount.toLocaleString("cs")} ${currency.toUpperCase()} → ${creditsToAdd.toLocaleString("cs")} kr`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id,
        credits: String(creditsToAdd),
        currency: currency.toLowerCase(),
        amount: String(amount),
      },
      success_url: `${origin}/dashboard/penezenka?topup=success&credits=${creditsToAdd}`,
      cancel_url: `${origin}/dashboard/penezenka?topup=cancelled`,
    });

    return NextResponse.json({ url: session.url, credits: creditsToAdd });
  } catch (err) {
    console.error("[wallet/topup] Stripe error:", err);
    return NextResponse.json({ error: "Stripe session failed" }, { status: 500 });
  }
}
