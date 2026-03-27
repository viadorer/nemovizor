import type { SavedSearch } from "@/lib/types";
import {
  ListingTypes, PropertyCategories,
  ApartmentSubtypes, HouseSubtypes, LandSubtypes, CommercialSubtypes, OtherSubtypes,
  type ListingType, type PropertyCategory,
} from "@/lib/types";
import { getBrowserSupabase } from "@/lib/supabase-browser";

const STORAGE_KEY = "nemovizor_saved_searches";
const SESSION_KEY = "nemovizor_current_search";
const MAX_SAVED = 20;

// ===== Types =====
export type SearchFilters = SavedSearch["filters"];

// ===== Supabase helpers (for logged-in users) =====

/** Get the current user ID from Supabase session (returns null if not logged in) */
async function getCurrentUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** Convert client filters to DB columns */
function filtersToDbRow(filters: SearchFilters, name: string, locationLabel?: string | null) {
  const cats = filters.categories?.length ? filters.categories : filters.category ? [filters.category] : [];
  const subs = filters.subtypes?.length ? filters.subtypes : filters.subtype ? [filters.subtype] : [];
  return {
    name,
    listing_type: filters.listingType || null,
    category: cats.join(",") || null,
    subtype: subs.join(",") || null,
    city: filters.city || (locationLabel ?? null),
    price_min: filters.priceMin || null,
    price_max: filters.priceMax || null,
    area_min: filters.areaMin || null,
    area_max: filters.areaMax || null,
    notify_email: false,
    notify_frequency: "daily",
    active: true,
  };
}

/** Convert DB row to SavedSearch client type */
function dbRowToSavedSearch(row: Record<string, unknown>): SavedSearch {
  const cats = row.category ? String(row.category).split(",") : [];
  const subs = row.subtype ? String(row.subtype).split(",") : [];
  return {
    id: String(row.id),
    name: String(row.name || ""),
    filters: {
      listingType: (row.listing_type as string) || undefined,
      categories: cats.length > 0 ? cats : undefined,
      subtypes: subs.length > 0 ? subs : undefined,
      city: (row.city as string) || undefined,
      priceMin: Number(row.price_min) || undefined,
      priceMax: Number(row.price_max) || undefined,
      areaMin: Number(row.area_min) || undefined,
      areaMax: Number(row.area_max) || undefined,
    },
    locationLabel: (row.city as string) || undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

// ===== localStorage CRUD (fallback for non-logged users) =====

function getLocalSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSearches(searches: SavedSearch[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

// ===== Public API =====

/**
 * Get saved searches. Logged-in → Supabase, otherwise → localStorage.
 */
export async function getSavedSearchesAsync(): Promise<SavedSearch[]> {
  const userId = await getCurrentUserId();
  if (userId) {
    const supabase = getBrowserSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_SAVED);
      if (data) return data.map((r) => dbRowToSavedSearch(r as Record<string, unknown>));
    }
  }
  return getLocalSearches();
}

/** Sync version (localStorage only) — used for initial render before async resolves */
export function getSavedSearches(): SavedSearch[] {
  return getLocalSearches();
}

/**
 * Add a saved search. Logged-in → Supabase, otherwise → localStorage.
 */
export async function addSavedSearchAsync(
  filters: SearchFilters,
  locationLabel?: string | null,
  customName?: string
): Promise<SavedSearch> {
  const name = customName || generateSearchName(filters, locationLabel);
  const userId = await getCurrentUserId();

  if (userId) {
    const supabase = getBrowserSupabase();
    if (supabase) {
      const row = { ...filtersToDbRow(filters, name, locationLabel), user_id: userId };
      const { data, error } = await supabase.from("saved_searches").insert(row).select().single();
      if (!error && data) return dbRowToSavedSearch(data as Record<string, unknown>);
    }
  }

  // Fallback: localStorage
  return addSavedSearch(filters, locationLabel, customName);
}

/** Sync localStorage add (legacy) */
export function addSavedSearch(
  filters: SearchFilters,
  locationLabel?: string | null,
  customName?: string
): SavedSearch {
  const searches = getLocalSearches();
  const key = JSON.stringify(filters);
  const existing = searches.find((s) => JSON.stringify(s.filters) === key);
  if (existing) {
    existing.lastUsedAt = new Date().toISOString();
    saveLocalSearches(searches);
    return existing;
  }

  const search: SavedSearch = {
    id: crypto.randomUUID(),
    name: customName || generateSearchName(filters, locationLabel),
    filters,
    locationLabel,
    createdAt: new Date().toISOString(),
  };

  searches.unshift(search);
  if (searches.length > MAX_SAVED) searches.length = MAX_SAVED;
  saveLocalSearches(searches);
  return search;
}

/**
 * Remove a saved search. Logged-in → Supabase, otherwise → localStorage.
 */
export async function removeSavedSearchAsync(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (userId) {
    const supabase = getBrowserSupabase();
    if (supabase) {
      await supabase.from("saved_searches").delete().eq("id", id).eq("user_id", userId);
      return;
    }
  }
  removeSavedSearch(id);
}

/** Sync localStorage remove (legacy) */
export function removeSavedSearch(id: string): void {
  const searches = getLocalSearches().filter((s) => s.id !== id);
  saveLocalSearches(searches);
}

export function updateLastUsed(id: string): void {
  const searches = getLocalSearches();
  const s = searches.find((x) => x.id === id);
  if (s) {
    s.lastUsedAt = new Date().toISOString();
    saveLocalSearches(searches);
  }
}

// ===== Session storage (auto-save bridge) =====

export function saveCurrentSearch(filters: SearchFilters, locationLabel?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ filters, locationLabel }));
  } catch { /* ignore */ }
}

export function getCurrentSearch(): { filters: SearchFilters; locationLabel?: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ===== Name generation =====

const subtypesByCategory: Record<string, Record<string, string>> = {
  apartment: ApartmentSubtypes,
  house: HouseSubtypes,
  land: LandSubtypes,
  commercial: CommercialSubtypes,
  other: OtherSubtypes,
};

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis.`;
  return String(n);
}

export function generateSearchName(
  filters: SearchFilters,
  locationLabel?: string | null
): string {
  const parts: string[] = [];

  if (filters.listingType) {
    parts.push(ListingTypes[filters.listingType as ListingType] || filters.listingType);
  }

  const cats = filters.categories?.length ? filters.categories : filters.category ? [filters.category] : [];
  const subs = filters.subtypes?.length ? filters.subtypes : filters.subtype ? [filters.subtype] : [];
  if (subs.length) {
    const labels = subs.map((s) => {
      for (const cat of cats) {
        const catSubs = subtypesByCategory[cat] || {};
        if (catSubs[s]) return catSubs[s];
      }
      return s;
    });
    parts.push(labels.join(", "));
  } else if (cats.length) {
    parts.push(cats.map((c) => PropertyCategories[c as PropertyCategory] || c).join(", "));
  }

  if (locationLabel) {
    parts.push(locationLabel);
  }

  if (filters.priceMin || filters.priceMax) {
    const min = filters.priceMin ? formatPrice(filters.priceMin) : "0";
    const max = filters.priceMax ? formatPrice(filters.priceMax) : "\u221e";
    parts.push(`${min}–${max} Kč`);
  }

  if (filters.areaMin || filters.areaMax) {
    const min = filters.areaMin ? `${filters.areaMin}` : "0";
    const max = filters.areaMax ? `${filters.areaMax}` : "\u221e";
    parts.push(`${min}–${max} m²`);
  }

  return parts.length > 0 ? parts.join(", ") : "Všechny nabídky";
}

// ===== Filters ↔ URL params =====

export function filtersToSearchParams(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.listingType) p.set("listingType", filters.listingType);
  const cats = filters.categories?.length ? filters.categories : filters.category ? [filters.category] : [];
  if (cats.length) p.set("category", cats.join(","));
  const subs = filters.subtypes?.length ? filters.subtypes : filters.subtype ? [filters.subtype] : [];
  if (subs.length) p.set("subtype", subs.join(","));
  if (filters.city) p.set("city", filters.city);
  if (filters.priceMin) p.set("priceMin", String(filters.priceMin));
  if (filters.priceMax) p.set("priceMax", String(filters.priceMax));
  if (filters.areaMin) p.set("areaMin", String(filters.areaMin));
  if (filters.areaMax) p.set("areaMax", String(filters.areaMax));
  if (filters.sortBy) p.set("sortBy", filters.sortBy);
  return p;
}
