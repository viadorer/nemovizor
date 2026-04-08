/**
 * Resolves per-request auth context for public API endpoints.
 *
 * Every tier-1 endpoint stays anonymous-first, but if the caller presents a
 * valid API key via `Authorization: Bearer …` (or `X-API-Key: …`), we:
 *   - identify the rate-limit bucket by key id instead of IP,
 *   - use the per-key ceiling from the DB row (default 300/min),
 *   - remember the owning broker/agency for future per-owner features.
 *
 * A missing or invalid token is NOT an error — we fall through to anonymous.
 * Callers can opt in to hard `requireApiKey()` later when we actually start
 * gating endpoints.
 */
import type { NextRequest, NextResponse } from "next/server";
import {
  extractBearerToken,
  hasScope,
  lookupApiKey,
  type ApiKeyRecord,
  type ApiScope,
} from "./api-key";
import { getClientKey, type RateLimitConfig } from "./rate-limit";
import { apiError, type ApiErrorBody } from "./response";

export interface AuthContext {
  kind: "anonymous" | "apiKey";
  /** Stable bucket key for the rate limiter. */
  rateLimitClientKey: string;
  /** Effective per-endpoint rate-limit config (may override the default). */
  rateLimitConfig: RateLimitConfig;
  /** API key record when `kind === "apiKey"`, else `null`. */
  apiKey: ApiKeyRecord | null;
}

/**
 * Resolve the auth context for a request and a default (anonymous) rate limit.
 *
 * - No token → anonymous bucket keyed by IP, default config unchanged.
 * - Valid token → keyed bucket `"apikey:<id>"`, ceiling = key's `rate_limit_per_min`.
 */
export async function resolveAuthContext(
  req: NextRequest,
  defaultConfig: RateLimitConfig,
): Promise<AuthContext> {
  const token = extractBearerToken(req);
  if (token) {
    const key = await lookupApiKey(token);
    if (key) {
      return {
        kind: "apiKey",
        rateLimitClientKey: `apikey:${key.id}`,
        rateLimitConfig: {
          name: defaultConfig.name,
          windowMs: defaultConfig.windowMs,
          // DB-stored ceiling applies to every endpoint this key touches.
          // If the caller wanted a tighter endpoint-specific cap we could
          // take Math.min(defaultConfig.max, key.rateLimitPerMin) here.
          max: key.rateLimitPerMin,
        },
        apiKey: key,
      };
    }
  }
  return {
    kind: "anonymous",
    rateLimitClientKey: getClientKey(req),
    rateLimitConfig: defaultConfig,
    apiKey: null,
  };
}

/**
 * Enforce a scope on the resolved auth context. Public read endpoints
 * (`read:public`) are always allowed for anyone — caller does not need to
 * call this. Use it inside route handlers for write or restricted endpoints.
 *
 * Returns:
 *   • `null` when allowed (the caller satisfies the required scope)
 *   • a 401/403 NextResponse to short-circuit the request when not allowed
 */
export function requireScope(
  authCtx: AuthContext,
  required: ApiScope,
): NextResponse<ApiErrorBody> | null {
  if (required === "read:public") return null;

  if (authCtx.kind !== "apiKey" || !authCtx.apiKey) {
    return apiError(
      "UNAUTHORIZED",
      `This endpoint requires an API key with the "${required}" scope. ` +
        `Authenticate with Authorization: Bearer <key>.`,
      401,
    );
  }

  if (!hasScope(authCtx.apiKey, required)) {
    return apiError(
      "FORBIDDEN",
      `Your API key is missing the required scope "${required}".`,
      403,
    );
  }

  return null;
}
