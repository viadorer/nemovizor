/**
 * Recursive snake_case ⇄ camelCase key transformers.
 *
 * Used by the `/api/v1/*` proxy layer:
 *   - incoming query params & request body: camelCase → snake_case (so the
 *     underlying `/api/*` handler keeps seeing its native shape)
 *   - outgoing response body: snake_case → camelCase (so v1 consumers get a
 *     consistent camelCase world)
 *
 * The transforms only rewrite OBJECT KEYS. Values (including string values
 * that happen to look like snake_case, e.g. "czk" or "2026-04-06") are left
 * untouched. Arrays are traversed element-wise. Non-plain objects like
 * `Date`, `Buffer`, or class instances are returned as-is.
 */

/** `listing_type` → `listingType`. Idempotent for already-camelCase keys. */
export function toCamelKey(key: string): string {
  return key.replace(/_+([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/** `listingType` → `listing_type`. Idempotent for already-snake_case keys. */
export function toSnakeKey(key: string): string {
  return key.replace(/([A-Z])/g, (_match, char: string) => `_${char.toLowerCase()}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
}

/** Deep transform of every object key using `toCamelKey`. */
export function toCamelCase<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((v) => toCamelCase(v)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[toCamelKey(k)] = toCamelCase(v);
    }
    return out as T;
  }
  return input as T;
}

/** Deep transform of every object key using `toSnakeKey`. */
export function toSnakeCase<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((v) => toSnakeCase(v)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[toSnakeKey(k)] = toSnakeCase(v);
    }
    return out as T;
  }
  return input as T;
}
