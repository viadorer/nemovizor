import { getBrowserSupabase } from "./supabase-browser";

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("favorites")
    .select("property_id")
    .eq("user_id", userId);

  return data?.map((f) => f.property_id) ?? [];
}

export async function getFavorites(userId: string) {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("favorites")
    .select("*, properties(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function addFavorite(userId: string, propertyId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, property_id: propertyId });

  return !error;
}

export async function removeFavorite(userId: string, propertyId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("property_id", propertyId);

  return !error;
}

export async function isFavorite(userId: string, propertyId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;

  const { count } = await supabase
    .from("favorites")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("property_id", propertyId);

  return (count ?? 0) > 0;
}
