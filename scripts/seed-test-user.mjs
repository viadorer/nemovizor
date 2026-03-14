#!/usr/bin/env node
// ============================================================
// Seed: Create test users (user + broker) for dashboard testing
// Usage: node scripts/seed-test-user.mjs
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load .env.local
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ===== Test users config =====
const TEST_USERS = [
  {
    email: "test@nemovizor.cz",
    password: "Test1234!",
    full_name: "Testovaci Uzivatel",
    role: "user",
  },
  {
    email: "jan.novak@nemovizor.cz",
    password: "Makler1234!",
    full_name: "Jan Novak",
    role: "broker",
    broker_slug: "jan-novak", // link to existing broker
  },
];

async function main() {
  for (const u of TEST_USERS) {
    console.log(`\n--- Creating user: ${u.email} (${u.role}) ---`);

    // 1. Create auth user (or get existing)
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    let userId;
    if (createErr) {
      if (createErr.message?.includes("already been registered")) {
        // Find existing user
        const { data: list } = await sb.auth.admin.listUsers();
        const existing = list?.users?.find((x) => x.email === u.email);
        if (existing) {
          userId = existing.id;
          console.log(`  Already exists: ${userId}`);
        } else {
          console.error(`  ERROR: ${createErr.message}`);
          continue;
        }
      } else {
        console.error(`  ERROR: ${createErr.message}`);
        continue;
      }
    } else {
      userId = created.user.id;
      console.log(`  Created: ${userId}`);
    }

    // 2. Update profile (trigger should have created it)
    const { error: profErr } = await sb
      .from("profiles")
      .upsert({
        id: userId,
        full_name: u.full_name,
        role: u.role,
        notification_email: true,
      });

    if (profErr) {
      console.error(`  Profile error: ${profErr.message}`);
    } else {
      console.log(`  Profile set: role=${u.role}`);
    }

    // 3. Link to broker if applicable
    if (u.broker_slug) {
      const { data: broker } = await sb
        .from("brokers")
        .select("id, name")
        .eq("slug", u.broker_slug)
        .single();

      if (broker) {
        // Add user_id column to broker if needed, or just log the link
        console.log(`  Linked to broker: ${broker.name} (${broker.id})`);
      } else {
        console.log(`  Broker slug "${u.broker_slug}" not found in DB`);
      }
    }

    // 4. Add some test favorites for user role
    if (u.role === "user") {
      const { data: props } = await sb
        .from("properties")
        .select("id")
        .eq("active", true)
        .limit(3);

      if (props?.length) {
        for (const p of props) {
          await sb.from("favorites").upsert(
            { user_id: userId, property_id: p.id },
            { onConflict: "user_id,property_id" }
          );
        }
        console.log(`  Added ${props.length} favorites`);
      }

      // Add a saved search
      await sb.from("saved_searches").upsert(
        {
          user_id: userId,
          name: "Byty Praha do 5M",
          city: "Praha",
          category: "apartment",
          price_max: 5000000,
          notify_email: true,
          notify_frequency: "daily",
        },
        { onConflict: "user_id" }
      ).select();
      // Insert won't fail on duplicate thanks to upsert
      console.log(`  Added saved search`);

      // Add search history
      await sb.from("search_history").insert({
        user_id: userId,
        filters: { city: "Praha", category: "apartment", price_max: 5000000 },
        location_label: "Praha",
        result_count: 42,
      });
      await sb.from("search_history").insert({
        user_id: userId,
        filters: { city: "Brno", listing_type: "rent" },
        location_label: "Brno",
        result_count: 18,
      });
      console.log(`  Added search history`);
    }
  }

  console.log("\n=== Done ===");
  console.log("Login credentials:");
  for (const u of TEST_USERS) {
    console.log(`  ${u.role.padEnd(7)} | ${u.email} | ${u.password}`);
  }
}

main().catch(console.error);
