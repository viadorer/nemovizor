/**
 * POST /api/subscriptions/checkout
 *
 * Creates a Stripe Checkout Session for an API subscription.
 * Body: { tier: "starter" | "pro" | "enterprise" }
 * Returns: { url: string } — redirect the user to this Stripe-hosted page.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { API_PLANS, isValidTier } from "@/lib/stripe/plans";
import { getOrCreateStripeCustomer, getStripe } from "@/lib/stripe/customer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) {
    return apiError("UNAUTHORIZED", "Login required", 401);
  }

  const body = await req.json().catch(() => null);
  if (!body?.tier || !isValidTier(body.tier)) {
    return apiError("VALIDATION_ERROR", "Invalid tier. Must be starter, pro, or enterprise.", 400);
  }

  const plan = API_PLANS[body.tier as keyof typeof API_PLANS];
  if (!plan.stripePriceId) {
    return apiError("SERVICE_UNAVAILABLE", `Stripe price not configured for ${body.tier}`, 503);
  }

  // Check for existing active subscription
  if (supabaseAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabaseAdmin as any;
    const { data: existing } = await client
      .from("api_subscriptions")
      .select("id, plan_tier, status")
      .eq("user_id", auth.user.id)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `You already have an active ${existing.plan_tier} subscription. Use the billing portal to change plans.` },
        { status: 409 },
      );
    }
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://nemovizor.vercel.app";

  try {
    const customerId = await getOrCreateStripeCustomer(
      auth.user.id,
      auth.user.email ?? "",
    );

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: {
        user_id: auth.user.id,
        tier: plan.tier,
      },
      success_url: `${origin}/dashboard/moje-api?subscription=success`,
      cancel_url: `${origin}/developers?subscription=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[subscriptions/checkout] Stripe error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
