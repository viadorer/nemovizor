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
    .select("id, name, owner_type, owner_id, scopes, rate_limit_per_min, expires_at, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle()) as { data: ApiKeyRow | null; error: unknown };

  if (error || !data) return null;

  const now = new Date();
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) <= now) return null;

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
