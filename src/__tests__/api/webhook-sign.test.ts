import { describe, expect, it } from "vitest";
import {
  computeHmacHex,
  signWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/api/webhooks/sign";

const SECRET = "nws_unit_test_secret_value_xx";

describe("computeHmacHex", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeHmacHex("hello", SECRET);
    const b = computeHmacHex("hello", SECRET);
    expect(a).toBe(b);
  });

  it("matches the expected RFC test pattern (returns 64 hex chars)", () => {
    const h = computeHmacHex("hello world", SECRET);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when payload changes by one byte", () => {
    expect(computeHmacHex("a", SECRET)).not.toBe(computeHmacHex("b", SECRET));
  });

  it("differs when secret changes", () => {
    expect(computeHmacHex("x", "secret-A")).not.toBe(computeHmacHex("x", "secret-B"));
  });
});

describe("signWebhookPayload", () => {
  it("prefixes the digest with 'sha256='", () => {
    const sig = signWebhookPayload("test", SECRET);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(sig.length).toBe("sha256=".length + 64);
  });
});

describe("verifyWebhookSignature", () => {
  it("round-trips a freshly signed payload", () => {
    const payload = JSON.stringify({ id: 1, foo: "bar" });
    const sig = signWebhookPayload(payload, SECRET);
    expect(verifyWebhookSignature(payload, sig, SECRET)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const payload = JSON.stringify({ price: 1000000 });
    const sig = signWebhookPayload(payload, SECRET);
    const tampered = JSON.stringify({ price: 1 });
    expect(verifyWebhookSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const payload = "test";
    const sig = signWebhookPayload(payload, SECRET);
    const broken = sig.slice(0, -2) + (sig.endsWith("00") ? "ff" : "00");
    expect(verifyWebhookSignature(payload, broken, SECRET)).toBe(false);
  });

  it("rejects a signature without the sha256= prefix", () => {
    const payload = "x";
    const hex = computeHmacHex(payload, SECRET);
    expect(verifyWebhookSignature(payload, hex, SECRET)).toBe(false);
  });

  it("rejects an empty / non-string header value", () => {
    expect(verifyWebhookSignature("payload", "", SECRET)).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(verifyWebhookSignature("payload", null, SECRET)).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(verifyWebhookSignature("payload", 123, SECRET)).toBe(false);
  });

  it("rejects a signature with the wrong secret", () => {
    const payload = "x";
    const sig = signWebhookPayload(payload, SECRET);
    expect(verifyWebhookSignature(payload, sig, "different-secret")).toBe(false);
  });

  it("does not throw on garbage hex (returns false)", () => {
    const payload = "x";
    const sig = "sha256=zzzz_not_hex_at_all_g";
    expect(() => verifyWebhookSignature(payload, sig, SECRET)).not.toThrow();
    expect(verifyWebhookSignature(payload, sig, SECRET)).toBe(false);
  });
});
