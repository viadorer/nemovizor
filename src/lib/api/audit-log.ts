/**
 * Per-request audit log for the public API surface.
 *
 * Every tier-1/2 route handler creates an "audit tap" via
 * `createAuditTap(...)` and wraps every return value through it. The tap is
 * fire-and-forget — it inserts the audit row in the background and returns
 * the response unchanged, so request latency is not affected.
 *
 * Privacy:
 *   • API-key callers → full attribution via `api_key_id`.
 *   • Anonymous callers → SHA-256(IP + daily salt). The daily salt rotates
 *     at 00:00 UTC, so the same IP on day N+1 hashes differently. We can
 *     count "distinct callers per day" without ever storing a stable,
 *     re-identifiable IP.
 *
 * Backend: writes through `supabaseAdmin` (service role, bypasses RLS).
 * If the client is unavailable (e.g. local dev without service-role key),
 * logging is silently skipped.
 */
import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { AuthContext } from "./auth-context";

export interface AuditLogEntry {
  authCtx: AuthContext;
  endpoint: string;
  method: string;
  status: number;
  latencyMs: number;
}

export interface AuditTapOptions {
  /** Logical route pattern, e.g. "/api/v1/properties/{id}". */
  endpoint: string;
  /** HTTP method. */
  method: string;
  /** AuthContext from `resolveAuthContext()`. */
  authCtx: AuthContext;
  /** Wall-clock timestamp at handler entry (Date.now()). */
  startedAt: number;
}

/**
 * Daily-rotating salt mixed into anonymous-IP hashes. Sourced from
 * `AUDIT_LOG_DAILY_SALT` env var; if unset, falls back to a constant
 * (still better than raw IP — adds defence in depth against rainbow
 * tables — but rotate the env var if you want true daily separation).
 */
function dailySalt(now: Date = new Date()): string {
  const baseSalt = process.env.AUDIT_LOG_DAILY_SALT || "nemovizor-audit-default";
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return `${baseSalt}|${day}`;
}

/**
 * Hash an IP with the current daily salt. Returns a 64-char hex digest.
 * Exported for tests.
 */
export function hashClientIp(ip: string, now: Date = new Date()): string {
  return createHash("sha256")
    .update(ip + "|" + dailySalt(now), "utf8")
    .digest("hex");
}

/**
 * Fire-and-forget per-request audit log write. Does NOT throw under any
 * circumstance: logging failures are swallowed and reported via
 * `console.error` only.
 */
export function logRequest(entry: AuditLogEntry): void {
  const client = supabaseAdmin;
  if (!client) return; // No service role → silently skip.

  const isApiKey = entry.authCtx.kind === "apiKey";
  const apiKeyId = isApiKey ? entry.authCtx.apiKey?.id ?? null : null;
  // For anonymous callers, `rateLimitClientKey` is the source IP returned by
  // `getClientKey()`. For API-key callers we already have full attribution
  // via `api_key_id` so we don't store the hash.
  const clientHash = isApiKey ? null : hashClientIp(entry.authCtx.rateLimitClientKey);

  const row = {
    api_key_id: apiKeyId,
    client_hash: clientHash,
    endpoint: entry.endpoint,
    method: entry.method,
    status: entry.status,
    latency_ms: Math.max(0, Math.round(entry.latencyMs)),
  };

  // The api_request_log table is intentionally not part of the generated
  // Supabase types, so cast through any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  void c
    .from("api_request_log")
    .insert(row)
    .then((res: { error?: { message: string } | null }) => {
      if (res?.error) {
        console.error("[audit-log] insert failed:", res.error.message);
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .catch?.((err: any) => {
      console.error("[audit-log] insert threw:", err?.message ?? err);
    });
}

/**
 * Build an audit "tap" function. Wrap every return from a route handler
 * through it: `return tap(NextResponse.json(...))`. The tap inserts an
 * audit row in the background and returns the response unchanged.
 */
export function createAuditTap(opts: AuditTapOptions) {
  return function tap<R extends Response | NextResponse>(res: R): R {
    logRequest({
      authCtx: opts.authCtx,
      endpoint: opts.endpoint,
      method: opts.method,
      status: res.status,
      latencyMs: Date.now() - opts.startedAt,
    });
    return res;
  };
}
