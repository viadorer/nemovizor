import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./supabase-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Server-side Supabase klient s cookie-based auth session.
 *  Pouzivat v Server Components a API routes. */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll muze selhat v Server Components (read-only),
          // to je OK — session se refreshne v middleware
        }
      },
    },
  });
}
