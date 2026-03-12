import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase-types";

// ===== SUPABASE CLIENT =====
// Nastavte proměnné prostředí v .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Klient pro browser (client components) */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/** Je Supabase nakonfigurovaný? */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
