/**
 * Rate limiter with pluggable backend.
 *
 * Backend selection is automatic, based on environment variables:
 *   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set →
 *     distributed sliding-window via `@upstash/ratelimit`. Correct across
 *     multiple Vercel instances.
 *   - Otherwise → per-process in-memory sliding-window map. Fine as a
 *     first-iteration soft gate on a single Next.js instance.
 *
 * The API (`checkRateLimit`, `rateLimitHeaders`, `rateLimitResponse`) is
 * always async so callers don't need to branch.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { ApiErrorBody } from "./response";

export interface RateLimitConfig {
  /** Logical name, used to separate buckets per endpoint. */
  name: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed within the window. */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Number of requests remaining in the current window (>=0). */
  remaining: number;
  /** Configured ceiling. */
  limit: number;
  /** Epoch seconds when the current window ends. */
  resetAt: number;
  /** Seconds until reset (>=0). Convenience for `Retry-After`. */
  retryAfterSec: number;
  /** Which backend actually served this check — useful for debugging. */
  backend: "memory" | "upstash";
}

// ─── In-memory backend ─────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number /* ms since epoch */ };

/** Exported only for tests. Keyed by `${name}|${client}`. */
export const __buckets = new Map<string, Bucket>();

let touchCount = 0;

/** Reset all buckets — test helper. */
export function __resetBuckets(): void {
  __buckets.clear();
  touchCount = 0;
}

function gc(nowMs: number) {
  touchCount++;
  if (touchCount % 200 !== 0) return;
  for (const [key, bucket] of __buckets) {
    if (bucket.resetAt <= nowMs) __buckets.delete(key);
  }
}

function checkInMemory(
  clientKey: string,
  config: RateLimitConfig,
  nowMsOverride?: number,
): RateLimitResult {
  const nowMs = nowMsOverride ?? Date.now();
  const key = `${config.name}|${clientKey}`;

  gc(nowMs);

  let bucket = __buckets.get(key);
  if (!bucket || bucket.resetAt <= nowMs) {
    bucket = { count: 0, resetAt: nowMs + config.windowMs };
    __buckets.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, config.max - bucket.count);
  const resetAtSec = Math.ceil(bucket.resetAt / 1000);
  const retryAfterSec = Math.max(0, Math.ceil((bucket.resetAt - nowMs) / 1000));
  const ok = bucket.count <= config.max;

  return { ok, remaining, limit: config.max, resetAt: resetAtSec, retryAfterSec, backend: "memory" };
}

// ─── Upstash backend ──────────────────────────────────────────────────────

let upstashRedis: Redis | null | undefined;
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashRedis(): Redis | null {
  if (upstashRedis !== undefined) return upstashRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashRedis = null;
    return null;
  }
  try {
    upstashRedis = new Redis({ url, token });
  } catch (err) {
    console.error("[rate-limit] Upstash init failed, falling back to memory:", err);
    upstashRedis = null;
  }
  return upstashRedis;
}

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  let limiter = upstashLimiters.get(config.name);
  if (!limiter) {
    const windowSec = Math.max(1, Math.round(config.windowMs / 1000));
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.max, `${windowSec} s`),
      analytics: false,
      prefix: `nemovizor:rl:${config.name}`,
    });
    upstashLimiters.set(config.name, limiter);
  }
  return limiter;
}

async function checkUpstash(
  clientKey: string,
  config: RateLimitConfig,
  limiter: Ratelimit,
): Promise<RateLimitResult> {
  try {
    const res = await limiter.limit(clientKey);
    const nowMs = Date.now();
    return {
      ok: res.success,
      remaining: Math.max(0, res.remaining),
      limit: res.limit,
      resetAt: Math.ceil(res.reset / 1000),
      retryAfterSec: Math.max(0, Math.ceil((res.reset - nowMs) / 1000)),
      backend: "upstash",
    };
  } catch (err) {
    // Upstash error → degrade to in-memory rather than 500-ing every request.
    console.error("[rate-limit] Upstash check failed, degrading to memory:", err);
    return checkInMemory(clientKey, config);
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Best-effort client identification. Prefers the first entry in
 * `x-forwarded-for`, falls back to `x-real-ip`, then a constant.
 */
export function getClientKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

/**
 * Check and increment the rate limit for the given client + endpoint.
 * Always returns a result object — callers decide whether to short-circuit on `!ok`.
 *
 * Accepts either a `NextRequest` or an explicit client key (useful in tests).
 *
 * Always async so the Upstash backend can slot in transparently. `nowMsOverride`
 * only applies to the in-memory backend; Upstash uses real wall-clock time.
 */
export async function checkRateLimit(
  reqOrKey: NextRequest | string,
  config: RateLimitConfig,
  nowMsOverride?: number,
): Promise<RateLimitResult> {
  const clientKey =
    typeof reqOrKey === "string" ? reqOrKey : getClientKey(reqOrKey);

  const limiter = getUpstashLimiter(config);
  if (limiter) {
    return checkUpstash(`${config.name}:${clientKey}`, config, limiter);
  }

  return checkInMemory(clientKey, config, nowMsOverride);
}

/** Headers to attach to successful responses so clients can self-throttle. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
    "X-RateLimit-Backend": result.backend,
  };
}

/** Build a standard 429 response when a request is rejected. */
export function rateLimitResponse(
  result: RateLimitResult,
  message = "Too many requests",
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code: "RATE_LIMITED",
      message,
      details: {
        limit: result.limit,
        remaining: result.remaining,
        retryAfterSec: result.retryAfterSec,
      },
    },
  };
  return NextResponse.json(body, {
    status: 429,
    headers: {
      ...rateLimitHeaders(result),
      "Retry-After": String(result.retryAfterSec),
    },
  });
}

// ─── Default configs for public endpoints ──────────────────────────────────

const WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

export const TIER1_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Tier-1 discovery + search (step 1-2)
  properties: { name: "properties", windowMs: WINDOW_MS, max: DEFAULT_MAX },
  "map-points": { name: "map-points", windowMs: WINDOW_MS, max: DEFAULT_MAX },
  "filter-options": { name: "filter-options", windowMs: WINDOW_MS, max: DEFAULT_MAX },
  "ai-search": { name: "ai-search", windowMs: WINDOW_MS, max: DEFAULT_MAX },

  // Step-4 additions — tuned per workload
  /** Lead capture is abuse-prone, cap it tight. */
  leads: { name: "leads", windowMs: WINDOW_MS, max: 10 },
  /** Valuation hits paid external APIs (RealVisor/Valuo), cap strictly. */
  "valuation-estimate": { name: "valuation-estimate", windowMs: WINDOW_MS, max: 30 },
  /** Status polling is expected to be frequent. */
  "valuation-status": { name: "valuation-status", windowMs: WINDOW_MS, max: 300 },
  /** Analytics tracking is high volume — allow bursts. */
  "analytics-track": { name: "analytics-track", windowMs: WINDOW_MS, max: 2000 },
  /** Broker analytics dashboard auto-refreshes. */
  "broker-analytics": { name: "broker-analytics", windowMs: WINDOW_MS, max: 120 },
  /**
   * Broker PII contact endpoint. Strict per-IP cap (10/min) is the primary
   * anti-harvesting defense; with an API key, callers get the per-key
   * ceiling from `api_keys.rate_limit_per_min` instead.
   */
  "broker-contact": { name: "broker-contact", windowMs: WINDOW_MS, max: 10 },
};
