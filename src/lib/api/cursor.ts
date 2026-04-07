/**
 * Opaque base64url cursors for stable list pagination.
 *
 * Cursors encode `(created_at, id)` so that pagination is stable even when
 * rows are inserted or deleted during iteration. The pair is sufficient
 * because `id` is a UUID (unique tiebreaker) and `created_at` provides the
 * ordering axis when `ORDER BY created_at DESC, id DESC` is enforced.
 *
 * Format:
 *   base64url(JSON({ c: "<ISO8601 created_at>", i: "<uuid>" }))
 *
 * The cursor is opaque to clients — they should treat it as an arbitrary
 * string and only pass it back unchanged.
 */

export interface CursorPayload {
  /** ISO 8601 timestamp of the row's created_at column. */
  createdAt: string;
  /** UUID of the row. */
  id: string;
}

interface RawCursor {
  c: string;
  i: string;
}

function isValidIso(s: string): boolean {
  if (typeof s !== "string" || s.length < 10) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function isValidUuid(s: string): boolean {
  return typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
}

function base64urlEncode(input: string): string {
  // Buffer is available in Node + Next.js edge / serverless runtimes.
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function base64urlDecode(input: string): string {
  // Pad back to a multiple of 4 before decoding.
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, "base64").toString("utf8");
}

/** Encode a cursor payload to an opaque base64url string. */
export function encodeCursor(payload: CursorPayload): string {
  if (!isValidIso(payload.createdAt)) {
    throw new Error(`encodeCursor: invalid createdAt "${payload.createdAt}"`);
  }
  if (!isValidUuid(payload.id)) {
    throw new Error(`encodeCursor: invalid id "${payload.id}"`);
  }
  const raw: RawCursor = { c: payload.createdAt, i: payload.id };
  return base64urlEncode(JSON.stringify(raw));
}

/**
 * Decode an opaque cursor string back to its payload. Returns `null` for any
 * malformed input — caller should treat null the same as "no cursor".
 */
export function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor || typeof cursor !== "string") return null;
  let json: string;
  try {
    json = base64urlDecode(cursor);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as RawCursor).c !== "string" ||
    typeof (parsed as RawCursor).i !== "string"
  ) {
    return null;
  }
  const raw = parsed as RawCursor;
  if (!isValidIso(raw.c) || !isValidUuid(raw.i)) return null;
  return { createdAt: raw.c, id: raw.i };
}
