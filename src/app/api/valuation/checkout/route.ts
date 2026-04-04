import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion });
}

/**
 * POST /api/valuation/checkout
 * Creates Stripe Checkout session for PDF valuation report (99 CZK)
 * Body: { valuationId, email }
 */
export async function POST(req: NextRequest) {
  try {
    const { valuationId, email } = await req.json();
    if (!valuationId || !email) {
      return NextResponse.json({ error: "valuationId and email required" }, { status: 400 });
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "czk",
          product_data: {
            name: "Detailní ocenění nemovitosti — PDF report",
            description: "AI komentář, katastrální data, porovnání s okolím, investiční doporučení",
          },
          unit_amount: 9900, // 99 CZK in haléře
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${baseUrl}/oceneni/report?session_id={CHECKOUT_SESSION_ID}&valuation_id=${valuationId}`,
      cancel_url: `${baseUrl}/oceneni?cancelled=true`,
      metadata: {
        type: "valuation_report",
        valuation_id: valuationId,
        email,
      },
    });

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (e) {
    console.error("[valuation/checkout] Error:", e);
    return NextResponse.json({ error: "Chyba při vytváření platby" }, { status: 500 });
  }
}
