import { NextResponse } from "next/server";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

import { registry } from "@/lib/api/openapi-registry";

// Importing each schema module triggers its `registry.register(...)` calls.
import { ApiErrorSchema } from "@/lib/api/schemas/common";
import {
  PropertiesQuerySchema,
  PropertiesResponseSchema,
  PropertyDetailResponseSchema,
} from "@/lib/api/schemas/properties";
import { z } from "zod";
import {
  MapPointsQuerySchema,
  MapPointsResponseSchema,
} from "@/lib/api/schemas/map-points";
import {
  FilterOptionsQuerySchema,
  FilterOptionsResponseSchema,
} from "@/lib/api/schemas/filter-options";
import {
  AiSearchBodySchema,
  AiSearchResponseSchema,
} from "@/lib/api/schemas/ai-search";
import {
  ValuationEstimateBodySchema,
  ValuationEstimateResponseSchema,
  ValuationStatusQuerySchema,
  ValuationStatusResponseSchema,
} from "@/lib/api/schemas/valuation";
import { LeadsBodySchema, LeadsResponseSchema } from "@/lib/api/schemas/leads";
import {
  AnalyticsTrackBodySchema,
  AnalyticsTrackResponseSchema,
} from "@/lib/api/schemas/analytics-track";
import {
  BrokerAnalyticsQuerySchema,
  BrokerAnalyticsResponseSchema,
} from "@/lib/api/schemas/broker-analytics";
import {
  CreateWebhookBodySchema,
  CreateWebhookResponseSchema,
  UpdateWebhookBodySchema,
  WebhookDetailResponseSchema,
  WebhookListResponseSchema,
} from "@/lib/api/schemas/webhooks";
import {
  ImportBatchBodySchema,
  ImportBatchResponseSchema,
  ImportJobStatusSchema,
} from "@/lib/api/schemas/import";

export const dynamic = "force-static";
export const revalidate = 3600;

let cachedSpec: unknown | null = null;

function buildSpec() {
  // ── Tier-1 public paths ────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/api/properties",
    summary: "Search real-estate listings",
    description:
      "Paginated, server-side filtered property list. Public, cacheable. Returns raw Supabase rows plus nested broker summary.",
    tags: ["Listings"],
    request: { query: PropertiesQuerySchema },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: PropertiesResponseSchema } },
      },
      400: {
        description: "Invalid query parameters",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Supabase not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  // ── v1 camelCase proxies ────────────────────────────────────────────────
  // These are thin proxies over their /api/* counterparts. Query params
  // accept camelCase (e.g. listingType instead of listing_type) and
  // response bodies return camelCase keys. Behavior, rate limits and auth
  // are identical to the legacy endpoints.

  registry.registerPath({
    method: "get",
    path: "/api/v1/properties",
    summary: "Search listings (camelCase, v1)",
    description:
      "camelCase proxy over `/api/properties`. Query params and response keys are camelCase. Business-sensitive fields and broker PII are stripped from the response.",
    tags: ["Listings"],
    request: { query: PropertiesQuerySchema },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: PropertiesResponseSchema } },
      },
      400: {
        description: "Invalid query parameters",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/filter-options",
    summary: "Faceted filter metadata (camelCase, v1)",
    description:
      "camelCase proxy over `/api/filter-options`. Returns available categories, subtypes, cities, price and area ranges with counts, optionally scoped by current filter selection.",
    tags: ["Listings"],
    request: { query: FilterOptionsQuerySchema },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: FilterOptionsResponseSchema } },
      },
      400: {
        description: "Invalid query parameters",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/map-points",
    summary: "Map geo-points (camelCase, v1)",
    description:
      "camelCase proxy over `/api/map-points`. Lightweight lat/lon + metadata for map markers. Zoom >= 13 returns up to 500 pins, otherwise up to 2000.",
    tags: ["Listings"],
    request: { query: MapPointsQuerySchema },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: MapPointsResponseSchema } },
      },
      400: {
        description: "Invalid query parameters",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  // ── v1 detail endpoints (Phase 2: white-label readiness) ───────────────
  registry.registerPath({
    method: "get",
    path: "/api/v1/properties/{id}",
    summary: "Fetch a single property by UUID (camelCase, v1)",
    description:
      "Returns one active property by its UUID. Response is camelCase, business-sensitive fields (commission, mortgagePercent, …) and broker PII (phone, email) are excluded. Use `GET /api/v1/brokers/{id}/contact` for explicit broker contact retrieval.",
    tags: ["Listings"],
    request: {
      params: z.object({
        id: z
          .string()
          .uuid()
          .openapi({ description: "Property UUID returned in list responses." }),
      }),
    },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: PropertyDetailResponseSchema } },
      },
      400: {
        description: "Invalid UUID",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      404: {
        description: "Not found or inactive",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/properties/by-slug/{slug}",
    summary: "Fetch a single property by slug (camelCase, v1)",
    description:
      "Same shape as `/api/v1/properties/{id}` but resolves by URL slug instead of UUID. Useful for SEO-friendly external URLs.",
    tags: ["Listings"],
    request: {
      params: z.object({
        slug: z.string().min(1).max(300).openapi({ description: "Property slug." }),
      }),
    },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: PropertyDetailResponseSchema } },
      },
      400: {
        description: "Invalid slug",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      404: {
        description: "Not found or inactive",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/brokers/{id}/contact",
    summary: "Get a single broker's contact info (PII)",
    description:
      "Explicit, rate-limited PII access. Returns the broker's `phone` and `email`. Anonymous callers are limited to 10 requests/min/IP (anti-harvesting). API key callers get the per-key ceiling. Listing responses do NOT include this data — call this endpoint only when displaying a single broker after a meaningful user action.",
    tags: ["Brokers"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Broker UUID." }),
      }),
    },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: z
              .object({
                data: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  slug: z.string().nullable(),
                  phone: z.string().nullable(),
                  email: z.string().nullable(),
                }),
              })
              .openapi("BrokerContactResponse"),
          },
        },
      },
      400: {
        description: "Invalid UUID",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      404: {
        description: "Broker not found",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/map-points",
    summary: "Lightweight geo points for map markers",
    description:
      "Slim geo-point payload designed for Leaflet markerClusterGroup. Zoom levels < 13 return up to 2000 pins, >= 13 up to 500.",
    tags: ["Listings"],
    request: { query: MapPointsQuerySchema },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: MapPointsResponseSchema } },
      },
      400: {
        description: "Invalid query parameters",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Supabase not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/filter-options",
    summary: "Faceted search metadata (available filter values + counts)",
    description:
      "Aggregate counts for filter dropdowns, optionally scoped by current filter selection and bounding box.",
    tags: ["Listings"],
    request: { query: FilterOptionsQuerySchema },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: FilterOptionsResponseSchema } },
      },
      400: {
        description: "Invalid query parameters",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Supabase not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/ai-search",
    summary: "Natural-language → structured property filters",
    description:
      "Converts a free-form natural language query (any supported language) into structured filters usable with /api/properties or /api/map-points. Backed by Google Gemini.",
    tags: ["AI"],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: AiSearchBodySchema } },
      },
    },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: AiSearchResponseSchema } },
      },
      400: {
        description: "Invalid request body",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      500: {
        description: "AI provider failure",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "AI provider not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  // ── Tier-2: valuation, leads, analytics, broker dashboard ─────────────
  registry.registerPath({
    method: "post",
    path: "/api/valuation/estimate",
    summary: "Request a property valuation",
    description:
      "Submits property details to the RealVisor → Valuo backend and returns an estimated price range. Rate-limited to 30/min (IP-based, unless an API key raises the ceiling). Creates a `valuation_reports` row and a lead as a side effect.",
    tags: ["Valuation"],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: ValuationEstimateBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Valuation computed",
        content: { "application/json": { schema: ValuationEstimateResponseSchema } },
      },
      400: {
        description: "Invalid body",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      502: {
        description: "Upstream valuation provider failed",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Valuation provider not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/valuation/status",
    summary: "Check if a valuation PDF is ready",
    description:
      "Polls the status of a previously requested valuation. Safe to poll frequently.",
    tags: ["Valuation"],
    request: { query: ValuationStatusQuerySchema },
    responses: {
      200: {
        description: "Current status",
        content: { "application/json": { schema: ValuationStatusResponseSchema } },
      },
      400: {
        description: "Invalid query",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      404: {
        description: "Valuation not found",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Supabase not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/leads",
    summary: "Submit a lead (seller / buyer / other intent)",
    description:
      "Public lead capture. Rate-limited to 10/min per client to mitigate spam. All fields except `name` and `email` are optional.",
    tags: ["Leads"],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: LeadsBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Lead stored",
        content: { "application/json": { schema: LeadsResponseSchema } },
      },
      400: {
        description: "Invalid body",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Supabase not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/analytics/track",
    summary: "Track client-side analytics events",
    description:
      "Accepts either a single event or an array of events. Events with missing `session_id` or `event_type` are silently dropped. High rate limit (2000/min) to allow bursts.",
    tags: ["Analytics"],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: AnalyticsTrackBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Accepted",
        content: { "application/json": { schema: AnalyticsTrackResponseSchema } },
      },
      400: {
        description: "Invalid body",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Supabase not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  // ── Webhooks (Phase D) ─────────────────────────────────────────────────
  registry.registerPath({
    method: "post",
    path: "/api/v1/webhooks",
    summary: "Create a webhook subscription",
    description:
      "Register a URL to receive HTTPS POST notifications when properties are created, updated, deleted, or change price. The plain webhook signing secret is returned ONCE in the response — store it immediately. All deliveries are signed with HMAC-SHA256 in the `X-Nemovizor-Signature: sha256=<hex>` header so receivers can verify authenticity. Requires an API key with the `write:webhooks` scope.",
    tags: ["Webhooks"],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: CreateWebhookBodySchema } },
      },
    },
    responses: {
      201: {
        description: "Subscription created",
        content: { "application/json": { schema: CreateWebhookResponseSchema } },
      },
      400: { description: "Invalid body", content: { "application/json": { schema: ApiErrorSchema } } },
      401: { description: "Missing or invalid API key", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "API key missing write:webhooks scope", content: { "application/json": { schema: ApiErrorSchema } } },
      409: { description: "Per-owner subscription quota exceeded", content: { "application/json": { schema: ApiErrorSchema } } },
      429: { description: "Rate limit exceeded", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/webhooks",
    summary: "List your webhook subscriptions",
    tags: ["Webhooks"],
    responses: {
      200: { description: "OK", content: { "application/json": { schema: WebhookListResponseSchema } } },
      401: { description: "Missing or invalid API key", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "API key missing write:webhooks scope", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/webhooks/{id}",
    summary: "Fetch a single webhook subscription",
    tags: ["Webhooks"],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: WebhookDetailResponseSchema } } },
      400: { description: "Invalid id", content: { "application/json": { schema: ApiErrorSchema } } },
      401: { description: "Missing or invalid API key", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "API key missing write:webhooks scope", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/v1/webhooks/{id}",
    summary: "Update a webhook subscription",
    description: "Change url, event_types, filter, or active flag.",
    tags: ["Webhooks"],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        required: true,
        content: { "application/json": { schema: UpdateWebhookBodySchema } },
      },
    },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: WebhookDetailResponseSchema } } },
      400: { description: "Invalid body", content: { "application/json": { schema: ApiErrorSchema } } },
      401: { description: "Missing or invalid API key", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "API key missing write:webhooks scope", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/v1/webhooks/{id}",
    summary: "Delete a webhook subscription",
    tags: ["Webhooks"],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.literal(true) }) } } },
      401: { description: "Missing or invalid API key", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "API key missing write:webhooks scope", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/broker/analytics-behavior",
    summary: "Behavioral analytics dashboard for a broker or agency",
    description:
      "Returns KPIs, funnel, top properties, device breakdown and hourly activity for the specified broker or agency over the last 7 days (with 14-day daily chart). One of `broker_id` or `agency_id` is required.",
    tags: ["Analytics"],
    request: { query: BrokerAnalyticsQuerySchema },
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: BrokerAnalyticsResponseSchema } },
      },
      400: {
        description: "Invalid query",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      429: {
        description: "Rate limit exceeded",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
      503: {
        description: "Supabase not configured",
        content: { "application/json": { schema: ApiErrorSchema } },
      },
    },
  });

  // ── Import API ───────────────────────────────────────────────────────────

  registry.registerPath({
    method: "post",
    path: "/api/v1/import/batch",
    summary: "Submit a batch import (agencies, branches, brokers, properties)",
    description:
      "Enqueues an async import job. Returns 202 with a job_id for polling via `/api/v1/import/jobs/{id}`. " +
      "Requires API key with `write:import` scope and `owner_type=agency`. " +
      "Items are processed in dependency order: agency → branches → brokers → properties.",
    tags: ["Import"],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: ImportBatchBodySchema } },
      },
    },
    responses: {
      202: { description: "Job enqueued", content: { "application/json": { schema: ImportBatchResponseSchema } } },
      400: { description: "Invalid payload", content: { "application/json": { schema: ApiErrorSchema } } },
      401: { description: "Missing or invalid API key", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "Missing write:import scope or not agency key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/import/jobs",
    summary: "List recent import jobs",
    tags: ["Import"],
    responses: {
      200: { description: "OK", content: { "application/json": { schema: z.object({ data: z.array(ImportJobStatusSchema) }) } } },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/import/jobs/{id}",
    summary: "Get import job status + per-item results",
    description: "Returns progress counters while processing. When completed, includes per-item results with warnings/errors.",
    tags: ["Import"],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: ImportJobStatusSchema } } },
      404: { description: "Job not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/v1/import/properties/{external_id}",
    summary: "Deactivate a property by external_id",
    description: "Synchronous single-property deactivation. Sets active=false on the matching property.",
    tags: ["Import"],
    request: { params: z.object({ external_id: z.string() }) },
    responses: {
      200: { description: "Deactivated", content: { "application/json": { schema: z.object({ ok: z.literal(true), nemovizor_id: z.string().uuid(), nemovizor_slug: z.string(), action: z.literal("deactivated") }) } } },
      404: { description: "Property not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Nemovizor API",
      version: "1.0.0",
      description:
        "Public API of Nemovizor — Czech & Slovak real-estate platform. Designed to be consumed by AI agents and machine clients.\n\n" +
        "**Two parallel surfaces exist with identical semantics:**\n\n" +
        "- `/api/*` — legacy paths, snake_case in both query params and response bodies. Kept stable for existing clients (including the Nemovizor web frontend).\n" +
        "- `/api/v1/*` — camelCase in both query params and response bodies. Recommended for new agent integrations. It is a thin proxy over `/api/*` that rewrites keys in both directions, so rate limits, auth and behavior are identical.\n\n" +
        "See also: [llms.txt](/llms.txt), [robots.txt](/robots.txt), [ai-plugin.json](/.well-known/ai-plugin.json).",
      contact: { name: "Nemovizor", email: "info@nemovizor.cz" },
    },
    servers: [
      { url: "https://nemovizor.cz", description: "Production" },
      { url: "http://localhost:3000", description: "Local development" },
    ],
    tags: [
      { name: "Listings", description: "Public property search, filters, detail and pagination." },
      { name: "Brokers", description: "Broker contact (PII access, rate-limited)." },
      { name: "AI", description: "AI-powered endpoints." },
      { name: "Valuation", description: "Property valuation via RealVisor/Valuo." },
      { name: "Leads", description: "Lead capture." },
      { name: "Analytics", description: "Analytics tracking and dashboards." },
      { name: "Webhooks", description: "Outbound webhook subscriptions for property events." },
      { name: "Import", description: "Batch import API for CRMs and agency management systems." },
    ],
  });
}

export async function GET() {
  if (!cachedSpec) {
    cachedSpec = buildSpec();
  }
  return NextResponse.json(cachedSpec, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
