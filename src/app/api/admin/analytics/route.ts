import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const auth = await requireAuth(["admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { supabase } = auth;

  const [properties, brokers, agencies, profiles, favorites, searches, projects] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("brokers").select("id", { count: "exact", head: true }),
    supabase.from("agencies").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("favorites").select("id", { count: "exact", head: true }),
    supabase.from("saved_searches").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
  ]);

  const activeProperties = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  return NextResponse.json({
    properties: properties.count ?? 0,
    activeProperties: activeProperties.count ?? 0,
    brokers: brokers.count ?? 0,
    agencies: agencies.count ?? 0,
    users: profiles.count ?? 0,
    favorites: favorites.count ?? 0,
    savedSearches: searches.count ?? 0,
    projects: projects.count ?? 0,
  });
}
