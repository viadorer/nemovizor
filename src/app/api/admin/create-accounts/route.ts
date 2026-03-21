import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getAdminSupabase } from "@/lib/supabase-admin";

/**
 * POST /api/admin/create-accounts
 *
 * Creates user accounts for agencies and brokers that have an email
 * but no linked user_id yet. Checks for email duplicates across
 * auth.users before creating.
 *
 * Body (optional):
 *   { target?: "all" | "agencies" | "brokers" }
 *   Default: "all"
 *
 * Returns:
 *   { created: { agencies: number, brokers: number }, skipped: { ... }, errors: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(["admin"]);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const adminSupabase = getAdminSupabase();
  if (!adminSupabase) {
    return NextResponse.json(
      { error: "Supabase not configured or service key missing" },
      { status: 500 }
    );
  }

  let target = "all";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.target) target = body.target;
  } catch {
    // default: all
  }

  const results = {
    created: { agencies: 0, brokers: 0 },
    skipped: { agencies_no_email: 0, agencies_has_account: 0, brokers_no_email: 0, brokers_has_account: 0, duplicate_email: 0 },
    errors: [] as string[],
  };

  // Collect all existing emails from auth.users to check duplicates
  const existingEmails = new Set<string>();
  const { data: authUsers, error: authErr } = await adminSupabase.auth.admin.listUsers({ perPage: 10000 });
  if (authErr) {
    return NextResponse.json({ error: "Failed to list auth users: " + authErr.message }, { status: 500 });
  }
  for (const u of authUsers.users) {
    if (u.email) existingEmails.add(u.email.toLowerCase());
  }

  // Default password (users will need to reset)
  const DEFAULT_PASSWORD = process.env.DEFAULT_ACCOUNT_PASSWORD || "Nemovizor2026!";

  // ===== AGENCIES =====
  if (target === "all" || target === "agencies") {
    const { data: agencies, error: agErr } = await adminSupabase
      .from("agencies")
      .select("id, name, email, user_id")
      .order("name");

    if (agErr) {
      results.errors.push("Failed to load agencies: " + agErr.message);
    } else if (agencies) {
      for (const agency of agencies) {
        // Skip if no email
        if (!agency.email || !agency.email.trim()) {
          results.skipped.agencies_no_email++;
          continue;
        }

        // Skip if already has user_id
        if (agency.user_id) {
          results.skipped.agencies_has_account++;
          continue;
        }

        const email = agency.email.trim().toLowerCase();

        // Skip if email already exists in auth
        if (existingEmails.has(email)) {
          results.skipped.duplicate_email++;
          // Try to link existing user
          const existingUser = authUsers.users.find(
            (u) => u.email?.toLowerCase() === email
          );
          if (existingUser) {
            await adminSupabase
              .from("agencies")
              .update({ user_id: existingUser.id })
              .eq("id", agency.id);
          }
          continue;
        }

        // Create auth user
        const { data: newUser, error: createErr } = await adminSupabase.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: agency.name,
            entity_type: "agency",
            entity_id: agency.id,
          },
        });

        if (createErr) {
          results.errors.push(`Agency "${agency.name}" (${email}): ${createErr.message}`);
          continue;
        }

        if (newUser.user) {
          // Link user_id to agency
          await adminSupabase
            .from("agencies")
            .update({ user_id: newUser.user.id })
            .eq("id", agency.id);

          // Create profile with admin role for agency
          await adminSupabase.from("profiles").upsert({
            id: newUser.user.id,
            full_name: agency.name,
            role: "admin",
          });

          existingEmails.add(email);
          results.created.agencies++;
        }
      }
    }
  }

  // ===== BROKERS =====
  if (target === "all" || target === "brokers") {
    const { data: brokers, error: brErr } = await adminSupabase
      .from("brokers")
      .select("id, name, email, user_id")
      .order("name");

    if (brErr) {
      results.errors.push("Failed to load brokers: " + brErr.message);
    } else if (brokers) {
      for (const broker of brokers) {
        // Skip if no email
        if (!broker.email || !broker.email.trim()) {
          results.skipped.brokers_no_email++;
          continue;
        }

        // Skip if already has user_id
        if (broker.user_id) {
          results.skipped.brokers_has_account++;
          continue;
        }

        const email = broker.email.trim().toLowerCase();

        // Skip if email already exists in auth
        if (existingEmails.has(email)) {
          results.skipped.duplicate_email++;
          // Try to link existing user
          const existingUser = authUsers.users.find(
            (u) => u.email?.toLowerCase() === email
          );
          if (existingUser) {
            await adminSupabase
              .from("brokers")
              .update({ user_id: existingUser.id })
              .eq("id", broker.id);
          }
          continue;
        }

        // Create auth user
        const { data: newUser, error: createErr } = await adminSupabase.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: broker.name,
            entity_type: "broker",
            entity_id: broker.id,
          },
        });

        if (createErr) {
          results.errors.push(`Broker "${broker.name}" (${email}): ${createErr.message}`);
          continue;
        }

        if (newUser.user) {
          // Link user_id to broker
          await adminSupabase
            .from("brokers")
            .update({ user_id: newUser.user.id })
            .eq("id", broker.id);

          // Create profile with broker role
          await adminSupabase.from("profiles").upsert({
            id: newUser.user.id,
            full_name: broker.name,
            role: "broker",
          });

          existingEmails.add(email);
          results.created.brokers++;
        }
      }
    }
  }

  return NextResponse.json(results);
}

/**
 * GET /api/admin/create-accounts
 *
 * Preview: returns how many accounts would be created (dry run).
 */
export async function GET() {
  const auth = await requireAuth(["admin"]);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const adminSupabase = getAdminSupabase();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Count agencies without user_id but with email
  const { count: agenciesNeedAccount } = await adminSupabase
    .from("agencies")
    .select("id", { count: "exact", head: true })
    .not("email", "eq", "")
    .is("user_id", null);

  const { count: agenciesTotal } = await adminSupabase
    .from("agencies")
    .select("id", { count: "exact", head: true });

  const { count: agenciesWithAccount } = await adminSupabase
    .from("agencies")
    .select("id", { count: "exact", head: true })
    .not("user_id", "is", null);

  // Count brokers without user_id but with email
  const { count: brokersNeedAccount } = await adminSupabase
    .from("brokers")
    .select("id", { count: "exact", head: true })
    .not("email", "eq", "")
    .is("user_id", null);

  const { count: brokersTotal } = await adminSupabase
    .from("brokers")
    .select("id", { count: "exact", head: true });

  const { count: brokersWithAccount } = await adminSupabase
    .from("brokers")
    .select("id", { count: "exact", head: true })
    .not("user_id", "is", null);

  return NextResponse.json({
    agencies: {
      total: agenciesTotal ?? 0,
      with_account: agenciesWithAccount ?? 0,
      need_account: agenciesNeedAccount ?? 0,
    },
    brokers: {
      total: brokersTotal ?? 0,
      with_account: brokersWithAccount ?? 0,
      need_account: brokersNeedAccount ?? 0,
    },
  });
}
