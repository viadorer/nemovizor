/**
 * Thin DB-access layer for webhook subscriptions.
 *
 * The api_keys table identifies the caller via `(owner_type, owner_id)`,
 * which we forward 1:1 to webhook_subscriptions so subscriptions are
 * naturally scoped to whoever created them.
 *
 * All functions take an explicit Supabase client (always service-role for
 * webhook tables — RLS blocks anon and authenticated entirely).
 */
import { supabaseAdmin } from "@/lib/supabase";
import {
  encryptWebhookSecret,
  generateWebhookSecret,
  prefixWebhookSecret,
} from "./secret";
import type {
  WebhookEventType,
  WebhookFilter,
  WebhookSubscriptionDto,
  WebhookSubscriptionRow,
} from "./types";

const MAX_PER_OWNER = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminClient(): any | null {
  return supabaseAdmin;
}

function rowToDto(row: WebhookSubscriptionRow): WebhookSubscriptionDto {
  return {
    id: row.id,
    url: row.url,
    secret_prefix: row.secret_prefix,
    event_types: row.event_types,
    filter: row.filter,
    active: row.active,
    failure_count: row.failure_count,
    disabled_at: row.disabled_at,
    last_delivered_at: row.last_delivered_at,
    created_at: row.created_at,
  };
}

export interface CreateWebhookInput {
  ownerType: "broker" | "agency" | "admin";
  ownerId: string;
  url: string;
  eventTypes?: WebhookEventType[];
  filter?: WebhookFilter | null;
}

export type CreateWebhookResult =
  | { ok: true; subscription: WebhookSubscriptionDto; plainSecret: string }
  | { ok: false; error: string; status: number };

export async function createWebhook(input: CreateWebhookInput): Promise<CreateWebhookResult> {
  const client = adminClient();
  if (!client) return { ok: false, error: "Supabase admin client unavailable", status: 503 };

  // Quota check
  const { count } = await client
    .from("webhook_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", input.ownerType)
    .eq("owner_id", input.ownerId)
    .is("disabled_at", null);
  if ((count ?? 0) >= MAX_PER_OWNER) {
    return {
      ok: false,
      error: `Maximum of ${MAX_PER_OWNER} active webhook subscriptions per owner reached`,
      status: 409,
    };
  }

  const plainSecret = generateWebhookSecret();
  let secretCiphertext: string;
  try {
    secretCiphertext = encryptWebhookSecret(plainSecret);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to encrypt webhook secret",
      status: 500,
    };
  }

  const { data, error } = await client
    .from("webhook_subscriptions")
    .insert({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      url: input.url,
      secret_ciphertext: secretCiphertext,
      secret_prefix: prefixWebhookSecret(plainSecret),
      event_types: input.eventTypes ?? [
        "property.created",
        "property.updated",
        "property.deleted",
        "property.price_changed",
      ],
      filter: input.filter ?? null,
    })
    .select(
      "id, url, secret_prefix, event_types, filter, active, failure_count, disabled_at, last_delivered_at, created_at, owner_type, owner_id, secret_ciphertext",
    )
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed", status: 500 };
  }

  return { ok: true, subscription: rowToDto(data as WebhookSubscriptionRow), plainSecret };
}

export async function listWebhooksForOwner(
  ownerType: "broker" | "agency" | "admin",
  ownerId: string,
): Promise<WebhookSubscriptionDto[] | { error: string }> {
  const client = adminClient();
  if (!client) return { error: "Supabase admin client unavailable" };

  const { data, error } = await client
    .from("webhook_subscriptions")
    .select(
      "id, url, secret_prefix, event_types, filter, active, failure_count, disabled_at, last_delivered_at, created_at",
    )
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return ((data as WebhookSubscriptionRow[]) ?? []).map(rowToDto);
}

export async function getWebhook(
  id: string,
  ownerType: "broker" | "agency" | "admin",
  ownerId: string,
): Promise<WebhookSubscriptionDto | null | { error: string }> {
  const client = adminClient();
  if (!client) return { error: "Supabase admin client unavailable" };

  const { data, error } = await client
    .from("webhook_subscriptions")
    .select(
      "id, url, secret_prefix, event_types, filter, active, failure_count, disabled_at, last_delivered_at, created_at",
    )
    .eq("id", id)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return null;
  return rowToDto(data as WebhookSubscriptionRow);
}

export interface UpdateWebhookInput {
  url?: string;
  eventTypes?: WebhookEventType[];
  filter?: WebhookFilter | null;
  active?: boolean;
}

export async function updateWebhook(
  id: string,
  ownerType: "broker" | "agency" | "admin",
  ownerId: string,
  input: UpdateWebhookInput,
): Promise<WebhookSubscriptionDto | null | { error: string }> {
  const client = adminClient();
  if (!client) return { error: "Supabase admin client unavailable" };

  const updates: Record<string, unknown> = {};
  if (input.url !== undefined) updates.url = input.url;
  if (input.eventTypes !== undefined) updates.event_types = input.eventTypes;
  if (input.filter !== undefined) updates.filter = input.filter;
  if (input.active !== undefined) {
    updates.active = input.active;
    if (input.active) {
      // Re-enabling resets the failure counter and clears disabled_at.
      updates.failure_count = 0;
      updates.disabled_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    // Nothing to update — just return current row.
    const cur = await getWebhook(id, ownerType, ownerId);
    return cur;
  }

  const { data, error } = await client
    .from("webhook_subscriptions")
    .update(updates)
    .eq("id", id)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .select(
      "id, url, secret_prefix, event_types, filter, active, failure_count, disabled_at, last_delivered_at, created_at",
    )
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return null;
  return rowToDto(data as WebhookSubscriptionRow);
}

export async function deleteWebhook(
  id: string,
  ownerType: "broker" | "agency" | "admin",
  ownerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = adminClient();
  if (!client) return { ok: false, error: "Supabase admin client unavailable" };

  const { error, count } = await client
    .from("webhook_subscriptions")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId);

  if (error) return { ok: false, error: error.message };
  if ((count ?? 0) === 0) return { ok: false, error: "not_found" };
  return { ok: true };
}
