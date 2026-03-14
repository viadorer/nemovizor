import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabase } from "./supabase";

/** Untyped browser Supabase klient pro dashboard CRUD.
 *  Re-exportuje singleton z supabase.ts bez Database generics
 *  aby se predchazelo TypeScript 'never' problemum. */
export function getBrowserSupabase(): SupabaseClient | null {
  return createBrowserSupabase() as SupabaseClient | null;
}
