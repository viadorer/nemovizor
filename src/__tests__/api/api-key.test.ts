import { describe, expect, it } from "vitest";
import {
  API_KEY_PREFIX,
  extractBearerToken,
  generateApiKey,
  hashApiKey,
  prefixApiKey,
} from "@/lib/api/api-key";

describe("api-key", () => {
  it("generateApiKey produces a nvz_-prefixed 36-char key", () => {
    const key = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.length).toBe(API_KEY_PREFIX.length + 32);
  });

  it("generateApiKey is random (100 draws, all unique)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateApiKey());
    expect(set.size).toBe(100);
  });

  it("hashApiKey is deterministic and 64 hex chars", () => {
    const a = hashApiKey("nvz_foo");
    const b = hashApiKey("nvz_foo");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashApiKey differs for different inputs", () => {
    expect(hashApiKey("nvz_a")).not.toBe(hashApiKey("nvz_b"));
  });

  it("prefixApiKey returns the first 8 chars", () => {
    const key = generateApiKey();
    expect(prefixApiKey(key)).toBe(key.slice(0, 8));
    expect(prefixApiKey(key)).toMatch(/^nvz_/);
  });

  it("extractBearerToken reads Authorization: Bearer", () => {
    const req = new Request("https://example.com", {
      headers: { authorization: "Bearer nvz_testtoken" },
    });
    expect(extractBearerToken(req)).toBe("nvz_testtoken");
  });

  it("extractBearerToken reads X-API-Key when no Authorization header", () => {
    const req = new Request("https://example.com", {
      headers: { "x-api-key": "nvz_alt" },
    });
    expect(extractBearerToken(req)).toBe("nvz_alt");
  });

  it("extractBearerToken returns null when absent", () => {
    const req = new Request("https://example.com");
    expect(extractBearerToken(req)).toBeNull();
  });

  it("extractBearerToken is case-insensitive on 'Bearer'", () => {
    const req = new Request("https://example.com", {
      headers: { authorization: "bearer nvz_lc" },
    });
    expect(extractBearerToken(req)).toBe("nvz_lc");
  });
});
