/**
 * Webhook subscription filter evaluator.
 *
 * A subscription's `filter` is a JSON object describing constraints that
 * the event payload must satisfy. Filters are evaluated by the dispatcher
 * (not the trigger) so we can keep all routing logic in TypeScript and out
 * of plpgsql.
 *
 * Semantics:
 *   • All top-level keys in the filter are AND-combined.
 *   • Array filter values are OR-combined within the array.
 *   • Numeric `_min` / `_max` keys define inclusive range constraints.
 *   • Missing payload fields → the filter fails (we don't match unknowns).
 *   • An empty / null / undefined filter matches everything.
 *
 * Example:
 *   filter = { category: ["apartment","house"], country: ["cz","sk"], price_max: 10000000 }
 *   payload = { category: "apartment", country: "cz", price: 8500000, ... }
 *   → matches
 */
import type { WebhookFilter } from "./types";

type Payload = Record<string, unknown>;

function inRange(value: number | null | undefined, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true;
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

function valueIn(value: unknown, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (typeof value !== "string") return false;
  return allowed.includes(value);
}

/**
 * Returns true when the payload matches the filter, false otherwise.
 * A null/undefined filter always returns true.
 */
export function matchesFilter(payload: Payload, filter: WebhookFilter | null | undefined): boolean {
  if (!filter) return true;

  if (!valueIn(payload.category, filter.category)) return false;
  if (!valueIn(payload.subtype, filter.subtype)) return false;
  if (!valueIn(payload.country, filter.country)) return false;

  if (filter.listing_type !== undefined) {
    if (payload.listing_type !== filter.listing_type) return false;
  }

  if (filter.city !== undefined) {
    if (payload.city !== filter.city) return false;
  }

  if (filter.broker_id !== undefined) {
    if (payload.broker_id !== filter.broker_id) return false;
  }

  if (!inRange(payload.price as number | null | undefined, filter.price_min, filter.price_max)) {
    return false;
  }
  if (!inRange(payload.area as number | null | undefined, filter.area_min, filter.area_max)) {
    return false;
  }

  return true;
}
