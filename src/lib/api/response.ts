import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

/** Build a standardised error response envelope. */
export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return NextResponse.json(body, { status });
}
