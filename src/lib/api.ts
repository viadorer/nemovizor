// ============================================================
// Nemovizor – Unified Data API
// Automaticky volí Supabase (pokud nakonfigurován) nebo mock data
// ============================================================

import { isSupabaseConfigured } from "./supabase";
import * as supabaseData from "./supabase-data";
import * as mockData from "./data";
import type { Property, Broker, Agency, Branch, Review, PropertyFilters } from "./types";

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

/** Format ceny (sync – nepotřebuje DB) */
export { formatPrice } from "./data";
