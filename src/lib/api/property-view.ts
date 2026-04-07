/**
 * Field filtering helpers for public property responses.
 *
 * Two filter modes exist because we run two parallel API surfaces:
 *
 *   1. **legacyPropertyView** — applied to `/api/*` (snake_case). Removes only
 *      broker PII (phone, email). Keeps every business field intact so the
 *      Nemovizor frontend (which calls /api/properties) is not regressed.
 *
 *   2. **v1PropertyView** — applied to `/api/v1/*` (camelCase). Removes broker
 *      PII AND business-sensitive fields (commission, mortgage_percent, etc.)
 *      so external clients can never harvest competitive intelligence.
 *
 * Reasoning: GDPR / spam-harvesting risk on broker phone+email is high enough
 * that we accept the small frontend regression (listing cards lose the
 * "click to call" link; detail page is unaffected because it goes through
 * server-side Supabase, not the public API). Business field exposure is a
 * lesser concern (commission is often 3-5% standard) so we keep it on legacy
 * for compatibility and only strip it from the recommended v1 surface.
 *
 * Brokers may explicitly retrieve a single broker's contact info via
 * `GET /api/v1/brokers/{id}/contact`, which has its own strict per-IP rate
 * limit (anti-harvesting).
 */

/** Broker fields that must NEVER appear in any public listing response. */
export const BROKER_PII_FIELDS = ["phone", "email", "personal_email"] as const;

/** Property fields that must NEVER appear in /api/v1/* responses. */
export const PROPERTY_BUSINESS_FIELDS = [
  "commission",
  "mortgage_percent",
  "spor_percent",
  "annuity",
  "cost_of_living",
  "refundable_deposit",
  "created_by",
] as const;

/** Whitelist of broker fields that ARE safe to expose. */
const PUBLIC_BROKER_FIELDS = [
  "id",
  "name",
  "slug",
  "photo",
  "agency_name",
  "rating",
  "bio",
  "active_listings",
  "specialization",
] as const;

type Row = Record<string, unknown>;

function isObject(v: unknown): v is Row {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Strip a nested broker object down to public-safe fields. Always removes
 * `phone`, `email`, and any other PII. Returns `null` if input is null.
 */
export function publicBrokerSummary(broker: unknown): Row | null {
  if (broker === null || broker === undefined) return null;
  if (!isObject(broker)) return null;

  const out: Row = {};
  for (const key of PUBLIC_BROKER_FIELDS) {
    if (key in broker) out[key] = broker[key];
  }
  return out;
}

/**
 * Filter applied to /api/* (legacy) listings. Keeps every property column,
 * but rewrites the nested `brokers` object to drop PII.
 */
export function legacyPropertyView(row: Row): Row {
  const out: Row = { ...row };
  if ("brokers" in out) {
    out.brokers = publicBrokerSummary(out.brokers);
  }
  return out;
}

/**
 * Filter applied to /api/v1/* listings. Removes business-sensitive property
 * fields AND broker PII.
 */
export function v1PropertyView(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if ((PROPERTY_BUSINESS_FIELDS as readonly string[]).includes(key)) continue;
    out[key] = value;
  }
  if ("brokers" in out) {
    out.brokers = publicBrokerSummary(out.brokers);
  }
  return out;
}

/**
 * Apply the same filter as `v1PropertyView` but to a list of rows.
 * Convenience helper.
 */
export function v1PropertyViewMany(rows: Row[]): Row[] {
  return rows.map(v1PropertyView);
}

/** List variant of `legacyPropertyView`. */
export function legacyPropertyViewMany(rows: Row[]): Row[] {
  return rows.map(legacyPropertyView);
}
