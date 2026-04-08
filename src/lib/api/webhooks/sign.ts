/**
 * HMAC-SHA256 signing for outbound webhook deliveries.
 *
 * Wire format follows the Stripe / GitHub convention:
 *
 *   Header: X-Nemovizor-Signature: sha256=<hex>
 *
 * Where `<hex>` is HMAC-SHA256 of the **exact raw body bytes** keyed with
 * the subscription's plain secret. Receivers verify by recomputing the
 * digest from the body they received and comparing in constant time.
 *
 * Important: callers MUST sign the same byte string they will send. This
 * helper accepts a string and assumes UTF-8 — for JSON payloads pass the
 * stringified body to both `signWebhookPayload` and `fetch`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SIG_PREFIX = "sha256=";

/** Compute the HMAC-SHA256 hex digest for a payload. */
export function computeHmacHex(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Build the value of the X-Nemovizor-Signature header. */
export function signWebhookPayload(payload: string, secret: string): string {
  return SIG_PREFIX + computeHmacHex(payload, secret);
}

/**
 * Constant-time verification. Returns false on length mismatch instead of
 * letting `timingSafeEqual` throw.
 */
export function verifyWebhookSignature(
  payload: string,
  headerValue: string,
  secret: string,
): boolean {
  if (typeof headerValue !== "string" || !headerValue.startsWith(SIG_PREFIX)) {
    return false;
  }
  const provided = headerValue.slice(SIG_PREFIX.length);
  const expected = computeHmacHex(payload, secret);
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
