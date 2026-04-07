import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetBuckets,
  checkRateLimit,
  getClientKey,
  rateLimitResponse,
  TIER1_RATE_LIMITS,
} from "@/lib/api/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => __resetBuckets());

  it("allows requests up to the configured max and then blocks", async () => {
    const cfg = { name: "test", windowMs: 60_000, max: 3 };
    const t0 = 1_000_000;

    const r1 = await checkRateLimit("1.1.1.1", cfg, t0);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.backend).toBe("memory");

    const r2 = await checkRateLimit("1.1.1.1", cfg, t0 + 100);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit("1.1.1.1", cfg, t0 + 200);
    expect(r3.ok).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = await checkRateLimit("1.1.1.1", cfg, t0 + 300);
    expect(r4.ok).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSec).toBeGreaterThanOrEqual(0);
  });

  it("isolates clients by key", async () => {
    const cfg = { name: "test", windowMs: 60_000, max: 1 };
    const t0 = 2_000_000;

    expect((await checkRateLimit("a", cfg, t0)).ok).toBe(true);
    expect((await checkRateLimit("b", cfg, t0)).ok).toBe(true);
    expect((await checkRateLimit("a", cfg, t0 + 10)).ok).toBe(false);
    expect((await checkRateLimit("b", cfg, t0 + 10)).ok).toBe(false);
  });

  it("isolates buckets by config name", async () => {
    const t0 = 3_000_000;
    const cfgA = { name: "endpointA", windowMs: 60_000, max: 1 };
    const cfgB = { name: "endpointB", windowMs: 60_000, max: 1 };

    expect((await checkRateLimit("x", cfgA, t0)).ok).toBe(true);
    // Same client, different endpoint → fresh bucket
    expect((await checkRateLimit("x", cfgB, t0 + 10)).ok).toBe(true);
    // Both are now at their max
    expect((await checkRateLimit("x", cfgA, t0 + 20)).ok).toBe(false);
    expect((await checkRateLimit("x", cfgB, t0 + 30)).ok).toBe(false);
  });

  it("resets after the window elapses", async () => {
    const cfg = { name: "test", windowMs: 1000, max: 1 };
    const t0 = 4_000_000;

    expect((await checkRateLimit("c", cfg, t0)).ok).toBe(true);
    expect((await checkRateLimit("c", cfg, t0 + 500)).ok).toBe(false);
    // After the window expires
    expect((await checkRateLimit("c", cfg, t0 + 1500)).ok).toBe(true);
  });

  it("getClientKey reads x-forwarded-for first entry", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "9.9.9.9, 10.10.10.10" },
    });
    expect(getClientKey(req as unknown as Parameters<typeof getClientKey>[0])).toBe("9.9.9.9");
  });

  it("getClientKey falls back to x-real-ip, then 'unknown'", () => {
    const req1 = new Request("https://example.com", { headers: { "x-real-ip": "8.8.8.8" } });
    expect(getClientKey(req1 as unknown as Parameters<typeof getClientKey>[0])).toBe("8.8.8.8");

    const req2 = new Request("https://example.com");
    expect(getClientKey(req2 as unknown as Parameters<typeof getClientKey>[0])).toBe("unknown");
  });

  it("rateLimitResponse returns a 429 with Retry-After and RATE_LIMITED code", async () => {
    const cfg = { name: "rl", windowMs: 1000, max: 1 };
    await checkRateLimit("z", cfg, 5_000_000);
    const blocked = await checkRateLimit("z", cfg, 5_000_000);
    expect(blocked.ok).toBe(false);

    const res = rateLimitResponse(blocked);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("X-RateLimit-Backend")).toBe("memory");
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("TIER1_RATE_LIMITS covers all tier-1 endpoints", () => {
    expect(TIER1_RATE_LIMITS.properties.max).toBeGreaterThan(0);
    expect(TIER1_RATE_LIMITS["map-points"].max).toBeGreaterThan(0);
    expect(TIER1_RATE_LIMITS["filter-options"].max).toBeGreaterThan(0);
    expect(TIER1_RATE_LIMITS["ai-search"].max).toBeGreaterThan(0);
  });

  it("falls back to in-memory when Upstash env vars are unset", async () => {
    const prev = {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    try {
      const cfg = { name: "fallback-test", windowMs: 1000, max: 1 };
      const r = await checkRateLimit("y", cfg, 6_000_000);
      expect(r.backend).toBe("memory");
    } finally {
      if (prev.url) process.env.UPSTASH_REDIS_REST_URL = prev.url;
      if (prev.token) process.env.UPSTASH_REDIS_REST_TOKEN = prev.token;
    }
  });
});
