import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabase } from "@/lib/supabase";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion });
}

/**
 * POST /api/wallet/webhook
 * Stripe webhook — credits wallet after successful payment.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    if (webhookSecret) {
      event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      // Dev mode — no signature verification
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};

    // ── Valuation report payment ──
    if (meta.type === "valuation_report") {
      const valuationId = meta.valuation_id;
      if (valuationId) {
        console.log(`[stripe webhook] Valuation report paid: ${valuationId}`);
        // Trigger PDF generation
        try {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nemovizor.vercel.app";
          await fetch(`${baseUrl}/api/valuation/report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valuationId, skipPayment: true }),
          });
        } catch (e) {
          console.error("[stripe webhook] Report generation error:", e);
        }
        // Mark as paid
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = getSupabase() as any;
        if (db) {
          await db.from("valuation_reports").update({
            paid: true,
            amount_paid: 99,
            payment_method: "stripe",
            payment_ref: session.id,
          }).eq("id", valuationId).catch(() => {});
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Wallet topup payment ──
    const userId = meta.user_id;
    const credits = parseInt(meta.credits || "0", 10);
    const currency = meta.currency || "czk";
    const amount = meta.amount || "0";

    if (!userId || !credits) {
      console.error("[stripe webhook] Missing metadata:", meta);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = getSupabase() as any;
    if (!client) return NextResponse.json({ error: "No DB" }, { status: 503 });

    // Get or create wallet
    let { data: wallet } = await client
      .from("wallets")
      .select("id, credits")
      .eq("user_id", userId)
      .single();

    if (!wallet) {
      const { data: newWallet } = await client
        .from("wallets")
        .insert({ user_id: userId, credits: 0 })
        .select()
        .single();
      wallet = newWallet;
    }

    if (!wallet) {
      console.error("[stripe webhook] Cannot find/create wallet for", userId);
      return NextResponse.json({ error: "Wallet error" }, { status: 500 });
    }

    const newBalance = (wallet.credits || 0) + credits;

    // Record transaction
    const { error: txErr } = await client.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "credit",
      amount: credits,
      credits,
      balance_before: wallet.credits || 0,
      balance_after: newBalance,
      category: "stripe_payment",
      description: `Stripe dobití ${amount} ${currency.toUpperCase()} → ${credits} kr (${session.id})`,
      reference_type: "stripe",
      created_by: userId,
    });

    if (txErr) {
      console.error("[stripe webhook] TX error:", txErr.message);
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    // Update balance
    await client.from("wallets").update({ credits: newBalance }).eq("id", wallet.id);

    console.log(`[stripe webhook] Credited ${credits} kr to user ${userId} (Stripe ${session.id})`);
  }

  return NextResponse.json({ received: true });
}
