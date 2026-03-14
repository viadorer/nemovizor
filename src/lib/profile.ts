import { getBrowserSupabase } from "./supabase-browser";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  preferred_city: string | null;
  notification_email: boolean;
  notification_push: boolean;
  created_at: string;
  updated_at: string;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "phone" | "preferred_city" | "avatar_url" | "notification_email" | "notification_push">>
): Promise<Profile | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  return data as Profile | null;
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (error) return null;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
