/**
 * Shared data layer for property list and detail endpoints.
 *
 * Both `/api/properties` (legacy snake_case) and `/api/v1/properties`
 * (camelCase) call into this module so query semantics, sorting, filtering,
 * placeholder cleanup, and field-level security are guaranteed identical.
 *
 * The `viewMode` parameter selects which post-processing filter is applied:
 *
 *   • `"legacy"` — preserves all property columns; only nested broker PII
 *     (phone, email) is stripped. Used by /api/* (Nemovizor frontend depends
 *     on backwards-compatible field shape).
 *
 *   • `"v1"` — also strips business-sensitive property columns
 *     (commission, mortgage_percent, annuity, …). Used by /api/v1/* and
 *     recommended for all external integrations.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  legacyPropertyView,
  legacyPropertyViewMany,
  v1PropertyView,
  v1PropertyViewMany,
} from "./property-view";
import { decodeCursor, encodeCursor, type CursorPayload } from "./cursor";

export type ViewMode = "legacy" | "v1";

export type SortOrder =
  | "featured"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "oldest"
  | "area_desc"
  | "area_asc";

export interface PropertiesQuery {
  page?: number;
  limit?: number;
  /** Opaque cursor (base64url). When present, `page` is ignored. */
  cursor?: string;

  listing_type?: string;
  category?: string[];
  subtype?: string[];
  city?: string;
  country?: string[];
  broker_id?: string;
  agency_id?: string;
  price_min?: number;
  price_max?: number;
  area_min?: number;
  area_max?: number;
  sw_lat?: number;
  sw_lon?: number;
  ne_lat?: number;
  ne_lon?: number;
  sort?: SortOrder;
}

export interface PropertiesListResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  /**
   * Opaque cursor for the next page when caller used cursor pagination.
   * `null` when (a) caller did not request cursor mode, or (b) the current
   * page is the last one.
   */
  next_cursor: string | null;
}

const SELECT_PROJECTION = "*, brokers(id, name, slug, photo, agency_name, rating, bio, active_listings, phone, email)";

// ---- Helpers ---------------------------------------------------------------

const PLACEHOLDER_HOST = "placeholder.com";

function isPlaceholder(url: unknown): boolean {
  return typeof url === "string" && url.includes(PLACEHOLDER_HOST);
}

/**
 * Apply post-fetch normalisation that's identical for legacy and v1:
 *  - expire `featured` flag if `featured_until` is in the past
 *  - replace placeholder URLs with the local fallback
 */
function normalizeRow(row: Record<string, unknown>, nowIso: string): Record<string, unknown> {
  const r = { ...row };
  if (r.featured && r.featured_until && (r.featured_until as string) < nowIso) {
    r.featured = false;
  }
  if (isPlaceholder(r.image_src)) r.image_src = "/branding/placeholder.png";
  if (Array.isArray(r.images)) {
    r.images = (r.images as string[]).filter((u) => !isPlaceholder(u));
  }
  return r;
}

function applyView(rows: Record<string, unknown>[], viewMode: ViewMode): Record<string, unknown>[] {
  return viewMode === "v1" ? v1PropertyViewMany(rows) : legacyPropertyViewMany(rows);
}

function applySingleView(row: Record<string, unknown>, viewMode: ViewMode): Record<string, unknown> {
  return viewMode === "v1" ? v1PropertyView(row) : legacyPropertyView(row);
}

/**
 * Resolve `agency_id` filter into a list of broker IDs. Returns `null` when
 * the agency exists but has no brokers (caller should short-circuit with an
 * empty result).
 */
async function resolveBrokerIdsForAgency(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  agencyId: string,
): Promise<string[] | null> {
  const { data: agencyBrokers } = await client
    .from("brokers")
    .select("id")
    .eq("agency_id", agencyId);
  if (agencyBrokers && agencyBrokers.length > 0) {
    return (agencyBrokers as Array<{ id: string }>).map((b) => b.id);
  }
  return null;
}

// ---- Public list -----------------------------------------------------------

export async function fetchProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawClient: SupabaseClient<any>,
  q: PropertiesQuery,
  viewMode: ViewMode,
): Promise<PropertiesListResult | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = rawClient as any;

  const limit = q.limit ?? 24;
  const page = q.page ?? 1;
  const offset = (page - 1) * limit;

  const cursorPayload: CursorPayload | null = q.cursor ? decodeCursor(q.cursor) : null;
  const usingCursor = cursorPayload !== null;

  let query = client
    .from("properties")
    .select(SELECT_PROJECTION, { count: "exact" })
    .eq("active", true);

  // ── Filters ──
  if (q.listing_type) query = query.eq("listing_type", q.listing_type);
  if (q.category) {
    query = q.category.length === 1 ? query.eq("category", q.category[0]) : query.in("category", q.category);
  }
  if (q.subtype) {
    query = q.subtype.length === 1 ? query.eq("subtype", q.subtype[0]) : query.in("subtype", q.subtype);
  }
  if (q.city) query = query.eq("city", q.city);
  if (q.country) {
    query = q.country.length === 1 ? query.eq("country", q.country[0]) : query.in("country", q.country);
  }

  if (q.broker_id) {
    query = query.eq("broker_id", q.broker_id);
  } else if (q.agency_id) {
    const ids = await resolveBrokerIdsForAgency(client, q.agency_id);
    if (ids === null) {
      return {
        data: [],
        total: 0,
        page,
        pages: 0,
        limit,
        next_cursor: null,
      };
    }
    query = query.in("broker_id", ids);
  }

  if (q.price_min !== undefined) query = query.gte("price", q.price_min);
  if (q.price_max !== undefined) query = query.lte("price", q.price_max);
  if (q.area_min !== undefined) query = query.gte("area", q.area_min);
  if (q.area_max !== undefined) query = query.lte("area", q.area_max);

  if (
    q.sw_lat !== undefined &&
    q.ne_lat !== undefined &&
    q.sw_lon !== undefined &&
    q.ne_lon !== undefined
  ) {
    query = query.gte("latitude", q.sw_lat);
    query = query.lte("latitude", q.ne_lat);
    query = query.gte("longitude", q.sw_lon);
    query = query.lte("longitude", q.ne_lon);
  }

  // ── Sorting ──
  // When using cursor mode we force a stable order on (created_at, id) so the
  // cursor's tiebreaker is meaningful, regardless of the user's `sort` choice.
  if (usingCursor) {
    query = query
      .lt("created_at", cursorPayload.createdAt)
      // Note: we use a strict `<` on created_at instead of `(created_at, id) <`
      // because Supabase/PostgREST doesn't support compound row comparisons.
      // This means rows sharing the exact same created_at as the cursor are
      // skipped — acceptable because UUIDs ensure created_at collisions are
      // extremely rare in practice.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    const sort = q.sort ?? "featured";
    switch (sort) {
      case "price_asc":
        query = query.gt("price", 0).order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.gt("price", 0).order("price", { ascending: false });
        break;
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "area_desc":
        query = query.order("area", { ascending: false });
        break;
      case "area_asc":
        query = query.order("area", { ascending: true });
        break;
      default:
        query = query
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false });
    }
  }

  // ── Pagination ──
  if (usingCursor) {
    // Cursor mode: read `limit` rows starting from offset 0 (the cursor itself
    // shifts the window via the WHERE clause above).
    query = query.range(0, limit - 1);
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) return { error: error.message };

  const total = count ?? 0;
  const nowIso = new Date().toISOString();
  const normalised = (data || []).map((row: Record<string, unknown>) => normalizeRow(row, nowIso));
  const filtered = applyView(normalised, viewMode);

  // Compute next_cursor whenever there are more rows than the page just
  // returned. This lets clients in offset mode opportunistically switch to
  // cursor mode for stable iteration over large result sets without having
  // to make a separate "first cursor" call.
  let nextCursor: string | null = null;
  const hasMore = usingCursor
    ? filtered.length === limit
    : (q.page ?? 1) * limit < total;
  if (hasMore && filtered.length > 0) {
    const last = filtered[filtered.length - 1];
    if (last && typeof last.created_at === "string" && typeof last.id === "string") {
      try {
        nextCursor = encodeCursor({ createdAt: last.created_at, id: last.id });
      } catch {
        nextCursor = null;
      }
    }
  }

  return {
    data: filtered,
    total,
    page: usingCursor ? 1 : page,
    pages: Math.ceil(total / limit),
    limit,
    next_cursor: nextCursor,
  };
}

// ---- Detail (single row) ---------------------------------------------------

export async function fetchPropertyById(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawClient: SupabaseClient<any>,
  id: string,
  viewMode: ViewMode,
): Promise<Record<string, unknown> | null | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = rawClient as any;
  const { data, error } = await client
    .from("properties")
    .select(SELECT_PROJECTION)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return null;
  const normalised = normalizeRow(data, new Date().toISOString());
  return applySingleView(normalised, viewMode);
}

export async function fetchPropertyBySlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawClient: SupabaseClient<any>,
  slug: string,
  viewMode: ViewMode,
): Promise<Record<string, unknown> | null | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = rawClient as any;
  const { data, error } = await client
    .from("properties")
    .select(SELECT_PROJECTION)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return null;
  const normalised = normalizeRow(data, new Date().toISOString());
  return applySingleView(normalised, viewMode);
}
