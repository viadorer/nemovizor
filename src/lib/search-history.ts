import { getBrowserSupabase } from "./supabase-browser";
import type { SearchFilters } from "./saved-searches";

export type SearchHistoryEntry = {
  id: string;
  filters: SearchFilters;
  location_label: string | null;
  result_count: number | null;
  created_at: string;
};

let lastRecordedKey = "";
let lastRecordedAt = 0;

/** Record a search (debounced — ignores duplicates within 60s) */
export async function recordSearch(
  userId: string,
  filters: SearchFilters,
  locationLabel?: string | null,
  resultCount?: number | null
): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;

  const key = JSON.stringify(filters);
  const now = Date.now();
  if (key === lastRecordedKey && now - lastRecordedAt < 60_000) return;

  lastRecordedKey = key;
  lastRecordedAt = now;

  await supabase.from("search_history").insert({
    user_id: userId,
    filters: filters as Record<string, unknown>,
    location_label: locationLabel ?? null,
    result_count: resultCount ?? null,
  });
}

export async function getSearchHistory(
  userId: string,
  limit = 50
): Promise<SearchHistoryEntry[]> {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("search_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as SearchHistoryEntry[]) ?? [];
}

export async function clearSearchHistory(userId: string): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;

  await supabase.from("search_history").delete().eq("user_id", userId);
}
