/**
 * API subscription plan definitions.
 *
 * Single source of truth for tier → Stripe price ID, rate limits, scopes.
 * Stripe Price IDs come from env vars (set after creating Products in
 * Stripe Dashboard).
 */

import type { ApiScope } from "@/lib/api/api-key";

export interface ApiPlan {
  tier: "starter" | "pro" | "enterprise";
  name: string;
  priceCzk: number;
  stripePriceId: string;
  rateLimitPerMin: number;
  maxWebhooks: number;
  scopes: ApiScope[];
}

export type PlanTier = ApiPlan["tier"];

const PLAN_DEFINITIONS: Omit<ApiPlan, "stripePriceId">[] = [
  {
    tier: "starter",
    name: "Starter",
    priceCzk: 990,
    rateLimitPerMin: 300,
    maxWebhooks: 10,
    scopes: ["read:public"],
  },
  {
    tier: "pro",
    name: "Pro",
    priceCzk: 4_900,
    rateLimitPerMin: 2_000,
    maxWebhooks: 50,
    scopes: ["read:public", "read:broker", "write:broker"],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    priceCzk: 19_900,
    rateLimitPerMin: 10_000,
    maxWebhooks: 200,
    scopes: ["read:public", "read:broker", "write:broker", "write:webhooks"],
  },
];

function priceEnvVar(tier: string): string {
  return process.env[`STRIPE_PRICE_${tier.toUpperCase()}`] ?? "";
}

/** Fully resolved plans with Stripe Price IDs from env. */
export const API_PLANS: Record<PlanTier, ApiPlan> = Object.fromEntries(
  PLAN_DEFINITIONS.map((d) => [
    d.tier,
    { ...d, stripePriceId: priceEnvVar(d.tier) },
  ]),
) as Record<PlanTier, ApiPlan>;

/** Reverse lookup: Stripe Price ID → plan. Returns undefined if not found. */
export function planByPriceId(priceId: string): ApiPlan | undefined {
  return Object.values(API_PLANS).find((p) => p.stripePriceId === priceId);
}

/** Check if a tier string is valid. */
export function isValidTier(t: string): t is PlanTier {
  return t === "starter" || t === "pro" || t === "enterprise";
}
