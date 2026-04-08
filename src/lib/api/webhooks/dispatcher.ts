/**
 * Webhook dispatcher worker.
 *
 * Called by `/api/cron/dispatch-webhooks` every 5 minutes (Vercel cron).
 * Picks up pending events from `webhook_outbox`, fans them out to all
 * matching `webhook_subscriptions`, signs each delivery with HMAC-SHA256,
 * POSTs to the subscriber URL with a 5-second timeout, and records the
 * outcome in `webhook_deliveries`.
 *
 * Failure handling:
 *   • Per delivery: increments subscription.failure_count. After 20
 *     consecutive failures the subscription is auto-disabled.
 *   • Per outbox row: increments attempt. The next retry happens after
 *     an exponential backoff (see backoff.ts). After MAX_ATTEMPTS the
 *     row is marked as `failed`.
 *
 * Concurrency:
 *   • Cron worker is single-tenant per Vercel deploy; we run it serially
 *     row-by-row. To prevent two concurrent invocations from delivering
 *     the same event twice, we mark the row `delivering` before sending
 *     and `next_attempt_at = now() + 10 minutes` so an orphan from a
 *     crashed worker is reclaimable but not double-delivered.
 */
import { decryptWebhookSecret } from "./secret";
import { signWebhookPayload } from "./sign";
import { matchesFilter } from "./filter";
import { isTerminalFailure, nextAttemptAt } from "./backoff";
import type {
  WebhookDeliveryPayload,
  WebhookEventType,
  WebhookOutboxRow,
  WebhookSubscriptionRow,
} from "./types";

const BATCH_LIMIT = 100;
const DELIVERY_TIMEOUT_MS = 5000;
const ORPHAN_LOCK_MS = 10 * 60 * 1000; // 10 minutes
const AUTO_DISABLE_THRESHOLD = 20;

export interface DispatcherSummary {
  picked: number;
  delivered: number;
  failed: number;
  retried: number;
  errors: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/**
 * Main entry point. Returns a summary suitable for the cron route to
 * include in its JSON response.
 */
export async function dispatchPendingWebhooks(client: AdminClient): Promise<DispatcherSummary> {
  const summary: DispatcherSummary = {
    picked: 0,
    delivered: 0,
    failed: 0,
    retried: 0,
    errors: [],
  };

  const nowIso = new Date().toISOString();

  // Pick up rows that are either fresh (`pending` and due) or orphaned
  // (`delivering` but locked too long ago — previous worker crashed).
  const orphanCutoff = new Date(Date.now() - ORPHAN_LOCK_MS).toISOString();

  const { data: rows, error } = await client
    .from("webhook_outbox")
    .select("id, event_type, property_id, payload, status, attempt, next_attempt_at, created_at")
    .or(
      `and(status.eq.pending,next_attempt_at.lte.${nowIso}),and(status.eq.delivering,next_attempt_at.lte.${orphanCutoff})`,
    )
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    summary.errors.push(`outbox select: ${error.message}`);
    return summary;
  }

  const outboxRows = (rows ?? []) as WebhookOutboxRow[];
  summary.picked = outboxRows.length;
  if (outboxRows.length === 0) return summary;

  // Pre-load all active subscriptions in one query (typical row count is small).
  const { data: subRows, error: subErr } = await client
    .from("webhook_subscriptions")
    .select(
      "id, owner_type, owner_id, url, secret_ciphertext, secret_prefix, event_types, filter, active, failure_count, disabled_at, last_delivered_at, created_at",
    )
    .eq("active", true)
    .is("disabled_at", null);
  if (subErr) {
    summary.errors.push(`subscriptions select: ${subErr.message}`);
    return summary;
  }
  const subscriptions = (subRows ?? []) as WebhookSubscriptionRow[];

  for (const row of outboxRows) {
    try {
      const result = await processOutboxRow(client, row, subscriptions);
      if (result === "delivered") summary.delivered++;
      else if (result === "failed") summary.failed++;
      else if (result === "retried") summary.retried++;
    } catch (e) {
      summary.errors.push(`row ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return summary;
}

type RowOutcome = "delivered" | "retried" | "failed";

async function processOutboxRow(
  client: AdminClient,
  row: WebhookOutboxRow,
  allSubs: WebhookSubscriptionRow[],
): Promise<RowOutcome> {
  // Lock the row by flipping to `delivering` with a 10-minute orphan window.
  const lockUntil = new Date(Date.now() + ORPHAN_LOCK_MS).toISOString();
  await client
    .from("webhook_outbox")
    .update({ status: "delivering", next_attempt_at: lockUntil })
    .eq("id", row.id);

  // Pick subscriptions that match this event type AND filter.
  const matching = allSubs.filter((s) => {
    if (!s.event_types.includes(row.event_type as WebhookEventType)) return false;
    return matchesFilter(row.payload as Record<string, unknown>, s.filter ?? null);
  });

  if (matching.length === 0) {
    // No subscribers — mark delivered immediately so the row is cleaned up.
    await client
      .from("webhook_outbox")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return "delivered";
  }

  const attemptNumber = row.attempt + 1;
  let allOk = true;

  for (const sub of matching) {
    const subResult = await deliverToSubscription(client, row, sub, attemptNumber);
    if (!subResult) allOk = false;
  }

  if (allOk) {
    await client
      .from("webhook_outbox")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        attempt: attemptNumber,
        last_error: null,
      })
      .eq("id", row.id);
    return "delivered";
  }

  // Some delivery failed → schedule retry or terminal fail.
  const next = nextAttemptAt(attemptNumber);
  if (next && !isTerminalFailure(attemptNumber)) {
    await client
      .from("webhook_outbox")
      .update({
        status: "pending",
        attempt: attemptNumber,
        next_attempt_at: next.toISOString(),
        last_error: "one or more deliveries failed",
      })
      .eq("id", row.id);
    return "retried";
  }

  await client
    .from("webhook_outbox")
    .update({
      status: "failed",
      attempt: attemptNumber,
      last_error: "max attempts reached",
    })
    .eq("id", row.id);
  return "failed";
}

async function deliverToSubscription(
  client: AdminClient,
  row: WebhookOutboxRow,
  sub: WebhookSubscriptionRow,
  attemptNumber: number,
): Promise<boolean> {
  let plainSecret: string;
  try {
    plainSecret = decryptWebhookSecret(sub.secret_ciphertext);
  } catch (e) {
    await recordDelivery(client, {
      outbox_id: row.id,
      subscription_id: sub.id,
      attempt: attemptNumber,
      status: "failure",
      http_status: null,
      latency_ms: 0,
      response_body: `secret decrypt error: ${e instanceof Error ? e.message : String(e)}`,
    });
    await bumpFailureCount(client, sub);
    return false;
  }

  const occurredAt = Math.floor(new Date(row.created_at).getTime() / 1000);
  const deliveryId = crypto.randomUUID();
  const payload: WebhookDeliveryPayload = {
    id: deliveryId,
    type: row.event_type as WebhookEventType,
    occurred_at: occurredAt,
    data: row.payload,
  };
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(body, plainSecret);

  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let responseSnippet: string = "";
  let ok = false;

  try {
    const res = await fetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Nemovizor-Webhooks/1.0",
        "X-Nemovizor-Signature": signature,
        "X-Nemovizor-Event": row.event_type,
        "X-Nemovizor-Webhook-Id": deliveryId,
        "X-Nemovizor-Timestamp": String(Math.floor(Date.now() / 1000)),
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    httpStatus = res.status;
    ok = res.ok;
    try {
      responseSnippet = (await res.text()).slice(0, 500);
    } catch {
      responseSnippet = "";
    }
  } catch (e) {
    responseSnippet = `fetch error: ${e instanceof Error ? e.message : String(e)}`;
  }

  const latencyMs = Date.now() - startedAt;
  await recordDelivery(client, {
    outbox_id: row.id,
    subscription_id: sub.id,
    attempt: attemptNumber,
    status: ok ? "success" : "failure",
    http_status: httpStatus,
    latency_ms: latencyMs,
    response_body: responseSnippet,
  });

  if (ok) {
    await client
      .from("webhook_subscriptions")
      .update({
        failure_count: 0,
        last_delivered_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
  } else {
    await bumpFailureCount(client, sub);
  }

  return ok;
}

async function recordDelivery(
  client: AdminClient,
  row: {
    outbox_id: string;
    subscription_id: string;
    attempt: number;
    status: "success" | "failure";
    http_status: number | null;
    latency_ms: number;
    response_body: string;
  },
): Promise<void> {
  await client.from("webhook_deliveries").insert(row);
}

async function bumpFailureCount(client: AdminClient, sub: WebhookSubscriptionRow): Promise<void> {
  const newCount = (sub.failure_count ?? 0) + 1;
  const updates: Record<string, unknown> = { failure_count: newCount };
  if (newCount >= AUTO_DISABLE_THRESHOLD) {
    updates.active = false;
    updates.disabled_at = new Date().toISOString();
  }
  await client.from("webhook_subscriptions").update(updates).eq("id", sub.id);
  // Mutate the in-memory object too so subsequent rows in the same batch
  // see the latest count without re-fetching.
  sub.failure_count = newCount;
}
