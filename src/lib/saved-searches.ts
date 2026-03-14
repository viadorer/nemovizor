import type { SavedSearch } from "@/lib/types";
import {
  ListingTypes, PropertyCategories,
  ApartmentSubtypes, HouseSubtypes, LandSubtypes, CommercialSubtypes, OtherSubtypes,
  type ListingType, type PropertyCategory,
} from "@/lib/types";

const STORAGE_KEY = "nemovizor_saved_searches";
const SESSION_KEY = "nemovizor_current_search";
const MAX_SAVED = 20;

// ===== Types =====
export type SearchFilters = SavedSearch["filters"];

// ===== localStorage CRUD =====

export function getSavedSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSavedSearch(
  filters: SearchFilters,
  locationLabel?: string | null,
  customName?: string
): SavedSearch {
  const searches = getSavedSearches();

  // Check for duplicate (same filters)
  const key = JSON.stringify(filters);
  const existing = searches.find((s) => JSON.stringify(s.filters) === key);
  if (existing) {
    existing.lastUsedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
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

  // Prune oldest beyond limit
  if (searches.length > MAX_SAVED) searches.length = MAX_SAVED;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  return search;
}

export function removeSavedSearch(id: string): void {
  const searches = getSavedSearches().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

export function updateLastUsed(id: string): void {
  const searches = getSavedSearches();
  const s = searches.find((x) => x.id === id);
  if (s) {
    s.lastUsedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
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

  if (filters.category) {
    const catLabel = PropertyCategories[filters.category as PropertyCategory];
    if (filters.subtype && filters.category) {
      const subs = subtypesByCategory[filters.category] || {};
      parts.push(subs[filters.subtype] || filters.subtype);
    } else if (catLabel) {
      parts.push(catLabel);
    }
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
  if (filters.category) p.set("category", filters.category);
  if (filters.subtype) p.set("subtype", filters.subtype);
  if (filters.city) p.set("city", filters.city);
  if (filters.priceMin) p.set("priceMin", String(filters.priceMin));
  if (filters.priceMax) p.set("priceMax", String(filters.priceMax));
  if (filters.areaMin) p.set("areaMin", String(filters.areaMin));
  if (filters.areaMax) p.set("areaMax", String(filters.areaMax));
  return p;
}
