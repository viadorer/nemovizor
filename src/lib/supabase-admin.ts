import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Untyped server-side Supabase client (bypasses RLS with service key).
 *  For use in API routes where Database generics cause 'never' type issues. */
export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url) return null;

  // Prefer service key (bypasses RLS), fallback to anon
  const key = serviceKey || anonKey;
  if (!key) return null;

  return createClient(url, key);
}
