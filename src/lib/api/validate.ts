import type { NextRequest, NextResponse } from "next/server";
import type { z, ZodError, ZodTypeAny } from "zod";
import { apiError } from "./response";

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

function formatIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

/**
 * Parse and validate URL search params against a Zod schema.
 *
 * The input object passed to the schema is a plain `Record<string, string>`
 * built from `searchParams.entries()`. Duplicate keys use the last value
 * (consistent with most existing handlers); list-style filters are passed as
 * comma-separated strings and should be transformed in the schema itself.
 */
export function parseQuery<S extends ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: S,
): ParseResult<z.infer<S>> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        { issues: formatIssues(result.error) },
      ),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns a 400 error response if the body is not valid JSON or fails validation.
 */
export async function parseBody<S extends ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: apiError("VALIDATION_ERROR", "Invalid JSON body", 400),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        { issues: formatIssues(result.error) },
      ),
    };
  }
  return { ok: true, data: result.data };
}
