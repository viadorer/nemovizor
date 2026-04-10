/**
 * API key management for the public Nemovizor API.
 *
 * Keys look like: `nvz_<32 url-safe random chars>`. The raw value is
 * returned only once at creation time and never stored. The database only
 * keeps a SHA-256 hex digest plus an 8-char prefix for identification.
 */
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const API_KEY_PREFIX = "nvz_";
const RAW_BODY_LENGTH = 32; // characters after the prefix

// ─── Scopes ────────────────────────────────────────────────────────────────

/**
 * Scope vocabulary used for API key permission checks.
 *
 *   • `read:public` — every key gets this implicitly. Grants access to all
 *     /api/v1/* read endpoints (properties list, detail, map, filters,
 *     ai-search, valuation status, broker-analytics, broker-contact).
 *
 *   • `read:broker` — read access to broker-scoped data the caller owns
 *     (own properties, own analytics, own leads). Reserved for future
 *     broker self-service endpoints.
 *
 *   • `write:broker` — mutate broker-scoped data the caller owns. Required
 *     for future "submit a listing via API" / "update price" endpoints.
 *
 *   • `read:admin` — admin-tier read (currently unused; placeholder for
 *     future cross-broker analytics endpoints accessible via API key).
 *
 *   • `write:webhooks` — manage webhook subscriptions (Phase D).
 *
 * The set is intentionally narrow. Adding new scopes requires updating
 * `KNOWN_SCOPES`, the admin UI dropdown, and the CLI flag.
 */
export const KNOWN_SCOPES = [
  "read:public",
  "read:broker",
  "write:broker",
  "read:admin",
  "write:webhooks",
  "write:import",
] as const;

export type ApiScope = (typeof KNOWN_SCOPES)[number];

export function isKnownScope(s: string): s is ApiScope {
  return (KNOWN_SCOPES as readonly string[]).includes(s);
}

/** Default scopes assigned to a freshly created key when none specified. */
export const DEFAULT_SCOPES: ApiScope[] = ["read:public"];

/** Generate a fresh raw API key. Returns the full string to hand to the user. */
export function generateApiKey(): string {
  // 24 random bytes → 32 chars of base64url after trimming padding.
  const body = randomBytes(24).toString("base64url").slice(0, RAW_BODY_LENGTH);
  return `${API_KEY_PREFIX}${body}`;
}

/** Hex SHA-256 digest of the raw key. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** The 8-char prefix shown in UIs: `nvz_xxxx`. */
export function prefixApiKey(raw: string): string {
  return raw.slice(0, 8);
}

/**
 * Extract a bearer token from the request.
 * Accepts `Authorization: Bearer <key>` or `X-API-Key: <key>`.
 * Returns `null` if no token is present. Does NOT validate against the DB.
 */
export function extractBearerToken(req: NextRequest | Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) return xApiKey.trim();
  return null;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  ownerType: "broker" | "agency";
  ownerId: string;
  scopes: string[];
  rateLimitPerMin: number;
  expiresAt: string | null;
  revokedAt: string | null;
}

/**
 * Look up a raw API key in the DB. Returns `null` if:
 *  - the key is malformed
 *  - no row with the hashed value exists
 *  - the key is revoked or expired
 *
 * The caller should treat `null` as "no valid key" and fall through to
 * anonymous rate limiting.
 *
 * Side effect: updates `last_used_at` on successful matches, fire-and-forget.
 */
interface ApiKeyRow {
  id: string;
  name: string;
  owner_type: string;
  owner_id: string;
  scopes: string[] | null;
  rate_limit_per_min: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  subscription_id: string | null;
}

export async function lookupApiKey(raw: string): Promise<ApiKeyRecord | null> {
  if (!raw || !raw.startsWith(API_KEY_PREFIX)) return null;
  if (!supabaseAdmin) return null; // service role required

  const hash = hashApiKey(raw);
  // Untyped cast — api_keys table is not yet in the generated Supabase types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as unknown as any;
  const { data, error } = (await client
    .from("api_keys")
    .select("id, name, owner_type, owner_id, scopes, rate_limit_per_min, expires_at, revoked_at, subscription_id")
    .eq("key_hash", hash)
    .maybeSingle()) as { data: ApiKeyRow | null; error: unknown };

  if (error || !data) return null;

  const now = new Date();
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) <= now) return null;

  // Defense-in-depth: if key is linked to a subscription, verify it's still
  // in an allowed state. Catches edge cases where the webhook failed to
  // revoke the key on subscription cancellation.
  if (data.subscription_id) {
    const { data: sub } = (await client
      .from("api_subscriptions")
      .select("status")
      .eq("id", data.subscription_id)
      .maybeSingle()) as { data: { status: string } | null; error: unknown };

    const allowedStatuses = ["active", "past_due", "trialing"];
    if (!sub || !allowedStatuses.includes(sub.status)) return null;
  }

  // Fire-and-forget: stamp last_used_at so we can surface stale keys later.
  void client
    .from("api_keys")
    .update({ last_used_at: now.toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    id: data.id,
    name: data.name,
    ownerType: data.owner_type as "broker" | "agency",
    ownerId: data.owner_id,
    scopes: data.scopes ?? [],
    rateLimitPerMin: data.rate_limit_per_min ?? 300,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
  };
}

/**
 * Check whether the given record has the required scope.
 *
 * Implicit grant: every API key has `read:public` even if not listed.
 * This keeps existing keys (created before scopes were enforced) working
 * for read endpoints, while allowing future write endpoints to require an
 * explicit `write:broker` opt-in.
 */
export function hasScope(record: ApiKeyRecord, required: ApiScope): boolean {
  if (required === "read:public") return true;
  return record.scopes.includes(required);
}

