/**
 * Stripe Customer helper.
 *
 * Ensures each Nemovizor user has exactly one Stripe Customer record.
 * The Stripe customer ID is cached on profiles.stripe_customer_id so
 * we don't hit the Stripe API on every request.
 */

import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, {
    apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
  });
}

/**
 * Get or create a Stripe Customer for the given user.
 * Returns the Stripe customer ID (cus_xxx).
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
): Promise<string> {
  if (!supabaseAdmin) throw new Error("supabaseAdmin not configured");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any;

  // Check cached customer ID
  const { data: profile } = await client
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new Stripe customer
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  // Cache on profile
  await client
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}
