/**
 * POST /api/subscriptions/portal
 *
 * Creates a Stripe Customer Portal session for managing billing.
 * Returns { url } — redirect the user to Stripe's hosted portal.
 * Handles: plan upgrades/downgrades, payment method changes, cancellation.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { getStripe } from "@/lib/stripe/customer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Login required", 401);

  if (!supabaseAdmin) {
    return apiError("SERVICE_UNAVAILABLE", "Admin client unavailable", 503);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;
  const { data: profile } = await client
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return apiError("NOT_FOUND", "No Stripe customer found. Subscribe first.", 404);
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://nemovizor.vercel.app";

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/dashboard/moje-api`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[subscriptions/portal] Stripe error:", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
