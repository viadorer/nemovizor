import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCOPES,
  KNOWN_SCOPES,
  hasScope,
  isKnownScope,
  type ApiKeyRecord,
} from "@/lib/api/api-key";
import { requireScope } from "@/lib/api/auth-context";

const baseRecord: ApiKeyRecord = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "test",
  ownerType: "broker",
  ownerId: "00000000-0000-0000-0000-000000000002",
  scopes: ["read:public"],
  rateLimitPerMin: 300,
  expiresAt: null,
  revokedAt: null,
};

describe("KNOWN_SCOPES", () => {
  it("contains the canonical 5 scopes", () => {
    expect(KNOWN_SCOPES).toContain("read:public");
    expect(KNOWN_SCOPES).toContain("read:broker");
    expect(KNOWN_SCOPES).toContain("write:broker");
    expect(KNOWN_SCOPES).toContain("read:admin");
    expect(KNOWN_SCOPES).toContain("write:webhooks");
    expect(KNOWN_SCOPES.length).toBe(5);
  });

  it("DEFAULT_SCOPES contains read:public", () => {
    expect(DEFAULT_SCOPES).toEqual(["read:public"]);
  });

  it("isKnownScope narrows correctly", () => {
    expect(isKnownScope("read:public")).toBe(true);
    expect(isKnownScope("write:broker")).toBe(true);
    expect(isKnownScope("admin:everything")).toBe(false);
    expect(isKnownScope("")).toBe(false);
  });
});

describe("hasScope", () => {
  it("read:public is implicit (granted to every key)", () => {
    expect(hasScope({ ...baseRecord, scopes: [] }, "read:public")).toBe(true);
    expect(hasScope({ ...baseRecord, scopes: ["write:broker"] }, "read:public")).toBe(true);
  });

  it("returns true when explicit scope is present", () => {
    expect(hasScope({ ...baseRecord, scopes: ["write:broker"] }, "write:broker")).toBe(true);
  });

  it("returns false when scope is missing", () => {
    expect(hasScope({ ...baseRecord, scopes: ["read:public"] }, "write:broker")).toBe(false);
  });
});

describe("requireScope", () => {
  it("returns null for read:public regardless of caller", () => {
    const anonCtx = {
      kind: "anonymous" as const,
      rateLimitClientKey: "1.2.3.4",
      rateLimitConfig: { name: "test", windowMs: 60_000, max: 60 },
      apiKey: null,
    };
    expect(requireScope(anonCtx, "read:public")).toBeNull();
  });

  it("returns 401 for anonymous caller on a non-public scope", async () => {
    const anonCtx = {
      kind: "anonymous" as const,
      rateLimitClientKey: "1.2.3.4",
      rateLimitConfig: { name: "test", windowMs: 60_000, max: 60 },
      apiKey: null,
    };
    const res = requireScope(anonCtx, "write:broker");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
    const body = await res!.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when API key lacks the required scope", async () => {
    const apiCtx = {
      kind: "apiKey" as const,
      rateLimitClientKey: "apikey:abc",
      rateLimitConfig: { name: "test", windowMs: 60_000, max: 300 },
      apiKey: { ...baseRecord, scopes: ["read:public"] },
    };
    const res = requireScope(apiCtx, "write:broker");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    const body = await res!.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns null when API key has the required scope", () => {
    const apiCtx = {
      kind: "apiKey" as const,
      rateLimitClientKey: "apikey:abc",
      rateLimitConfig: { name: "test", windowMs: 60_000, max: 300 },
      apiKey: { ...baseRecord, scopes: ["read:public", "write:broker"] },
    };
    expect(requireScope(apiCtx, "write:broker")).toBeNull();
  });
});
