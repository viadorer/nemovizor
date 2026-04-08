/**
 * Shared types for the webhook subsystem.
 */

export const WEBHOOK_EVENT_TYPES = [
  "property.created",
  "property.updated",
  "property.deleted",
  "property.price_changed",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function isKnownEventType(s: string): s is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(s);
}

/**
 * JSON filter applied per subscription. All fields are AND-combined.
 * Array fields match if at least one value matches (OR within the array).
 */
export interface WebhookFilter {
  category?: string[];
  subtype?: string[];
  city?: string;
  country?: string[];
  listing_type?: string;
  price_min?: number;
  price_max?: number;
  area_min?: number;
  area_max?: number;
  broker_id?: string;
}

/** Public-facing subscription DTO. Never includes the plain secret. */
export interface WebhookSubscriptionDto {
  id: string;
  url: string;
  secret_prefix: string;
  event_types: WebhookEventType[];
  filter: WebhookFilter | null;
  active: boolean;
  failure_count: number;
  disabled_at: string | null;
  last_delivered_at: string | null;
  created_at: string;
}

/** Outbox row as it lives in the DB. */
export interface WebhookOutboxRow {
  id: string;
  event_type: string;
  property_id: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "delivering" | "delivered" | "failed";
  attempt: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
}

/** Subscription row as it lives in the DB. */
export interface WebhookSubscriptionRow {
  id: string;
  owner_type: "broker" | "agency" | "admin";
  owner_id: string;
  url: string;
  secret_ciphertext: string;
  secret_prefix: string;
  event_types: WebhookEventType[];
  filter: WebhookFilter | null;
  active: boolean;
  failure_count: number;
  disabled_at: string | null;
  last_delivered_at: string | null;
  created_at: string;
}

/** Outbound payload structure POSTed to subscriber URLs. */
export interface WebhookDeliveryPayload {
  /** Stable delivery id (matches webhook_deliveries.id, also in X-Nemovizor-Webhook-Id header). */
  id: string;
  /** Event type. */
  type: WebhookEventType;
  /** Unix seconds when the originating mutation happened. */
  occurred_at: number;
  /** Event-specific data, mirrors webhook_outbox.payload. */
  data: Record<string, unknown>;
}
