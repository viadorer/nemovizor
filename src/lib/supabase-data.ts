import { supabase, isSupabaseConfigured } from "./supabase";
import type { Property, Broker, PropertyFilters } from "./types";
import type { Database } from "./supabase-types";

// ===== Supabase → App konverze =====
// DB používá snake_case, app používá camelCase

type DbProperty = Database["public"]["Tables"]["properties"]["Row"];
type DbBroker = Database["public"]["Tables"]["brokers"]["Row"];

function dbPropertyToApp(row: DbProperty, broker?: DbBroker | null): Property {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    listingType: row.listing_type,
    category: row.category,
    subtype: row.subtype,
    roomsLabel: row.rooms_label,

    // Cena
    price: Number(row.price),
    priceNote: row.price_note ?? undefined,
    priceCurrency: row.price_currency ?? undefined,
    priceUnit: row.price_unit ?? undefined,
    priceNegotiation: row.price_negotiation ?? undefined,

    // Lokace
    city: row.city,
    district: row.district,
    street: row.street ?? undefined,
    zip: row.zip ?? undefined,
    region: row.region ?? undefined,
    cityPart: row.city_part ?? undefined,
    locationLabel: row.location_label,
    latitude: row.latitude,
    longitude: row.longitude,

    // Plochy
    area: Number(row.area),
    landArea: row.land_area ? Number(row.land_area) : undefined,
    builtUpArea: row.built_up_area ? Number(row.built_up_area) : undefined,
    floorArea: row.floor_area ? Number(row.floor_area) : undefined,
    balconyArea: row.balcony_area ?? undefined,
    basinArea: row.basin_area ?? undefined,
    cellarArea: row.cellar_area ?? undefined,
    gardenArea: row.garden_area ?? undefined,
    loggiaArea: row.loggia_area ?? undefined,
    terraceArea: row.terrace_area ?? undefined,
    noliveTotalArea: row.nolive_total_area ?? undefined,
    officesArea: row.offices_area ?? undefined,
    productionArea: row.production_area ?? undefined,
    shopArea: row.shop_area ?? undefined,
    storeArea: row.store_area ?? undefined,
    workshopArea: row.workshop_area ?? undefined,

    // Popis
    summary: row.summary,
    description: row.description ?? undefined,

    // Stav a parametry
    condition: row.condition ?? "",
    ownership: row.ownership ?? "",
    furnishing: row.furnishing ?? "",
    energyRating: row.energy_rating ?? "",
    buildingMaterial: row.building_material ?? undefined,
    heating: row.heating ?? undefined,
    heatingElement: row.heating_element ?? undefined,
    heatingSource: row.heating_source ?? undefined,
    waterHeatSource: row.water_heat_source ?? undefined,
    flooring: row.flooring ?? undefined,

    // Dům specifické
    objectType: row.object_type ?? undefined,
    objectKind: row.object_kind ?? undefined,
    objectLocation: row.object_location ?? undefined,
    flatClass: row.flat_class ?? undefined,

    // Podlaží
    floor: row.floor ?? undefined,
    totalFloors: row.total_floors ?? undefined,
    undergroundFloors: row.underground_floors ?? undefined,
    ceilingHeight: row.ceiling_height ?? undefined,

    // Parkování
    parking: row.parking ?? "",
    parkingSpaces: row.parking_spaces ?? undefined,
    garageCount: row.garage_count ?? undefined,

    // Vybavení (boolean)
    balcony: row.balcony,
    terrace: row.terrace,
    garden: row.garden,
    elevator: row.elevator,
    cellar: row.cellar,
    garage: row.garage,
    pool: row.pool,
    loggia: row.loggia,
    easyAccess: row.easy_access === "ano" ? true : row.easy_access === "ne" ? false : undefined,
    lowEnergy: row.low_energy ?? undefined,
    ftvPanels: row.ftv_panels ?? undefined,
    solarPanels: row.solar_panels ?? undefined,
    mortgage: row.mortgage ?? undefined,

    // Sítě (multiselect)
    electricity: row.electricity ?? undefined,
    gas: row.gas ?? undefined,
    water: row.water ?? undefined,
    gully: row.gully ?? undefined,
    roadType: row.road_type ?? undefined,
    telecommunication: row.telecommunication ?? undefined,
    transport: row.transport ?? undefined,
    internetConnectionType: row.internet_connection_type ?? undefined,

    // Internet
    internetConnectionProvider: row.internet_connection_provider ?? undefined,
    internetConnectionSpeed: row.internet_connection_speed ?? undefined,

    // Okolí
    surroundingsType: row.surroundings_type ?? undefined,
    protection: row.protection ?? undefined,

    // Jističe / fáze
    circuitBreaker: row.circuit_breaker ?? undefined,
    phaseDistribution: row.phase_distribution ?? undefined,

    // Studna
    wellType: row.well_type ?? undefined,

    // Finanční
    annuity: row.annuity ?? undefined,
    costOfLiving: row.cost_of_living ?? undefined,
    commission: row.commission ?? undefined,
    mortgagePercent: row.mortgage_percent ?? undefined,
    sporPercent: row.spor_percent ?? undefined,
    refundableDeposit: row.refundable_deposit ?? undefined,

    // Pronájem
    leaseType: row.lease_type ?? undefined,
    tenantNotPayCommission: row.tenant_not_pay_commission ?? undefined,
    readyDate: row.ready_date ?? undefined,

    // Dražba
    auctionKind: row.auction_kind ?? undefined,
    auctionDate: row.auction_date ?? undefined,
    auctionPlace: row.auction_place ?? undefined,
    priceAuctionPrincipal: row.price_auction_principal ?? undefined,
    priceExpertReport: row.price_expert_report ?? undefined,
    priceMinimumBid: row.price_minimum_bid ?? undefined,

    // Podíly
    shareNumerator: row.share_numerator ?? undefined,
    shareDenominator: row.share_denominator ?? undefined,

    // Stáří
    yearBuilt: row.year_built ?? undefined,
    lastRenovation: row.last_renovation ?? undefined,
    acceptanceYear: row.acceptance_year ?? undefined,

    // Výstavba
    beginningDate: row.beginning_date ?? undefined,
    finishDate: row.finish_date ?? undefined,
    saleDate: row.sale_date ?? undefined,

    // Prohlídky
    firstTourDate: row.first_tour_date ?? undefined,

    // Status
    extraInfo: row.extra_info ?? undefined,
    exclusivelyAtRk: row.exclusively_at_rk ?? undefined,
    personalTransfer: row.personal_transfer ?? undefined,

    // Počet vlastníků
    numOwners: row.num_owners ?? undefined,

    // VR / panorama
    matterportUrl: row.matterport_url ?? undefined,
    mapyPanoramaUrl: row.mapy_panorama_url ?? undefined,

    // Klíčová slova
    keywords: row.keywords ?? undefined,

    // Číslo bytové jednotky
    apartmentNumber: row.apartment_number ?? undefined,

    // Média
    imageSrc: row.image_src,
    imageAlt: row.image_alt,
    images: row.images ?? [],

    // Makléř
    brokerName: broker?.name ?? "",
    brokerPhone: broker?.phone ?? "",
    brokerEmail: broker?.email ?? "",
    agencyName: broker?.agency_name ?? "",
    brokerId: row.broker_id ?? undefined,

    // Status
    featured: row.featured,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbBrokerToApp(row: DbBroker): Broker {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    photo: row.photo ?? undefined,
    agencyId: "",
    agencyName: row.agency_name,
    specialization: row.specialization,
    activeListings: row.active_listings,
    rating: Number(row.rating),
    totalDeals: row.total_deals,
    bio: row.bio,
    slug: row.slug ?? "",
  };
}

// ===== Veřejné API funkce =====

/** Načti všechny nemovitosti (s filtry) */
export async function fetchProperties(filters?: PropertyFilters): Promise<Property[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from("properties")
    .select("*, brokers(*)")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.listingType) query = query.eq("listing_type", filters.listingType);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.city) query = query.eq("city", filters.city);
  if (filters?.subtype) query = query.eq("subtype", filters.subtype);
  if (filters?.condition) query = query.eq("condition", filters.condition);
  if (filters?.ownership) query = query.eq("ownership", filters.ownership);
  if (filters?.buildingMaterial) query = query.eq("building_material", filters.buildingMaterial);
  if (filters?.objectLocation) query = query.eq("object_location", filters.objectLocation);
  if (filters?.furnishing) query = query.eq("furnishing", filters.furnishing);
  if (filters?.energyRating) query = query.eq("energy_rating", filters.energyRating);
  if (filters?.priceMin) query = query.gte("price", filters.priceMin);
  if (filters?.priceMax) query = query.lte("price", filters.priceMax);
  if (filters?.areaMin) query = query.gte("area", filters.areaMin);
  if (filters?.areaMax) query = query.lte("area", filters.areaMax);

  const { data, error } = await query;

  if (error) {
    console.error("Supabase fetchProperties error:", error);
    return [];
  }

  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

/** Načti featured nemovitosti */
export async function fetchFeaturedProperties(): Promise<Property[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("properties")
    .select("*, brokers(*)")
    .eq("active", true)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("Supabase fetchFeatured error:", error);
    return [];
  }

  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

/** Načti nemovitost podle slug */
export async function fetchPropertyBySlug(slug: string): Promise<Property | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("properties")
    .select("*, brokers(*)")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  const row = data as DbProperty & { brokers?: DbBroker | null };
  return dbPropertyToApp(row, row.brokers);
}

/** Načti podobné nemovitosti */
export async function fetchSimilarProperties(slug: string, city: string): Promise<Property[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("properties")
    .select("*, brokers(*)")
    .eq("active", true)
    .eq("city", city)
    .neq("slug", slug)
    .limit(3);

  if (error) return [];

  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

/** Načti unikátní města */
export async function fetchUniqueCities(): Promise<string[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("properties")
    .select("city")
    .eq("active", true);

  if (error || !data) return [];

  return [...new Set((data as { city: string }[]).map((r) => r.city))].sort();
}

/** Načti všechny makléře */
export async function fetchBrokers(): Promise<Broker[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("brokers")
    .select("*")
    .order("name");

  if (error) return [];

  return (data ?? []).map(dbBrokerToApp);
}

/** Načti makléře podle ID */
export async function fetchBrokerById(id: string): Promise<Broker | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("brokers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return dbBrokerToApp(data);
}
