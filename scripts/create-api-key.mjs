#!/usr/bin/env node
/**
 * Create a Nemovizor API key from the command line.
 *
 * Usage:
 *   node scripts/create-api-key.mjs \
 *     --owner-type broker \
 *     --owner-id   00000000-0000-0000-0000-000000000000 \
 *     --name       "Claude Desktop - David" \
 *     [--rate-limit 300] \
 *     [--expires   2026-12-31]
 *
 * Reads env vars:
 *   NEXT_PUBLIC_SUPABASE_URL     (required)
 *   SUPABASE_SERVICE_ROLE_KEY    (required; or SUPABASE_SERVICE_KEY)
 *
 * Prints the RAW key ONCE on success. The DB stores only the SHA-256 hash.
 */

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ─── CLI args ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
}

if (!args["owner-type"] || !args["owner-id"] || !args.name) {
  console.error(
    "Usage: node scripts/create-api-key.mjs --owner-type <broker|agency> --owner-id <uuid> --name <label> [--rate-limit 300] [--expires YYYY-MM-DD]",
  );
  process.exit(2);
}

const ownerType = String(args["owner-type"]);
const ownerId = String(args["owner-id"]);
const name = String(args.name);
const rateLimit = args["rate-limit"] ? parseInt(String(args["rate-limit"]), 10) : 300;
const expiresAt = args.expires ? new Date(String(args.expires)).toISOString() : null;

if (!["broker", "agency"].includes(ownerType)) {
  console.error(`Invalid --owner-type: ${ownerType} (expected 'broker' or 'agency')`);
  process.exit(2);
}
if (!/^[0-9a-f-]{36}$/i.test(ownerId)) {
  console.error(`Invalid --owner-id: ${ownerId} (expected UUID)`);
  process.exit(2);
}

// ─── Env ──────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
  );
  process.exit(2);
}

// ─── Generate ─────────────────────────────────────────────────────────────

const API_KEY_PREFIX = "nvz_";
const body = randomBytes(24).toString("base64url").slice(0, 32);
const rawKey = `${API_KEY_PREFIX}${body}`;
const keyHash = createHash("sha256").update(rawKey, "utf8").digest("hex");
const keyPrefix = rawKey.slice(0, 8);

// ─── Insert ───────────────────────────────────────────────────────────────

const supabase = createClient(url, serviceKey);
const { data, error } = await supabase
  .from("api_keys")
  .insert({
    name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    owner_type: ownerType,
    owner_id: ownerId,
    scopes: ["public:read"],
    rate_limit_per_min: rateLimit,
    expires_at: expiresAt,
  })
  .select("id")
  .single();

if (error) {
  console.error("Failed to insert API key:", error.message);
  process.exit(1);
}

console.log("\n✅  API key created");
console.log("   id            :", data.id);
console.log("   name          :", name);
console.log("   owner         :", `${ownerType}/${ownerId}`);
console.log("   rate limit    :", `${rateLimit}/min`);
console.log("   expires       :", expiresAt ?? "(never)");
console.log("\n🔑  Raw key (shown ONCE — store it now):");
console.log("   " + rawKey);
console.log(
  "\nUse it with:  Authorization: Bearer " + rawKey + "\n" +
  "or:           X-API-Key: " + rawKey + "\n",
);
