/**
 * Zod schemas for the Import API.
 * CRM-agnostic: uses Nemovizor-native field names and enum values.
 */
import { z } from "zod";

// ─── Entity schemas ───────────────────────────────────────────────────────

export const ImportImageSchema = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
  order: z.number().int().nonnegative().optional(),
});

export const ImportAgencySchema = z.object({
  external_id: z.string().min(1).max(255),
  name: z.string().min(1).max(500),
  logo: z.string().url().optional(),
  description: z.string().max(10000).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  seat_city: z.string().max(200).optional(),
  seat_address: z.string().max(500).optional(),
  founded_year: z.number().int().min(1800).max(2100).optional(),
  specializations: z.array(z.string()).optional(),
}).passthrough();

export const ImportBranchSchema = z.object({
  external_id: z.string().min(1).max(255),
  name: z.string().min(1).max(500),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  zip: z.string().max(20).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_headquarters: z.boolean().optional(),
}).passthrough();

export const ImportBrokerSchema = z.object({
  external_id: z.string().min(1).max(255),
  name: z.string().min(1).max(500),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  photo: z.string().url().optional(),
  title: z.string().max(200).optional(),
  bio: z.string().max(10000).optional(),
  specialization: z.string().max(200).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  year_started: z.number().int().min(1950).max(2100).optional(),
  branch_external_id: z.string().max(255).optional(),
  linkedin: z.string().url().optional(),
  instagram: z.string().max(200).optional(),
  facebook: z.string().url().optional(),
  website: z.string().url().optional(),
}).passthrough();

export const ImportPropertySchema = z.object({
  external_id: z.string().min(1).max(255),
  // Required
  title: z.string().min(1).max(1000),
  listing_type: z.enum(["sale", "rent", "auction", "shares", "project"]),
  category: z.enum(["apartment", "house", "land", "commercial", "other"]),
  // Location
  city: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  street: z.string().max(500).optional(),
  zip: z.string().max(20).optional(),
  region: z.string().max(200).optional(),
  country: z.string().max(5).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // Price
  price: z.number().nonnegative().optional(),
  price_currency: z.enum(["czk", "eur", "usd", "gbp"]).optional(),
  price_unit: z.string().max(50).optional(),
  price_note: z.string().max(500).optional(),
  // Areas
  area: z.number().nonnegative().optional(),
  land_area: z.number().nonnegative().optional(),
  floor_area: z.number().nonnegative().optional(),
  garden_area: z.number().nonnegative().optional(),
  balcony_area: z.number().nonnegative().optional(),
  terrace_area: z.number().nonnegative().optional(),
  cellar_area: z.number().nonnegative().optional(),
  // Description
  subtype: z.string().max(100).optional(),
  rooms_label: z.string().max(50).optional(),
  summary: z.string().max(1000).optional(),
  description: z.string().max(50000).optional(),
  // Parameters
  condition: z.string().max(50).optional(),
  ownership: z.string().max(50).optional(),
  furnishing: z.string().max(50).optional(),
  energy_rating: z.enum(["A", "B", "C", "D", "E", "F", "G"]).optional(),
  building_material: z.string().max(50).optional(),
  floor: z.number().int().optional(),
  total_floors: z.number().int().optional(),
  year_built: z.number().int().min(1000).max(2100).optional(),
  // Amenities
  balcony: z.boolean().optional(),
  terrace: z.boolean().optional(),
  garden: z.boolean().optional(),
  elevator: z.boolean().optional(),
  cellar: z.boolean().optional(),
  garage: z.boolean().optional(),
  pool: z.boolean().optional(),
  parking: z.string().max(50).optional(),
  parking_spaces: z.number().int().nonnegative().optional(),
  // Media
  images: z.array(ImportImageSchema).max(50).optional(),
  matterport_url: z.string().url().optional(),
  // Broker linkage
  broker_external_id: z.string().max(255).optional(),
  // Status
  active: z.boolean().optional().default(true),
}).passthrough();

// ─── Batch payload ────────────────────────────────────────────────────────

export const ImportBatchBodySchema = z.object({
  agency: ImportAgencySchema.optional(),
  branches: z.array(ImportBranchSchema).max(100).optional(),
  brokers: z.array(ImportBrokerSchema).max(500).optional(),
  properties: z.array(ImportPropertySchema).max(500).optional(),
  external_source: z.string().min(1).max(100).optional().default("api"),
  deactivate_missing: z.boolean().optional().default(false),
  callback_url: z.string().url().optional(),
});

// ─── Response schemas ─────────────────────────────────────────────────────

export const ImportJobItemResultSchema = z.object({
  external_id: z.string(),
  entity_type: z.enum(["agency", "branch", "broker", "property"]),
  status: z.enum(["success", "warning", "error", "skipped"]),
  nemovizor_id: z.string().uuid().nullable(),
  nemovizor_slug: z.string().nullable(),
  action: z.enum(["created", "updated", "unchanged", "deactivated"]).nullable(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  processing_time_ms: z.number().int().nullable(),
});

export const ImportJobStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  external_source: z.string(),
  total_items: z.number().int(),
  completed_items: z.number().int(),
  failed_items: z.number().int(),
  warned_items: z.number().int(),
  skipped_items: z.number().int(),
  payload_summary: z.record(z.string(), z.number().int()).optional(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  items: z.array(ImportJobItemResultSchema).optional(),
});

export const ImportBatchResponseSchema = z.object({
  job_id: z.string().uuid(),
  status: z.literal("pending"),
  total_items: z.number().int(),
  poll_url: z.string(),
});
