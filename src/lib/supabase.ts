import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase-types";

// ===== SUPABASE CLIENT =====
// Nastavte promenne prostredi v .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
//   SUPABASE_SERVICE_KEY=eyJ... (pouze server-side, neexponovat do browseru)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";

/** Je Supabase nakonfigurovany? (anon NEBO service key) */
export const isSupabaseConfigured = Boolean(supabaseUrl && (supabaseAnonKey || supabaseServiceKey));

// ===== Browser client (singleton) =====
let browserClient: SupabaseClient<Database> | null = null;

/** Klient pro browser (client components) — singleton, session se refreshne v middleware */
export function createBrowserSupabase(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (browserClient) return browserClient;
  browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

/** Zpetna kompatibilita — pouzije singleton browser klient */
export const supabase: SupabaseClient<Database> | null = createBrowserSupabase();

/** Server-side klient s service key (obchazi RLS) — pouze v API routes / server components */
export const supabaseAdmin: SupabaseClient<Database> | null =
  supabaseUrl && supabaseServiceKey
    ? createClient<Database>(supabaseUrl, supabaseServiceKey)
    : null;

/** Vrati nejlepsi dostupny klient (admin > anon) */
export function getSupabase(): SupabaseClient<Database> | null {
  return supabaseAdmin ?? supabase;
}
