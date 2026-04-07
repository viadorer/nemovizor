#!/usr/bin/env node
/**
 * Nemovizor MCP server
 *
 * Exposes the public Nemovizor API as Model Context Protocol tools so that
 * AI agents (Claude Desktop, Cursor, Claude Code, custom agents, …) can
 * search real estate listings, fetch map points, look up filter options
 * and parse natural-language queries without ever scraping HTML.
 *
 * Transport: stdio.
 *
 * Configuration (environment variables):
 *   NEMOVIZOR_BASE_URL  Base URL of the Nemovizor instance.
 *                       Default: https://nemovizor.cz
 *   NEMOVIZOR_API_KEY   Optional bearer token (reserved for a future private
 *                       tier; public endpoints don't require it today).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEMOVIZOR_BASE_URL ?? "https://nemovizor.cz").replace(/\/$/, "");
const API_KEY = process.env.NEMOVIZOR_API_KEY ?? "";

// ─── Fetch helpers ─────────────────────────────────────────────────────────

type QueryValue = string | number | boolean | string[] | undefined | null;

function buildSearchParams(params: Record<string, QueryValue>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      sp.set(key, value.join(","));
    } else {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

async function nemovizorGet(path: string, params: Record<string, QueryValue>): Promise<unknown> {
  const url = `${BASE_URL}${path}${buildSearchParams(params)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Nemovizor returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Nemovizor API error ${res.status}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function nemovizorPost(path: string, body: unknown): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Nemovizor returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Nemovizor API error ${res.status}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

function asToolResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

// ─── Tool input schemas (mirror of /api/openapi) ───────────────────────────

const listingTypeEnum = z.enum(["sale", "rent", "auction", "shares", "project"]);
const categoryEnum = z.enum(["apartment", "house", "land", "commercial", "other"]);
const sortEnum = z.enum([
  "featured",
  "price_asc",
  "price_desc",
  "newest",
  "oldest",
  "area_desc",
  "area_asc",
]);

const propertySearchShape = {
  page: z.number().int().min(1).max(1000).optional().describe("Page number, 1-based."),
  limit: z.number().int().min(1).max(100).optional().describe("Page size, max 100."),
  listing_type: listingTypeEnum.optional().describe("Listing type filter."),
  category: z
    .array(categoryEnum)
    .optional()
    .describe("One or more property categories (will be joined with commas)."),
  subtype: z
    .array(z.string())
    .optional()
    .describe("One or more subtype codes such as `2+kk`, `3+1`, `rodinny`, `T2`, …"),
  city: z.string().optional().describe("Exact city name (e.g. `Praha`, `Milano`)."),
  country: z
    .array(z.string())
    .optional()
    .describe("One or more ISO 3166-1 alpha-2 country codes, lowercase (`cz`, `sk`, `it`, …)."),
  broker_id: z.string().uuid().optional(),
  agency_id: z.string().uuid().optional(),
  price_min: z.number().nonnegative().optional(),
  price_max: z.number().nonnegative().optional(),
  area_min: z.number().nonnegative().optional(),
  area_max: z.number().nonnegative().optional(),
  sw_lat: z.number().optional(),
  sw_lon: z.number().optional(),
  ne_lat: z.number().optional(),
  ne_lon: z.number().optional(),
  sort: sortEnum.optional(),
} as const;

const mapPointsShape = {
  zoom: z.number().int().min(1).max(20).optional().describe("Map zoom level 1..20. Zoom ≥ 13 returns up to 500 pins, otherwise up to 2000."),
  listing_type: listingTypeEnum.optional(),
  category: z.array(categoryEnum).optional(),
  subtype: z.array(z.string()).optional(),
  city: z.string().optional(),
  country: z.array(z.string()).optional(),
  broker_id: z.string().uuid().optional(),
  agency_id: z.string().uuid().optional(),
  price_min: z.number().nonnegative().optional(),
  price_max: z.number().nonnegative().optional(),
  area_min: z.number().nonnegative().optional(),
  area_max: z.number().nonnegative().optional(),
  sw_lat: z.number().optional(),
  sw_lon: z.number().optional(),
  ne_lat: z.number().optional(),
  ne_lon: z.number().optional(),
} as const;

const filterOptionsShape = {
  listing_type: listingTypeEnum.optional(),
  category: z.array(categoryEnum).optional(),
  broker_id: z.string().uuid().optional(),
  agency_id: z.string().uuid().optional(),
  sw_lat: z.number().optional(),
  sw_lon: z.number().optional(),
  ne_lat: z.number().optional(),
  ne_lon: z.number().optional(),
} as const;

const aiSearchShape = {
  query: z
    .string()
    .min(3)
    .max(500)
    .describe(
      "Natural-language real-estate query in any supported language. E.g. `Byt 2+kk v Praze do 8 milionů` or `Appartement T2 à Paris`.",
    ),
} as const;

// ─── Server ────────────────────────────────────────────────────────────────

const server = new McpServer(
  {
    name: "nemovizor-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
    instructions:
      "Nemovizor is a Czech/Slovak real estate platform. Use `nemovizor_ai_search` to turn a user's free-form request into structured filters, then pass those into `nemovizor_search_properties` to retrieve listings. For map UIs, use `nemovizor_map_points`. Use `nemovizor_filter_options` for faceted counts.",
  },
);

server.tool(
  "nemovizor_search_properties",
  "Search real estate listings on Nemovizor with filters (listing type, category, subtype, city/country, price/area ranges, map bounding box, sort). Returns paginated listings including broker summary.",
  propertySearchShape,
  async (args) => {
    const data = await nemovizorGet("/api/properties", args as Record<string, QueryValue>);
    return asToolResult(data);
  },
);

server.tool(
  "nemovizor_map_points",
  "Fetch lightweight geo-points (lat/lon + minimal metadata) for rendering on a map. Zoom-aware: zoom ≥ 13 returns up to 500 pins, otherwise up to 2000.",
  mapPointsShape,
  async (args) => {
    const data = await nemovizorGet("/api/map-points", args as Record<string, QueryValue>);
    return asToolResult(data);
  },
);

server.tool(
  "nemovizor_filter_options",
  "Retrieve faceted filter metadata — available categories, subtypes, cities, price and area ranges with counts — optionally scoped by the current filter selection.",
  filterOptionsShape,
  async (args) => {
    const data = await nemovizorGet("/api/filter-options", args as Record<string, QueryValue>);
    return asToolResult(data);
  },
);

server.tool(
  "nemovizor_ai_search",
  "Convert a free-form natural-language real-estate query in any supported language (Czech, Slovak, English, French, German, Italian, Spanish…) into structured filters ready to be fed into `nemovizor_search_properties`.",
  aiSearchShape,
  async (args) => {
    const data = await nemovizorPost("/api/ai-search", args);
    return asToolResult(data);
  },
);

// ─── Start stdio transport ─────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't corrupt the JSON-RPC stream on stdout.
  console.error(`[nemovizor-mcp] connected, base=${BASE_URL}`);
}

main().catch((err) => {
  console.error("[nemovizor-mcp] fatal:", err);
  process.exit(1);
});
