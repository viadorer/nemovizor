/**
 * POST /api/subscriptions/webhook
 *
 * Stripe webhook handler for subscription lifecycle events.
 * Uses a SEPARATE webhook secret from the wallet webhook to ensure
 * complete isolation of concerns.
 *
 * Events handled:
 *   - customer.subscription.created  → insert api_subscriptions row
 *   - customer.subscription.updated  → update row + propagate to api_keys
 *   - customer.subscription.deleted  → cancel + revoke linked keys
 *   - invoice.payment_failed         → mark past_due
 *   - invoice.paid                   → restore active
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { planByPriceId } from "@/lib/stripe/plans";
import { getStripe } from "@/lib/stripe/customer";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return supabaseAdmin;
}

async function findUserByCustomer(stripeCustomerId: string): Promise<string | null> {
  const client = db();
  if (!client) return null;
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return data?.id ?? null;
}

// ─── Event handlers ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreated(sub: any) {
  const client = db();
  if (!client) return;

  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = priceId ? planByPriceId(priceId) : undefined;
  if (!plan) {
    console.warn("[sub-webhook] Unknown price ID:", priceId);
    return;
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const userId = await findUserByCustomer(customerId);
  if (!userId) {
    console.warn("[sub-webhook] No user for customer:", customerId);
    return;
  }

  const { error } = await client.from("api_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan_tier: plan.tier,
      status: sub.status === "active" || sub.status === "trialing" ? sub.status : "incomplete",
      rate_limit_per_min: plan.rateLimitPerMin,
      max_webhooks: plan.maxWebhooks,
      scopes: plan.scopes,
      current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    console.error("[sub-webhook] Insert/upsert error:", error.message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(sub: any) {
  const client = db();
  if (!client) return;

  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = priceId ? planByPriceId(priceId) : undefined;

  const updateData: Record<string, unknown> = {
    status: sub.status,
    current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
  };

  // If plan changed (upgrade/downgrade), update limits
  if (plan) {
    updateData.stripe_price_id = priceId;
    updateData.plan_tier = plan.tier;
    updateData.rate_limit_per_min = plan.rateLimitPerMin;
    updateData.max_webhooks = plan.maxWebhooks;
    updateData.scopes = plan.scopes;
  }

  const { error } = await client
    .from("api_subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", sub.id);

  if (error) {
    console.error("[sub-webhook] Update error:", error.message);
    return;
  }

  // Propagate new limits to linked API keys
  if (plan) {
    const { data: subRow } = await client
      .from("api_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();

    if (subRow) {
      await client
        .from("api_keys")
        .update({
          rate_limit_per_min: plan.rateLimitPerMin,
          scopes: plan.scopes,
        })
        .eq("subscription_id", subRow.id)
        .is("revoked_at", null);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionDeleted(sub: any) {
  const client = db();
  if (!client) return;

  // Mark subscription as canceled
  const { data: subRow } = await client
    .from("api_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .select("id")
    .maybeSingle();

  // Soft-revoke all linked keys
  if (subRow) {
    await client
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("subscription_id", subRow.id)
      .is("revoked_at", null);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(invoice: any) {
  const client = db();
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!client || !subId) return;

  await client
    .from("api_subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInvoicePaid(invoice: any) {
  const client = db();
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!client || !subId) return;

  await client
    .from("api_subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", subId)
    .eq("status", "past_due");
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;

  try {
    const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || "";
    if (webhookSecret) {
      event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      // Dev mode — no signature verification
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("[sub-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event type — acknowledge without error
        break;
    }
  } catch (err) {
    console.error(`[sub-webhook] Handler error for ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}
