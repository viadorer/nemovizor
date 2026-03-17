// ============================================================
// Nemovizor – Realman Import Service
// Příjem a parsování nabídek z Realman systému (JSON API)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadFile, isR2Configured } from "./r2";

// ===== Typy pro Realman data =====

export interface RealmanEstate {
  id: number;
  title: string;
  advert_type?: number;
  advert_function?: number;
  advert_subtype?: number;
  category_main_cb?: number;
  category_type_cb?: number;
  category_sub_cb?: number;
  advert_code?: string;
  description?: string;
  price?: number;
  advert_price?: number;
  price_note?: string;
  advert_price_text_note?: string;
  price_unit?: string;
  price_currency?: string;
  area?: number;
  usable_area?: number;
  area_built?: number;
  building_area?: number;
  area_land?: number;
  estate_area?: number;
  floor_area?: number;
  balcony_area?: number;
  basin_area?: number;
  cellar_area?: number;
  garden_area?: number;
  loggia_area?: number;
  terrace_area?: number;
  nolive_total_area?: number;
  offices_area?: number;
  production_area?: number;
  shop_area?: number;
  store_area?: number;
  workshop_area?: number;
  locality_region?: string;
  locality_district?: string;
  locality_city?: string;
  locality_city_part?: string;
  locality_citypart?: string;
  locality_street?: string;
  locality_street_number?: string;
  locality_zip?: string | number;
  locality_kraj_kod?: number;
  locality_okres_kod?: number;
  locality_inaccuracy_level?: number;
  gps_lat?: number;
  gps_lon?: number;
  locality_latitude?: number;
  locality_longitude?: number;
  disposition?: string;
  floor?: number;
  floor_number?: number;
  floor_total?: number;
  floors?: number;
  underground_floors?: number;
  ceiling_height?: number;
  construction?: number;
  building_type?: number;
  state?: number;
  building_condition?: number;
  ownership?: number;
  equipped?: number;
  furnished?: number;
  parking?: number;
  parking_spaces?: number;
  garage_count?: number;
  balcony?: number;
  terrace?: number;
  loggia?: number;
  garage?: number;
  cellar?: number;
  elevator?: number;
  easy_access?: number;
  basin?: number;
  low_energy?: number;
  ftv_panels?: number;
  solar_panels?: number;
  object_type?: number;
  object_kind?: number;
  object_location?: number;
  flat_class?: number;
  surroundings_type?: number;
  protection?: number;
  circuit_breaker?: number;
  phase_distribution?: number;
  energy_efficiency_rating?: number;
  energy_performance_summary?: string;
  energy_performance_attachment?: string;
  heating?: number[];
  heating_element?: number[];
  heating_source?: number[];
  water_heat_source?: number[];
  electricity?: number[];
  gas?: number[];
  water?: number[];
  gully?: number[];
  road_type?: number[];
  telecommunication?: number[];
  transport?: number[];
  internet_connection_type?: number[];
  well_type?: number[];
  internet_connection_provider?: string;
  internet_connection_speed?: number;
  annuity?: number;
  cost_of_living?: string;
  commission?: number;
  mortgage_percent?: number;
  spor_percent?: number;
  refundable_deposit?: number;
  lease_type?: number;
  tenant_not_pay_commission?: number;
  ready_date?: string;
  auction_kind?: number;
  auction_date?: string;
  auction_place?: string;
  price_auction_principal?: number;
  price_expert_report?: number;
  price_minimum_bid?: number;
  share_numerator?: number;
  share_denominator?: number;
  year_built?: number;
  acceptance_year?: number;
  last_renovation?: number;
  beginning_date?: string;
  finish_date?: string;
  sale_date?: string;
  first_tour_date?: string;
  exclusively_at_rk?: number;
  personal_transfer?: number;
  num_owners?: number;
  matterport_url?: string;
  mapy_panorama_url?: string;
  keywords?: string[];
  apartment_number?: number;
  advert_room_count?: number;
  flooring?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface RealmanSeller {
  id: number;
  title?: string;
  name: string;
  surname: string;
  cell?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
}

export interface RealmanPhoto {
  url: string;
  hash: string;
  updated: string;
  title?: string;
  order: number;
}

export interface RealmanVideo {
  title?: string;
  updated: string;
  url?: string;
  hash?: string;
}

export interface RealmanImportData {
  estate: RealmanEstate;
  estate_readable?: unknown;
  seller: RealmanSeller;
  photos: RealmanPhoto[] | Record<string, RealmanPhoto>;
  videos?: RealmanVideo[] | Record<string, RealmanVideo>;
}

// ===== Import Service =====

export class RealmanImportService {
  constructor(private supabase: SupabaseClient) {}

  async importEstate(realmanId: number, data: RealmanImportData): Promise<{ propertyId: string; slug: string }> {
    const startTime = Date.now();
    const warnings: string[] = [];
    let brokerId: string | null = null;

    try {
      // Check if property already exists
      const { data: existing, error: findError } = await this.supabase
        .from("properties")
        .select("id, slug")
        .eq("external_id", realmanId.toString())
        .maybeSingle();

      if (findError && findError.code !== "PGRST116") throw findError;

      let propertyId: string;
      let slug: string;
      const importType = existing ? "update" : "create";

      if (existing) {
        propertyId = existing.id;
        slug = existing.slug;
        await this.updateProperty(propertyId, data);
      } else {
        const result = await this.createProperty(realmanId, data);
        propertyId = result.id;
        slug = result.slug;
      }

      // Handle broker
      const brokerResult = await this.handleBroker(propertyId, data.seller);
      if (brokerResult.warning) warnings.push(brokerResult.warning);
      brokerId = brokerResult.brokerId;

      // Handle photos - Realman sends as object, convert to array
      let photosCount = 0;
      if (data.photos && typeof data.photos === "object") {
        const photosArray = Array.isArray(data.photos) ? data.photos : Object.values(data.photos);
        if (photosArray.length > 0) {
          const photoResult = await this.handlePhotos(propertyId, photosArray);
          photosCount = photoResult.successCount;
          if (photoResult.warnings.length > 0) warnings.push(...photoResult.warnings);
        }
      }

      // Handle videos
      let videosCount = 0;
      if (data.videos && typeof data.videos === "object") {
        const videosArray = Array.isArray(data.videos) ? data.videos : Object.values(data.videos);
        if (videosArray.length > 0) {
          const videoResult = await this.handleVideos(propertyId, videosArray);
          videosCount = videoResult.count;
          if (videoResult.warnings.length > 0) warnings.push(...videoResult.warnings);
        }
      }

      const processingTime = Date.now() - startTime;

      await this.logImport({
        externalId: realmanId.toString(),
        importType,
        status: warnings.length > 0 ? "warning" : "success",
        propertyId,
        brokerId,
        rawData: data,
        processedData: { slug, photosCount, videosCount },
        warningMessages: warnings.length > 0 ? warnings : null,
        photosCount,
        videosCount,
        processingTimeMs: processingTime,
      });

      return { propertyId, slug };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this.logImport({
        externalId: realmanId.toString(),
        importType: "create",
        status: "error",
        propertyId: null,
        brokerId: null,
        rawData: data,
        processedData: null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        warningMessages: warnings.length > 0 ? warnings : null,
        photosCount: 0,
        videosCount: 0,
        processingTimeMs: processingTime,
      });

      throw error;
    }
  }

  async deleteEstate(realmanId: number): Promise<void> {
    const startTime = Date.now();

    try {
      const { data: property, error: findError } = await this.supabase
        .from("properties")
        .select("id")
        .eq("external_id", realmanId.toString())
        .maybeSingle();

      if (findError && findError.code !== "PGRST116") throw findError;

      if (!property) {
        await this.logImport({
          externalId: realmanId.toString(),
          importType: "delete",
          status: "warning",
          propertyId: null,
          brokerId: null,
          rawData: null,
          processedData: { alreadyDeleted: true },
          warningMessages: ["Property not found - may have been already deleted"],
          photosCount: 0,
          videosCount: 0,
          processingTimeMs: Date.now() - startTime,
        });
        return;
      }

      // Soft-delete: set active = false
      await this.supabase
        .from("properties")
        .update({ active: false, extra_info: "prodano" })
        .eq("id", property.id);

      await this.logImport({
        externalId: realmanId.toString(),
        importType: "delete",
        status: "success",
        propertyId: property.id,
        brokerId: null,
        rawData: null,
        processedData: { deleted: true },
        warningMessages: null,
        photosCount: 0,
        videosCount: 0,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      await this.logImport({
        externalId: realmanId.toString(),
        importType: "delete",
        status: "error",
        propertyId: null,
        brokerId: null,
        rawData: null,
        processedData: null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        warningMessages: null,
        photosCount: 0,
        videosCount: 0,
        processingTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  // ===== Private methods =====

  private async createProperty(realmanId: number, data: RealmanImportData): Promise<{ id: string; slug: string }> {
    const estate = data.estate;
    const slug = await this.generateUniqueSlug(estate.title);
    const advertSubtype = estate.advert_subtype ?? estate.category_sub_cb;
    const category = this.mapCategory(estate.advert_type);

    const propertyData = {
      external_id: realmanId.toString(),
      external_source: "realman",
      slug,
      title: estate.title || "",
      listing_type: this.mapListingType(estate.advert_function),
      category,
      subtype: this.mapSubtype(category, advertSubtype) || "",
      rooms_label: category === "apartment" ? (this.mapDisposition(advertSubtype) || estate.disposition || "") : (estate.disposition || ""),
      summary: (estate.description || "").slice(0, 300),
      description: estate.description || null,

      // Price
      price: estate.price || estate.advert_price || 0,
      price_note: estate.price_note || estate.advert_price_text_note || null,

      // Location
      city: estate.locality_city || "",
      district: estate.locality_district || "",
      street: estate.locality_street || null,
      zip: estate.locality_zip?.toString() || null,
      region: estate.locality_region || null,
      city_part: estate.locality_city_part || estate.locality_citypart || null,
      location_label: [estate.locality_street, estate.locality_city].filter(Boolean).join(", "),
      latitude: estate.gps_lat || estate.locality_latitude || 0,
      longitude: estate.gps_lon || estate.locality_longitude || 0,

      // Areas
      area: estate.area || estate.usable_area || 0,
      land_area: estate.area_land || estate.estate_area || null,
      built_up_area: estate.area_built || estate.building_area || null,
      floor_area: estate.floor_area || null,
      balcony_area: estate.balcony_area || null,
      basin_area: estate.basin_area || null,
      cellar_area: estate.cellar_area || null,
      garden_area: estate.garden_area || null,
      loggia_area: estate.loggia_area || null,
      terrace_area: estate.terrace_area || null,
      nolive_total_area: estate.nolive_total_area || null,
      offices_area: estate.offices_area || null,
      production_area: estate.production_area || null,
      shop_area: estate.shop_area || null,
      store_area: estate.store_area || null,
      workshop_area: estate.workshop_area || null,

      // Condition & parameters
      condition: this.mapCondition(estate.state || estate.building_condition),
      ownership: this.mapOwnership(estate.ownership),
      furnishing: this.mapFurnishing(estate.equipped || estate.furnished),
      energy_rating: this.mapEnergyRating(estate.energy_efficiency_rating),
      building_material: this.mapBuildingMaterial(estate.construction || estate.building_type),
      flooring: estate.flooring || null,

      // Heating (multiselect arrays)
      heating: this.mapHeating(estate.heating),
      heating_element: this.mapHeatingElement(estate.heating_element),
      heating_source: this.mapHeatingSource(estate.heating_source),
      water_heat_source: this.mapArray(estate.water_heat_source, WATER_HEAT_SOURCE_MAP),

      // House-specific enums
      object_type: this.mapObjectType(estate.object_type),
      object_kind: this.mapObjectKind(estate.object_kind),
      object_location: this.mapObjectLocation(estate.object_location),
      flat_class: this.mapFlatClass(estate.flat_class),

      // Floors
      floor: estate.floor ?? estate.floor_number ?? null,
      total_floors: estate.floor_total ?? estate.floors ?? null,
      underground_floors: estate.underground_floors || null,
      ceiling_height: estate.ceiling_height || null,

      // Parking
      parking: this.mapParking(estate.parking),
      parking_spaces: estate.parking_spaces || null,
      garage_count: estate.garage_count || null,

      // Amenities
      balcony: estate.balcony === 1,
      terrace: estate.terrace === 1,
      garden: (estate.garden_area && estate.garden_area > 0) || false,
      elevator: estate.elevator === 1,
      cellar: estate.cellar === 1,
      garage: estate.garage === 1,
      pool: estate.basin === 1,
      loggia: estate.loggia === 1,
      easy_access: estate.easy_access === 1 ? "ano" : estate.easy_access === 2 ? "ne" : null,
      low_energy: estate.low_energy === 1 || null,
      ftv_panels: estate.ftv_panels === 1 || null,
      solar_panels: estate.solar_panels === 1 || null,

      // Infrastructure (multiselect)
      electricity: this.mapElectricity(estate.electricity),
      gas: this.mapGas(estate.gas),
      water: this.mapWater(estate.water),
      gully: this.mapGully(estate.gully),
      road_type: this.mapRoadType(estate.road_type),
      telecommunication: this.mapTelecommunication(estate.telecommunication),
      transport: this.mapTransport(estate.transport),
      internet_connection_type: this.mapArray(estate.internet_connection_type, INTERNET_MAP),
      well_type: this.mapArray(estate.well_type, WELL_TYPE_MAP),

      // Internet
      internet_connection_provider: estate.internet_connection_provider || null,
      internet_connection_speed: estate.internet_connection_speed || null,

      // Surroundings
      surroundings_type: this.mapSurroundings(estate.surroundings_type),
      protection: this.mapProtection(estate.protection),

      // Electrical
      circuit_breaker: this.mapCircuitBreaker(estate.circuit_breaker),
      phase_distribution: this.mapPhaseDistribution(estate.phase_distribution),

      // Financial
      annuity: estate.annuity || null,
      cost_of_living: estate.cost_of_living || null,
      commission: estate.commission || null,
      mortgage_percent: estate.mortgage_percent || null,
      spor_percent: estate.spor_percent || null,
      refundable_deposit: estate.refundable_deposit || null,

      // Rental
      lease_type: this.mapLeaseType(estate.lease_type),
      tenant_not_pay_commission: estate.tenant_not_pay_commission === 1 || null,
      ready_date: estate.ready_date || null,

      // Auction
      auction_kind: this.mapAuctionKind(estate.auction_kind),
      auction_date: estate.auction_date || null,
      auction_place: estate.auction_place || null,
      price_auction_principal: estate.price_auction_principal || null,
      price_expert_report: estate.price_expert_report || null,
      price_minimum_bid: estate.price_minimum_bid || null,

      // Shares
      share_numerator: estate.share_numerator || null,
      share_denominator: estate.share_denominator || null,

      // Age
      year_built: estate.year_built && estate.year_built > 0 ? estate.year_built : null,
      last_renovation: estate.last_renovation && estate.last_renovation > 0 ? estate.last_renovation : null,
      acceptance_year: estate.acceptance_year && estate.acceptance_year > 0 ? estate.acceptance_year : null,

      // Construction dates
      beginning_date: estate.beginning_date || null,
      finish_date: estate.finish_date || null,
      sale_date: estate.sale_date || null,
      first_tour_date: estate.first_tour_date || null,

      // Status
      exclusively_at_rk: estate.exclusively_at_rk === 1 || null,
      personal_transfer: estate.personal_transfer === 1 ? "ano" : estate.personal_transfer === 2 ? "ne" : null,
      num_owners: estate.num_owners || null,

      // VR
      matterport_url: estate.matterport_url || null,
      mapy_panorama_url: estate.mapy_panorama_url || null,

      // Keywords
      keywords: estate.keywords || null,
      apartment_number: estate.apartment_number || null,

      // Media (will be populated by handlePhotos)
      image_src: "",
      image_alt: estate.title || "",
      images: [],

      // Status
      active: true,
      featured: false,
    };

    const { data: property, error } = await this.supabase
      .from("properties")
      .insert(propertyData)
      .select("id, slug")
      .single();

    if (error) throw new Error(`Failed to create property: ${error.message}`);
    return property;
  }

  private async updateProperty(propertyId: string, data: RealmanImportData): Promise<void> {
    const estate = data.estate;
    const advertSubtype = estate.advert_subtype ?? estate.category_sub_cb;
    const category = this.mapCategory(estate.advert_type);

    // NOTE: slug is NOT updated to preserve SEO and existing URLs
    const propertyData = {
      title: estate.title || "",
      listing_type: this.mapListingType(estate.advert_function),
      category,
      subtype: this.mapSubtype(category, advertSubtype) || "",
      rooms_label: category === "apartment" ? (this.mapDisposition(advertSubtype) || estate.disposition || "") : (estate.disposition || ""),
      summary: (estate.description || "").slice(0, 300),
      description: estate.description || null,

      price: estate.price || estate.advert_price || 0,
      price_note: estate.price_note || estate.advert_price_text_note || null,

      city: estate.locality_city || "",
      district: estate.locality_district || "",
      street: estate.locality_street || null,
      zip: estate.locality_zip?.toString() || null,
      region: estate.locality_region || null,
      city_part: estate.locality_city_part || estate.locality_citypart || null,
      location_label: [estate.locality_street, estate.locality_city].filter(Boolean).join(", "),
      latitude: estate.gps_lat || estate.locality_latitude || 0,
      longitude: estate.gps_lon || estate.locality_longitude || 0,

      area: estate.area || estate.usable_area || 0,
      land_area: estate.area_land || estate.estate_area || null,
      built_up_area: estate.area_built || estate.building_area || null,
      floor_area: estate.floor_area || null,
      balcony_area: estate.balcony_area || null,
      basin_area: estate.basin_area || null,
      cellar_area: estate.cellar_area || null,
      garden_area: estate.garden_area || null,
      loggia_area: estate.loggia_area || null,
      terrace_area: estate.terrace_area || null,
      nolive_total_area: estate.nolive_total_area || null,
      offices_area: estate.offices_area || null,
      production_area: estate.production_area || null,
      shop_area: estate.shop_area || null,
      store_area: estate.store_area || null,
      workshop_area: estate.workshop_area || null,

      condition: this.mapCondition(estate.state || estate.building_condition),
      ownership: this.mapOwnership(estate.ownership),
      furnishing: this.mapFurnishing(estate.equipped || estate.furnished),
      energy_rating: this.mapEnergyRating(estate.energy_efficiency_rating),
      building_material: this.mapBuildingMaterial(estate.construction || estate.building_type),
      flooring: estate.flooring || null,

      heating: this.mapHeating(estate.heating),
      heating_element: this.mapHeatingElement(estate.heating_element),
      heating_source: this.mapHeatingSource(estate.heating_source),
      water_heat_source: this.mapArray(estate.water_heat_source, WATER_HEAT_SOURCE_MAP),

      object_type: this.mapObjectType(estate.object_type),
      object_kind: this.mapObjectKind(estate.object_kind),
      object_location: this.mapObjectLocation(estate.object_location),
      flat_class: this.mapFlatClass(estate.flat_class),

      floor: estate.floor ?? estate.floor_number ?? null,
      total_floors: estate.floor_total ?? estate.floors ?? null,
      underground_floors: estate.underground_floors || null,
      ceiling_height: estate.ceiling_height || null,

      parking: this.mapParking(estate.parking),
      parking_spaces: estate.parking_spaces || null,
      garage_count: estate.garage_count || null,

      balcony: estate.balcony === 1,
      terrace: estate.terrace === 1,
      garden: (estate.garden_area && estate.garden_area > 0) || false,
      elevator: estate.elevator === 1,
      cellar: estate.cellar === 1,
      garage: estate.garage === 1,
      pool: estate.basin === 1,
      loggia: estate.loggia === 1,
      easy_access: estate.easy_access === 1 ? "ano" : estate.easy_access === 2 ? "ne" : null,
      low_energy: estate.low_energy === 1 || null,
      ftv_panels: estate.ftv_panels === 1 || null,
      solar_panels: estate.solar_panels === 1 || null,

      electricity: this.mapElectricity(estate.electricity),
      gas: this.mapGas(estate.gas),
      water: this.mapWater(estate.water),
      gully: this.mapGully(estate.gully),
      road_type: this.mapRoadType(estate.road_type),
      telecommunication: this.mapTelecommunication(estate.telecommunication),
      transport: this.mapTransport(estate.transport),
      internet_connection_type: this.mapArray(estate.internet_connection_type, INTERNET_MAP),
      well_type: this.mapArray(estate.well_type, WELL_TYPE_MAP),

      internet_connection_provider: estate.internet_connection_provider || null,
      internet_connection_speed: estate.internet_connection_speed || null,

      surroundings_type: this.mapSurroundings(estate.surroundings_type),
      protection: this.mapProtection(estate.protection),
      circuit_breaker: this.mapCircuitBreaker(estate.circuit_breaker),
      phase_distribution: this.mapPhaseDistribution(estate.phase_distribution),

      annuity: estate.annuity || null,
      cost_of_living: estate.cost_of_living || null,
      commission: estate.commission || null,
      mortgage_percent: estate.mortgage_percent || null,
      spor_percent: estate.spor_percent || null,
      refundable_deposit: estate.refundable_deposit || null,

      lease_type: this.mapLeaseType(estate.lease_type),
      tenant_not_pay_commission: estate.tenant_not_pay_commission === 1 || null,
      ready_date: estate.ready_date || null,

      auction_kind: this.mapAuctionKind(estate.auction_kind),
      auction_date: estate.auction_date || null,
      auction_place: estate.auction_place || null,
      price_auction_principal: estate.price_auction_principal || null,
      price_expert_report: estate.price_expert_report || null,
      price_minimum_bid: estate.price_minimum_bid || null,

      share_numerator: estate.share_numerator || null,
      share_denominator: estate.share_denominator || null,

      year_built: estate.year_built && estate.year_built > 0 ? estate.year_built : null,
      last_renovation: estate.last_renovation && estate.last_renovation > 0 ? estate.last_renovation : null,
      acceptance_year: estate.acceptance_year && estate.acceptance_year > 0 ? estate.acceptance_year : null,

      beginning_date: estate.beginning_date || null,
      finish_date: estate.finish_date || null,
      sale_date: estate.sale_date || null,
      first_tour_date: estate.first_tour_date || null,

      exclusively_at_rk: estate.exclusively_at_rk === 1 || null,
      personal_transfer: estate.personal_transfer === 1 ? "ano" : estate.personal_transfer === 2 ? "ne" : null,
      num_owners: estate.num_owners || null,

      matterport_url: estate.matterport_url || null,
      mapy_panorama_url: estate.mapy_panorama_url || null,
      keywords: estate.keywords || null,
      apartment_number: estate.apartment_number || null,

      active: true,
    };

    const { error } = await this.supabase
      .from("properties")
      .update(propertyData)
      .eq("id", propertyId);

    if (error) throw new Error(`Failed to update property: ${error.message}`);
  }

  private async handleBroker(propertyId: string, seller: RealmanSeller): Promise<{ brokerId: string | null; warning: string | null }> {
    if (!seller.id) {
      return { brokerId: null, warning: "Seller has no ID, skipping broker assignment" };
    }

    // Find existing broker by email (best match)
    const sellerEmail = seller.email || "";
    let brokerId: string | null = null;

    if (sellerEmail) {
      const { data: existingBroker } = await this.supabase
        .from("brokers")
        .select("id")
        .eq("email", sellerEmail)
        .maybeSingle();

      if (existingBroker) {
        brokerId = existingBroker.id;
      }
    }

    // Create broker if not found
    if (!brokerId) {
      const brokerName = `${seller.name} ${seller.surname}`.trim();
      const brokerSlug = this.generateSlug(brokerName) + `-${seller.id}`;

      const { data: newBroker, error: createError } = await this.supabase
        .from("brokers")
        .insert({
          name: brokerName,
          slug: brokerSlug,
          email: sellerEmail,
          phone: seller.cell || seller.phone || "",
          photo: seller.photo_url || null,
          agency_name: seller.title || "",
          specialization: "",
          bio: "",
        })
        .select("id")
        .single();

      if (createError) {
        return { brokerId: null, warning: `Failed to create broker ${brokerName}: ${createError.message}` };
      }
      brokerId = newBroker.id;
    }

    // Link broker to property
    await this.supabase
      .from("properties")
      .update({ broker_id: brokerId })
      .eq("id", propertyId);

    return { brokerId, warning: null };
  }

  private async handlePhotos(propertyId: string, photos: RealmanPhoto[]): Promise<{ successCount: number; warnings: string[] }> {
    const warnings: string[] = [];
    const imageUrls: string[] = [];
    let primaryUrl = "";

    // Sort by order
    const sorted = [...photos].sort((a, b) => a.order - b.order);

    for (const photo of sorted) {
      try {
        if (isR2Configured) {
          // Download and upload to R2
          const response = await fetch(photo.url);
          if (!response.ok) {
            warnings.push(`Failed to download photo ${photo.hash}: HTTP ${response.status}`);
            continue;
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const result = await uploadFile({
            buffer,
            filename: `${photo.hash}.jpg`,
            contentType: "image/jpeg",
            mediaType: "image",
            propertyId,
          });
          imageUrls.push(result.url);
          if (photo.order === 1) primaryUrl = result.url;
        } else {
          // Fallback: use Realman URL directly
          imageUrls.push(photo.url);
          if (photo.order === 1) primaryUrl = photo.url;
        }
      } catch (error) {
        warnings.push(`Failed to process photo ${photo.hash}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    if (!primaryUrl && imageUrls.length > 0) {
      primaryUrl = imageUrls[0];
    }

    // Update property with image URLs
    await this.supabase
      .from("properties")
      .update({
        images: imageUrls,
        image_src: primaryUrl,
        image_alt: "",
      })
      .eq("id", propertyId);

    return { successCount: imageUrls.length, warnings };
  }

  private async handleVideos(propertyId: string, videos: RealmanVideo[]): Promise<{ count: number; warnings: string[] }> {
    const warnings: string[] = [];
    let videoUrl: string | null = null;

    for (const video of videos) {
      if (video.hash) {
        videoUrl = `https://www.youtube.com/watch?v=${video.hash}`;
        break;
      } else if (video.url) {
        videoUrl = video.url;
        break;
      }
    }

    if (videoUrl) {
      await this.supabase
        .from("properties")
        .update({ matterport_url: videoUrl })
        .eq("id", propertyId);
      return { count: 1, warnings };
    }

    return { count: 0, warnings };
  }

  // ===== Slug generation =====

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = this.generateSlug(title || "nemovitost");
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data } = await this.supabase
        .from("properties")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!data) return slug;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  // ===== Enum mapping functions =====

  private mapListingType(advertFunction?: number): "sale" | "rent" | "auction" | "shares" {
    const map: Record<number, "sale" | "rent" | "auction" | "shares"> = {
      1: "sale", 2: "rent", 3: "auction", 4: "shares",
    };
    return map[advertFunction ?? 1] || "sale";
  }

  private mapCategory(advertType?: number): "apartment" | "house" | "land" | "commercial" | "other" {
    const map: Record<number, "apartment" | "house" | "land" | "commercial" | "other"> = {
      1: "apartment", 2: "house", 3: "land", 4: "commercial", 5: "other",
    };
    return map[advertType ?? 1] || "other";
  }

  private mapDisposition(advertSubtype?: number): string | null {
    const map: Record<number, string> = {
      2: "1+kk", 3: "1+1", 4: "2+kk", 5: "2+1", 6: "3+kk", 7: "3+1",
      8: "4+kk", 9: "4+1", 10: "5+kk", 11: "5+1", 12: "6+", 16: "atypický", 47: "pokoj",
    };
    return advertSubtype ? map[advertSubtype] || null : null;
  }

  private mapSubtype(category: string, advertSubtype?: number): string | null {
    if (!advertSubtype) return null;
    if (category === "apartment") return null; // goes to rooms_label

    if (category === "house") {
      const map: Record<number, string> = {
        33: "chata", 35: "pamatka", 37: "rodinny", 39: "vila", 40: "na_klic",
        43: "chalupa", 44: "zemedelska_usedlost", 54: "vicegeneracni",
      };
      return map[advertSubtype] || null;
    }

    if (category === "land") {
      const map: Record<number, string> = {
        18: "komercni", 19: "bydleni", 20: "pole", 21: "lesy", 22: "louky",
        23: "zahrady", 24: "ostatni", 46: "rybniky", 48: "sady_vinice",
      };
      return map[advertSubtype] || null;
    }

    if (category === "commercial") {
      const map: Record<number, string> = {
        25: "kancelare", 26: "sklady", 27: "vyroba", 28: "obchodni_prostory",
        29: "ubytovani", 30: "restaurace", 31: "zemedelsky", 32: "ostatni",
        38: "cinzovni_dum", 49: "virtualni_kancelar", 56: "ordinace", 57: "apartmany",
      };
      return map[advertSubtype] || null;
    }

    if (category === "other") {
      const map: Record<number, string> = {
        34: "garaz", 36: "ostatni", 50: "vinny_sklep", 51: "pudni_prostor",
        52: "garazove_stani", 53: "mobilheim",
      };
      return map[advertSubtype] || null;
    }

    return null;
  }

  private mapCondition(v?: number): string | null {
    const map: Record<number, string> = {
      1: "velmi_dobry", 2: "dobry", 3: "spatny", 4: "ve_vystavbe", 5: "projekt",
      6: "novostavba", 7: "k_demolici", 8: "pred_rekonstrukci", 9: "po_rekonstrukci", 10: "v_rekonstrukci",
    };
    return v ? map[v] || null : null;
  }

  private mapBuildingMaterial(v?: number): string | null {
    const map: Record<number, string> = {
      1: "drevostavba", 2: "cihla", 3: "kamen", 4: "montovana",
      5: "panel", 6: "skeletal", 7: "smisena", 8: "modularni",
    };
    return v ? map[v] || null : null;
  }

  private mapOwnership(v?: number): string | null {
    const map: Record<number, string> = { 1: "osobni", 2: "druzstevni", 3: "statni" };
    return v ? map[v] || null : null;
  }

  private mapFurnishing(v?: number): string | null {
    const map: Record<number, string> = { 1: "ano", 2: "ne", 3: "castecne" };
    return v ? map[v] || null : null;
  }

  private mapEnergyRating(v?: number): string | null {
    const map: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G" };
    return v ? map[v] || null : null;
  }

  private mapObjectType(v?: number): string | null {
    const map: Record<number, string> = { 1: "prizemni", 2: "patrovy" };
    return v ? map[v] || null : null;
  }

  private mapObjectKind(v?: number): string | null {
    const map: Record<number, string> = { 1: "radovy", 2: "rohovy", 3: "v_bloku", 4: "samostatny" };
    return v ? map[v] || null : null;
  }

  private mapObjectLocation(v?: number): string | null {
    const map: Record<number, string> = {
      1: "centrum", 2: "klidna_cast", 3: "rusna_cast", 4: "okraj",
      5: "sidliste", 6: "polosamota", 7: "samota",
    };
    return v ? map[v] || null : null;
  }

  private mapFlatClass(v?: number): string | null {
    const map: Record<number, string> = { 1: "mezonet", 2: "loft", 3: "podkrovni", 4: "jednopodlazni" };
    return v ? map[v] || null : null;
  }

  private mapParking(v?: number): string | null {
    const map: Record<number, string> = {
      1: "garaz", 2: "dvojgaraz", 3: "trojgaraz", 4: "podzemni", 5: "parkovaci_stani", 6: "zadne",
    };
    return v ? map[v] || null : null;
  }

  private mapSurroundings(v?: number): string | null {
    const map: Record<number, string> = {
      1: "bydleni", 2: "bydleni_kancelare", 3: "obchodni", 4: "administrativni",
      5: "prumyslova", 6: "venkovska", 7: "rekreacni", 8: "rekreacne_nevyuzita",
    };
    return v ? map[v] || null : null;
  }

  private mapProtection(v?: number): string | null {
    const map: Record<number, string> = {
      1: "ochranne_pasmo", 2: "narodni_park", 3: "chko", 4: "pamatkova_zona",
      5: "pamatkova_rezervace", 6: "kulturni_pamatka", 7: "narodni_kulturni_pamatka",
    };
    return v ? map[v] || null : null;
  }

  private mapCircuitBreaker(v?: number): string | null {
    const map: Record<number, string> = { 1: "16a", 2: "20a", 3: "25a", 4: "32a", 5: "40a", 6: "50a", 7: "63a" };
    return v ? map[v] || null : null;
  }

  private mapPhaseDistribution(v?: number): string | null {
    const map: Record<number, string> = { 1: "1_faze", 2: "3_faze" };
    return v ? map[v] || null : null;
  }

  private mapLeaseType(v?: number): string | null {
    const map: Record<number, string> = { 1: "najem", 2: "podnajem" };
    return v ? map[v] || null : null;
  }

  private mapAuctionKind(v?: number): string | null {
    const map: Record<number, string> = {
      1: "nedobrovolna", 2: "dobrovolna", 3: "exekucni", 4: "aukce", 5: "obchodni_soutez",
    };
    return v ? map[v] || null : null;
  }

  // Multiselect array mappings
  private mapHeating(values?: number[]): string[] | null {
    return this.mapArray(values, HEATING_MAP);
  }

  private mapHeatingElement(values?: number[]): string[] | null {
    return this.mapArray(values, HEATING_ELEMENT_MAP);
  }

  private mapHeatingSource(values?: number[]): string[] | null {
    return this.mapArray(values, HEATING_SOURCE_MAP);
  }

  private mapElectricity(values?: number[]): string[] | null {
    return this.mapArray(values, ELECTRICITY_MAP);
  }

  private mapGas(values?: number[]): string[] | null {
    return this.mapArray(values, GAS_MAP);
  }

  private mapWater(values?: number[]): string[] | null {
    return this.mapArray(values, WATER_MAP);
  }

  private mapGully(values?: number[]): string[] | null {
    return this.mapArray(values, GULLY_MAP);
  }

  private mapRoadType(values?: number[]): string[] | null {
    return this.mapArray(values, ROAD_TYPE_MAP);
  }

  private mapTelecommunication(values?: number[]): string[] | null {
    return this.mapArray(values, TELECOM_MAP);
  }

  private mapTransport(values?: number[]): string[] | null {
    return this.mapArray(values, TRANSPORT_MAP);
  }

  private mapArray(values: number[] | undefined, mapping: Record<number, string>): string[] | null {
    if (!values || !Array.isArray(values) || values.length === 0) return null;
    const result = values.map((v) => mapping[v]).filter(Boolean);
    return result.length > 0 ? result : null;
  }

  // ===== Import logging =====

  private async logImport(params: {
    externalId: string;
    importType: "create" | "update" | "delete";
    status: "success" | "error" | "warning";
    propertyId: string | null;
    brokerId: string | null;
    rawData: unknown;
    processedData: unknown;
    errorMessage?: string;
    warningMessages: string[] | null;
    photosCount: number;
    videosCount: number;
    processingTimeMs: number;
  }): Promise<void> {
    try {
      await this.supabase.from("import_logs").insert({
        external_id: params.externalId,
        import_type: params.importType,
        status: params.status,
        property_id: params.propertyId,
        broker_id: params.brokerId,
        raw_data: params.rawData,
        processed_data: params.processedData,
        error_message: params.errorMessage || null,
        warning_messages: params.warningMessages,
        photos_count: params.photosCount,
        videos_count: params.videosCount,
        processing_time_ms: params.processingTimeMs,
      });
    } catch {
      console.error("Failed to log import");
    }
  }
}

// ===== Constant mapping tables =====

const HEATING_MAP: Record<number, string> = {
  1: "lokalni_plynove", 2: "lokalni_tuha_paliva", 3: "lokalni_elektricke",
  4: "ustredni_plynove", 5: "ustredni_tuha_paliva", 6: "ustredni_elektricke",
  7: "ustredni_dalkove", 8: "jine", 9: "podlahove",
};

const HEATING_ELEMENT_MAP: Record<number, string> = {
  1: "waw", 2: "podlahove_vytapeni", 3: "radiatory", 4: "primotop",
  5: "infrapanel", 6: "krbova_kamna", 7: "krb", 8: "kotel_tuha_paliva",
  9: "kamna", 10: "klimatizace", 11: "akumulacni_kamna", 12: "jine",
};

const HEATING_SOURCE_MAP: Record<number, string> = {
  1: "waw", 2: "plynovy_kondenzacni_kotel", 3: "plynovy_kotel", 4: "elektrokotel",
  5: "tepelne_cerpadlo", 6: "primotop", 7: "infrapanel", 8: "krbova_kamna",
  9: "krb", 10: "kotel_tuha_paliva", 11: "kamna", 12: "ustredni_dalkove",
  13: "centralni_dalkove", 14: "para_s_vymenikem", 15: "akumulacni_kamna", 16: "jine",
};

const WATER_HEAT_SOURCE_MAP: Record<number, string> = {
  1: "bojler", 2: "prutokem", 3: "centralni", 4: "kotel", 5: "jine",
};

const ELECTRICITY_MAP: Record<number, string> = {
  1: "120V", 2: "230V", 4: "400V", 5: "bez_pripojky",
};

const GAS_MAP: Record<number, string> = {
  1: "individualni", 2: "plynovod",
};

const WATER_MAP: Record<number, string> = {
  1: "mistni_zdroj", 2: "vodovod", 4: "studna", 5: "retencni_nadrz",
};

const GULLY_MAP: Record<number, string> = {
  1: "verejna_kanalizace", 2: "cov_objekt", 3: "septik", 4: "jimka", 5: "trativod",
};

const ROAD_TYPE_MAP: Record<number, string> = {
  1: "betonova", 2: "dlazdena", 3: "asfaltova", 4: "neupravena",
  5: "zpevnena", 6: "sterkova", 7: "sotolina", 8: "neni_prijezdova",
};

const TELECOM_MAP: Record<number, string> = {
  1: "telefon", 2: "internet", 3: "satelit", 4: "kabelova_televize",
  5: "kabelove_rozvody", 6: "ostatni",
};

const TRANSPORT_MAP: Record<number, string> = {
  1: "vlak", 2: "dalnice", 3: "silnice", 4: "mhd", 5: "autobus",
};

const INTERNET_MAP: Record<number, string> = {
  1: "adsl", 2: "vdsl", 3: "optika", 4: "wifi", 5: "mobilni", 6: "satelitni",
};

const WELL_TYPE_MAP: Record<number, string> = {
  1: "vrtana", 2: "kopana",
};
