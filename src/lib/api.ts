// ============================================================
// Nemovizor – Unified Data API
// Automaticky volí Supabase (pokud nakonfigurován) nebo mock data
// ============================================================

import { isSupabaseConfigured } from "./supabase";
import * as supabaseData from "./supabase-data";
import * as mockData from "./data";
import type { Property, Broker, Agency, Branch, Review, PropertyFilters } from "./types";
import type { DetailPropertyFilters } from "./supabase-data";

/** Je aplikace napojena na DB? */
export const isLive = isSupabaseConfigured;

// ===== Properties =====

export async function getProperties(filters?: PropertyFilters): Promise<Property[]> {
  if (isLive) return supabaseData.fetchProperties(filters);
  return mockData.filterProperties(filters ?? {});
}

export async function getFeaturedProperties(): Promise<Property[]> {
  if (isLive) return supabaseData.fetchFeaturedProperties();
  return mockData.properties.filter((p) => p.featured);
}

export async function getLatestProperties(): Promise<Property[]> {
  if (isLive) return supabaseData.fetchProperties();
  return mockData.latestProperties;
}

export async function getAllProperties(): Promise<Property[]> {
  if (isLive) return supabaseData.fetchProperties();
  return [...mockData.properties, ...mockData.latestProperties];
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  if (isLive) return supabaseData.fetchPropertyBySlug(slug);
  return mockData.getPropertyBySlug(slug) ?? null;
}

export async function getSimilarProperties(slug: string, city: string): Promise<Property[]> {
  if (isLive) return supabaseData.fetchSimilarProperties(slug, city);
  return mockData.getSimilarProperties(slug, city);
}

export async function getAdjacentProperties(propertyId: string) {
  if (isLive) return supabaseData.fetchAdjacentProperties(propertyId);
  return { prev: null, next: null };
}

export async function getUniqueCities(): Promise<string[]> {
  if (isLive) return supabaseData.fetchUniqueCities();
  return mockData.getUniqueCities();
}

// ===== Brokers =====

export async function getBrokers(): Promise<Broker[]> {
  if (isLive) return supabaseData.fetchBrokers();
  return mockData.brokers;
}

export async function getBrokerById(id: string): Promise<Broker | null> {
  if (isLive) return supabaseData.fetchBrokerById(id);
  return mockData.getBrokerById(id) ?? null;
}

export async function getBrokerBySlug(slug: string): Promise<Broker | null> {
  if (isLive) return supabaseData.fetchBrokerBySlug(slug);
  return mockData.getBrokerBySlug(slug) ?? null;
}

export async function getBrokerProperties(brokerId: string): Promise<Property[]> {
  if (isLive) return supabaseData.fetchBrokerProperties(brokerId);
  return mockData.getBrokerProperties(brokerId);
}

export async function getBrokerReviews(brokerId: string): Promise<Review[]> {
  if (isLive) return supabaseData.fetchBrokerReviews(brokerId);
  return mockData.getBrokerReviews(brokerId);
}

export async function getBrokerCities(brokerId: string): Promise<string[]> {
  if (isLive) {
    const props = await supabaseData.fetchBrokerProperties(brokerId);
    return [...new Set(props.map((p) => p.city))].sort();
  }
  return mockData.getBrokerCities(brokerId);
}

// ===== Agencies =====

export async function getAgencies(): Promise<Agency[]> {
  if (isLive) return supabaseData.fetchAgencies();
  return mockData.getAllAgencies();
}

export async function getAgencyById(id: string): Promise<Agency | null> {
  if (isLive) return supabaseData.fetchAgencyById(id);
  return mockData.getAgencyById(id) ?? null;
}

export async function getAgencyBySlug(slug: string): Promise<Agency | null> {
  if (isLive) return supabaseData.fetchAgencyBySlug(slug);
  return mockData.getAgencyBySlug(slug) ?? null;
}

export async function getAgencyBrokers(agencyId: string): Promise<Broker[]> {
  if (isLive) return supabaseData.fetchAgencyBrokers(agencyId);
  return mockData.getAgencyBrokers(agencyId);
}

export async function getAgencyBranches(agencyId: string): Promise<Branch[]> {
  if (isLive) return supabaseData.fetchAgencyBranches(agencyId);
  return mockData.getAgencyBranches(agencyId);
}

export async function getAgencyProperties(agencyId: string): Promise<Property[]> {
  if (isLive) return supabaseData.fetchAgencyProperties(agencyId);
  return mockData.getAgencyProperties(agencyId);
}

export async function getAgencyReviews(agencyId: string): Promise<Review[]> {
  if (isLive) return supabaseData.fetchAgencyReviews(agencyId);
  return mockData.getAgencyReviews(agencyId);
}

// ===== Recent Sales =====

export async function getBrokerRecentSales(brokerId: string): Promise<import("./types").RecentSale[]> {
  if (!isLive) return [];
  return supabaseData.fetchRecentSales("broker", brokerId);
}

export async function getAgencyRecentSales(agencyId: string): Promise<import("./types").RecentSale[]> {
  if (!isLive) return [];
  return supabaseData.fetchRecentSales("agency", agencyId);
}

// ===== Branches =====

export async function getAllBranches(): Promise<Branch[]> {
  if (isLive) return supabaseData.fetchAllBranches();
  return mockData.branches;
}

// ===== Utility =====

export async function getAllBrokerActiveCities(): Promise<string[]> {
  if (isLive) return supabaseData.fetchAllBrokerCities();
  return mockData.getAllBrokerActiveCities();
}

export async function getAllBranchCities(): Promise<string[]> {
  if (isLive) return supabaseData.fetchAllBranchCities();
  return mockData.getAllBranchCities();
}

export async function getAllLocationCities(): Promise<string[]> {
  if (isLive) {
    const [brokerCities, branchCities] = await Promise.all([
      supabaseData.fetchAllBrokerCities(),
      supabaseData.fetchAllBranchCities(),
    ]);
    return [...new Set([...brokerCities, ...branchCities])].sort();
  }
  return mockData.getAllLocationCities();
}

export async function getAllSpecializations(): Promise<string[]> {
  if (isLive) return supabaseData.fetchAllSpecializations();
  return mockData.getAllSpecializations();
}

export async function getAgencyCities(agencyId: string): Promise<string[]> {
  if (isLive) {
    const branches = await supabaseData.fetchAgencyBranches(agencyId);
    return [...new Set(branches.map((b) => b.city))].sort();
  }
  return mockData.getAgencyCities(agencyId);
}

export async function getAgencyBranchCities(agencyId: string): Promise<string[]> {
  if (isLive) {
    const branches = await supabaseData.fetchAgencyBranches(agencyId);
    return [...new Set(branches.map((b) => b.city))].sort();
  }
  return mockData.getAgencyBranchCities(agencyId);
}

// ===== Bulk city maps =====

export async function getBrokerCitiesMap(): Promise<Record<string, string[]>> {
  if (isLive) return supabaseData.fetchBrokerCitiesMap();
  // Mock fallback: build from properties
  const brokers = mockData.brokers;
  const map: Record<string, string[]> = {};
  for (const b of brokers) {
    const props = mockData.getBrokerProperties(b.id);
    map[b.id] = [...new Set(props.map((p) => p.city))];
  }
  return map;
}

export async function getBranchCitiesMap(): Promise<Record<string, string[]>> {
  if (isLive) return supabaseData.fetchBranchCitiesMap();
  const map: Record<string, string[]> = {};
  for (const b of mockData.branches) {
    const arr = (map[b.agencyId] ??= []);
    if (!arr.includes(b.city)) arr.push(b.city);
  }
  return map;
}

// ===== Paginated fetches for detail pages =====

type PaginatedResult<T> = { items: T[]; total: number };

export type { DetailPropertyFilters } from "./supabase-data";

export async function getBrokerPropertiesPaginated(
  brokerId: string,
  page: number,
  perPage: number,
  filters?: DetailPropertyFilters
): Promise<PaginatedResult<Property>> {
  if (isLive) return supabaseData.fetchBrokerPropertiesPaginated(brokerId, page, perPage, filters);
  const all = mockData.getBrokerProperties(brokerId);
  const start = (page - 1) * perPage;
  return { items: all.slice(start, start + perPage), total: all.length };
}

export async function getAgencyPropertiesPaginated(
  agencyId: string,
  page: number,
  perPage: number,
  filters?: DetailPropertyFilters
): Promise<PaginatedResult<Property>> {
  if (isLive) return supabaseData.fetchAgencyPropertiesPaginated(agencyId, page, perPage, filters);
  const all = mockData.getAgencyProperties(agencyId);
  const start = (page - 1) * perPage;
  return { items: all.slice(start, start + perPage), total: all.length };
}

/** Format ceny (sync – nepotřebuje DB) */
export { formatPrice } from "./data";
