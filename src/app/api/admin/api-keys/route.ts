/**
 * Admin CRUD for API keys.
 *
 * All endpoints require the caller to be authenticated as `admin` via cookie
 * session (same helper as the rest of /api/admin/*).
 *
 * - `GET /api/admin/api-keys`            → list all keys (metadata only, no hash)
 * - `POST /api/admin/api-keys`           → create a new key; returns raw key ONCE
 * - `DELETE /api/admin/api-keys?id=xxx`  → revoke a key (soft, via `revoked_at`)
 *
 * Raw key values are shown exactly once on creation and are never retrievable
 * afterwards. The DB only stores a SHA-256 hash plus an 8-char visible prefix.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import {
  CreateApiKeyBodySchema,
} from "@/lib/api/schemas/admin-api-keys";
import {
  generateApiKey,
  hashApiKey,
  prefixApiKey,
} from "@/lib/api/api-key";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminClient(): any {
  return supabaseAdmin;
}

// ─── GET: list ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth(["admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Admin authentication required", 401);

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const { data, error } = await client
    .from("api_keys")
    .select(
      "id, name, key_prefix, owner_type, owner_id, scopes, rate_limit_per_min, created_at, last_used_at, expires_at, revoked_at",
    )
    .order("created_at", { ascending: false });

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return NextResponse.json({ data: data ?? [] });
}

// ─── POST: create ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Admin authentication required", 401);

  const parsed = await parseBody(req, CreateApiKeyBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = prefixApiKey(rawKey);

  const { data, error } = await client
    .from("api_keys")
    .insert({
      name: body.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      owner_type: body.owner_type,
      owner_id: body.owner_id,
      scopes: ["public:read"],
      rate_limit_per_min: body.rate_limit_per_min ?? 300,
      expires_at: body.expires_at ?? null,
    })
    .select(
      "id, name, key_prefix, owner_type, owner_id, scopes, rate_limit_per_min, created_at, last_used_at, expires_at, revoked_at",
    )
    .single();

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return NextResponse.json(
    {
      data,
      // Shown ONCE. Admin must store it immediately.
      rawKey,
    },
    { status: 201 },
  );
}

// ─── DELETE: revoke (soft) ────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Admin authentication required", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return apiError("VALIDATION_ERROR", "Missing or invalid id query param", 400);
  }

  const client = adminClient();
  if (!client) return apiError("SERVICE_UNAVAILABLE", "Supabase admin client unavailable", 503);

  const { error } = await client
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);

  return NextResponse.json({ ok: true });
}
