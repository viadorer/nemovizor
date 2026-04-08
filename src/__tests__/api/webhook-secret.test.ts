import { describe, expect, it } from "vitest";
import {
  __testKeyFromPassphrase,
  WEBHOOK_SECRET_PREFIX,
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSecret,
  prefixWebhookSecret,
} from "@/lib/api/webhooks/secret";

const KEY = __testKeyFromPassphrase("unit-test-passphrase");

describe("generateWebhookSecret", () => {
  it("returns nws_-prefixed string of 36 chars total", () => {
    const s = generateWebhookSecret();
    expect(s.startsWith(WEBHOOK_SECRET_PREFIX)).toBe(true);
    expect(s.length).toBe(WEBHOOK_SECRET_PREFIX.length + 32);
  });

  it("100 draws are all unique", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateWebhookSecret());
    expect(set.size).toBe(100);
  });

  it("uses base64url charset (no +/=)", () => {
    const s = generateWebhookSecret().slice(WEBHOOK_SECRET_PREFIX.length);
    expect(s).not.toMatch(/[+/=]/);
  });
});

describe("prefixWebhookSecret", () => {
  it("returns first 8 chars including prefix", () => {
    const s = generateWebhookSecret();
    expect(prefixWebhookSecret(s)).toBe(s.slice(0, 8));
    expect(prefixWebhookSecret(s)).toMatch(/^nws_/);
  });
});

describe("encryptWebhookSecret / decryptWebhookSecret", () => {
  it("round-trips a plain secret", () => {
    const plain = generateWebhookSecret();
    const ct = encryptWebhookSecret(plain, KEY);
    const back = decryptWebhookSecret(ct, KEY);
    expect(back).toBe(plain);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const plain = "nws_static_value_for_test";
    const a = encryptWebhookSecret(plain, KEY);
    const b = encryptWebhookSecret(plain, KEY);
    expect(a).not.toBe(b);
    expect(decryptWebhookSecret(a, KEY)).toBe(plain);
    expect(decryptWebhookSecret(b, KEY)).toBe(plain);
  });

  it("ciphertext format is v1:iv:ct:tag", () => {
    const ct = encryptWebhookSecret("test", KEY);
    const parts = ct.split(":");
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe("v1");
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    expect(parts[3]).toMatch(/^[0-9a-f]+$/);
  });

  it("decryption fails on tampered ciphertext", () => {
    const plain = "nws_test";
    const ct = encryptWebhookSecret(plain, KEY);
    const parts = ct.split(":");
    // Flip a hex char in the ciphertext part
    parts[2] = parts[2].replace(/^./, (c) => (c === "0" ? "1" : "0"));
    const tampered = parts.join(":");
    expect(() => decryptWebhookSecret(tampered, KEY)).toThrow();
  });

  it("decryption fails on wrong key", () => {
    const plain = "nws_test";
    const ct = encryptWebhookSecret(plain, KEY);
    const otherKey = __testKeyFromPassphrase("different");
    expect(() => decryptWebhookSecret(ct, otherKey)).toThrow();
  });

  it("rejects malformed ciphertext format", () => {
    expect(() => decryptWebhookSecret("not-a-valid-format", KEY)).toThrow();
    expect(() => decryptWebhookSecret("v2:foo:bar:baz", KEY)).toThrow();
    expect(() => decryptWebhookSecret("", KEY)).toThrow();
  });
});
