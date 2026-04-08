/**
 * Webhook secret management.
 *
 * Webhook signing secrets follow a different lifecycle from API keys:
 *
 *   • API keys are tokens we receive on every request — we hash them on
 *     creation and verify by re-hashing the inbound value (one-way).
 *
 *   • Webhook secrets are tokens WE use to sign every outbound delivery
 *     so the receiver can verify it. We need the plain secret available
 *     to the dispatcher every time it sends a request, so a one-way hash
 *     is not enough — we have to be able to recover the plain value.
 *
 * The solution is reversible AES-256-GCM encryption with the project key
 * stored in `WEBHOOK_SECRET_ENCRYPTION_KEY` (32 raw bytes, hex- or
 * base64-encoded). The DB stores only the ciphertext + IV + auth tag in
 * the `secret_ciphertext` column, never the plain secret. The plain secret
 * is returned to the API caller exactly once on creation; thereafter, only
 * the dispatcher (running with the service role) can decrypt it.
 *
 * Format of the stored ciphertext: `v1:<iv_hex>:<ciphertext_hex>:<tag_hex>`
 * The "v1" prefix lets us rotate the encryption scheme later without losing
 * old subscriptions.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

export const WEBHOOK_SECRET_PREFIX = "nws_";
const RAW_BODY_LENGTH = 32; // base64url chars after the prefix
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const KEY_LENGTH = 32; // AES-256

// ─── Plain secret generation ───────────────────────────────────────────────

/** Generate a fresh raw webhook secret. Returned exactly once to the caller. */
export function generateWebhookSecret(): string {
  const body = randomBytes(24).toString("base64url").slice(0, RAW_BODY_LENGTH);
  return `${WEBHOOK_SECRET_PREFIX}${body}`;
}

/** First 8 chars of the raw secret, for UI display only (e.g. "nws_aBc1"). */
export function prefixWebhookSecret(raw: string): string {
  return raw.slice(0, 8);
}

// ─── Encryption key resolution ─────────────────────────────────────────────

/**
 * Load the symmetric encryption key from `WEBHOOK_SECRET_ENCRYPTION_KEY`.
 * Accepts either 64 hex chars or base64-encoded 32 bytes. Throws when the
 * env var is missing or malformed — by design, since misconfiguring this
 * would silently corrupt every stored secret.
 */
export function loadEncryptionKey(): Buffer {
  const raw = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "WEBHOOK_SECRET_ENCRYPTION_KEY env var is required for webhook secret crypto",
    );
  }
  // Try hex first, then base64.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length === KEY_LENGTH) return buf;
  throw new Error(
    `WEBHOOK_SECRET_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${buf.length})`,
  );
}

// ─── Encrypt / decrypt ─────────────────────────────────────────────────────

/**
 * Encrypt a plain webhook secret to the storage format. Uses a fresh random
 * IV per call so two encryptions of the same plaintext produce different
 * ciphertexts (semantic security).
 */
export function encryptWebhookSecret(plain: string, key?: Buffer): string {
  const k = key ?? loadEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * Decrypt a stored ciphertext back to the plain secret. Throws if the
 * format is unrecognised or the auth tag fails to verify (= tampering).
 */
export function decryptWebhookSecret(stored: string, key?: Buffer): string {
  const k = key ?? loadEncryptionKey();
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error(`Unrecognised webhook secret format: ${parts[0] ?? "(empty)"}`);
  }
  const iv = Buffer.from(parts[1], "hex");
  const ct = Buffer.from(parts[2], "hex");
  const tag = Buffer.from(parts[3], "hex");
  const decipher = createDecipheriv(ALGO, k, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}

// ─── Test helper: build a deterministic key from a passphrase ─────────────

/**
 * Test-only helper to derive a 32-byte key from a passphrase. Real
 * deployments must set WEBHOOK_SECRET_ENCRYPTION_KEY to a random 32-byte
 * hex/base64 value. This function exists so unit tests can avoid touching
 * the env var.
 */
export function __testKeyFromPassphrase(passphrase: string): Buffer {
  // Derive deterministically by hashing — sufficient for tests, NOT for prod.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(passphrase, "utf8").digest();
}
