// ============================================================
// Nemovizor – Unified Data API
// Automaticky volí Supabase (pokud nakonfigurován) nebo mock data
// ============================================================

import { isSupabaseConfigured } from "./supabase";
import * as supabaseData from "./supabase-data";
import * as mockData from "./data";
import type { Property, Broker, PropertyFilters } from "./types";

/** Je aplikace napojena na DB? */
export const isLive = isSupabaseConfigured;

/** Všechny nemovitosti (s filtry) */
export async function getProperties(filters?: PropertyFilters): Promise<Property[]> {
  if (isLive) return supabaseData.fetchProperties(filters);
  return mockData.filterProperties(filters ?? {});
}

/** Prémiové nabídky */
export async function getFeaturedProperties(): Promise<Property[]> {
  if (isLive) return supabaseData.fetchFeaturedProperties();
  return mockData.properties.filter((p) => p.featured);
}

/** Nejnovější nabídky */
export async function getLatestProperties(): Promise<Property[]> {
  if (isLive) {
    // V Supabase vrátíme nefeatured, seřazené dle data
    return supabaseData.fetchProperties();
  }
  return mockData.latestProperties;
}

/** Detail nemovitosti */
export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  if (isLive) return supabaseData.fetchPropertyBySlug(slug);
  return mockData.getPropertyBySlug(slug) ?? null;
}

/** Podobné nemovitosti */
export async function getSimilarProperties(slug: string, city: string): Promise<Property[]> {
  if (isLive) return supabaseData.fetchSimilarProperties(slug, city);
  return mockData.getSimilarProperties(slug, city);
}

/** Unikátní města */
export async function getUniqueCities(): Promise<string[]> {
  if (isLive) return supabaseData.fetchUniqueCities();
  return mockData.getUniqueCities();
}

/** Všichni makléři */
export async function getBrokers(): Promise<Broker[]> {
  if (isLive) return supabaseData.fetchBrokers();
  return mockData.brokers;
}

/** Makléř podle ID */
export async function getBrokerById(id: string): Promise<Broker | null> {
  if (isLive) return supabaseData.fetchBrokerById(id);
  return mockData.getBrokerById(id) ?? null;
}

/** Format ceny (sync – nepotřebuje DB) */
export { formatPrice } from "./data";
