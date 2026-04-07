/**
 * `/api/v1/*` proxy helper.
 *
 * Wraps an existing Next.js route handler so that:
 *   - query-string keys in the incoming request are rewritten from camelCase
 *     to snake_case before the underlying handler sees them,
 *   - request JSON body (for POST/PATCH/PUT) is recursively keyed back to
 *     snake_case,
 *   - the outgoing JSON response has all its keys rewritten to camelCase,
 *   - status code, non-content-length headers and rate-limit headers are
 *     preserved.
 *
 * The goal is a stable, ergonomic v1 surface for AI agents without
 * duplicating any business logic.
 */
import { NextRequest, NextResponse } from "next/server";
import { toCamelCase, toSnakeCase, toSnakeKey } from "./camelcase";

type RouteHandler = (req: NextRequest) => Promise<Response> | Response;

/** Rebuild the URL with all search-param keys snake-cased. */
function snakeCaseUrl(originalUrl: string): string {
  const url = new URL(originalUrl);
  const rewritten = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    rewritten.append(toSnakeKey(key), value);
  }
  url.search = rewritten.toString();
  return url.toString();
}

function shouldTransformBody(method: string): boolean {
  return method === "POST" || method === "PATCH" || method === "PUT";
}

/**
 * Wrap a route handler so it behaves as a v1 proxy. Use like:
 *
 *   import { GET as origGet } from "@/app/api/properties/route";
 *   export const GET = v1Proxy(origGet);
 */
export function v1Proxy(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest): Promise<Response> => {
    // 1. Rewrite URL (query params) camelCase → snake_case.
    const rewrittenUrl = snakeCaseUrl(req.url);

    // 2. Rewrite body (if JSON POST/PATCH/PUT) camelCase → snake_case.
    let rewrittenBody: BodyInit | null | undefined;
    let injectedContentType: string | undefined;
    if (shouldTransformBody(req.method)) {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try {
          const raw = await req.text();
          if (raw.trim().length > 0) {
            const parsed = JSON.parse(raw);
            const snaked = toSnakeCase(parsed);
            rewrittenBody = JSON.stringify(snaked);
            injectedContentType = "application/json";
          }
        } catch {
          // If JSON parse fails we forward the original body unchanged and let
          // the underlying handler emit its own 400.
        }
      }
    }

    // 3. Build a new NextRequest with the rewritten URL + body.
    const headers = new Headers(req.headers);
    if (injectedContentType) headers.set("content-type", injectedContentType);
    // Remove a stale content-length so fetch can recompute it.
    headers.delete("content-length");

    const newReq = new NextRequest(rewrittenUrl, {
      method: req.method,
      headers,
      body: rewrittenBody ?? (shouldTransformBody(req.method) ? await req.clone().arrayBuffer() : undefined),
    });

    // 4. Call the underlying handler.
    const res = await handler(newReq);

    // 5. Transform the response body to camelCase if it's JSON.
    const resCt = res.headers.get("content-type") || "";
    if (!resCt.includes("application/json")) return res;

    const text = await res.text();
    let payload: unknown;
    try {
      payload = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      return new Response(text, { status: res.status, headers: res.headers });
    }

    const camelPayload = toCamelCase(payload);

    // Preserve all headers except ones that would now be wrong.
    const outHeaders = new Headers(res.headers);
    outHeaders.delete("content-length");
    outHeaders.set("content-type", "application/json; charset=utf-8");

    return NextResponse.json(camelPayload, {
      status: res.status,
      headers: outHeaders,
    });
  };
}
