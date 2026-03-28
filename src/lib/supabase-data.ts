import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Property, Broker, Agency, Branch, Review, PropertyFilters } from "./types";
import type { Database } from "./supabase-types";

// ===== Helpers =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name means Supabase returns unknown row type
async function fetchAllFromTable(sb: SupabaseClient<Database>, table: string, select: string, orderBy = "name"): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb
      .from(table)
      .select(select)
      .order(orderBy)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ===== Supabase → App konverze =====

type DbProperty = Database["public"]["Tables"]["properties"]["Row"];
type DbBroker = Database["public"]["Tables"]["brokers"]["Row"];
type DbAgency = Database["public"]["Tables"]["agencies"]["Row"];
type DbBranch = Database["public"]["Tables"]["branches"]["Row"];
type DbReview = Database["public"]["Tables"]["reviews"]["Row"];

function dbPropertyToApp(row: DbProperty, broker?: DbBroker | null): Property {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    listingType: row.listing_type,
    category: row.category,
    subtype: row.subtype,
    roomsLabel: row.rooms_label,
    price: Number(row.price),
    priceNote: row.price_note ?? undefined,
    priceCurrency: row.price_currency ?? undefined,
    priceUnit: row.price_unit ?? undefined,
    priceNegotiation: row.price_negotiation ?? undefined,
    city: row.city,
    district: row.district,
    street: row.street ?? undefined,
    zip: row.zip ?? undefined,
    region: row.region ?? undefined,
    cityPart: row.city_part ?? undefined,
    country: row.country ?? undefined,
    locationLabel: row.location_label,
    latitude: row.latitude,
    longitude: row.longitude,
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
    summary: row.summary,
    description: row.description ?? undefined,
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
    objectType: row.object_type ?? undefined,
    objectKind: row.object_kind ?? undefined,
    objectLocation: row.object_location ?? undefined,
    flatClass: row.flat_class ?? undefined,
    floor: row.floor ?? undefined,
    totalFloors: row.total_floors ?? undefined,
    undergroundFloors: row.underground_floors ?? undefined,
    ceilingHeight: row.ceiling_height ?? undefined,
    parking: row.parking ?? "",
    parkingSpaces: row.parking_spaces ?? undefined,
    garageCount: row.garage_count ?? undefined,
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
    electricity: row.electricity ?? undefined,
    gas: row.gas ?? undefined,
    water: row.water ?? undefined,
    gully: row.gully ?? undefined,
    roadType: row.road_type ?? undefined,
    telecommunication: row.telecommunication ?? undefined,
    transport: row.transport ?? undefined,
    internetConnectionType: row.internet_connection_type ?? undefined,
    internetConnectionProvider: row.internet_connection_provider ?? undefined,
    internetConnectionSpeed: row.internet_connection_speed ?? undefined,
    surroundingsType: row.surroundings_type ?? undefined,
    protection: row.protection ?? undefined,
    circuitBreaker: row.circuit_breaker ?? undefined,
    phaseDistribution: row.phase_distribution ?? undefined,
    wellType: row.well_type ?? undefined,
    annuity: row.annuity ?? undefined,
    costOfLiving: row.cost_of_living ?? undefined,
    commission: row.commission ?? undefined,
    mortgagePercent: row.mortgage_percent ?? undefined,
    sporPercent: row.spor_percent ?? undefined,
    refundableDeposit: row.refundable_deposit ?? undefined,
    leaseType: row.lease_type ?? undefined,
    tenantNotPayCommission: row.tenant_not_pay_commission ?? undefined,
    readyDate: row.ready_date ?? undefined,
    auctionKind: row.auction_kind ?? undefined,
    auctionDate: row.auction_date ?? undefined,
    auctionPlace: row.auction_place ?? undefined,
    priceAuctionPrincipal: row.price_auction_principal ?? undefined,
    priceExpertReport: row.price_expert_report ?? undefined,
    priceMinimumBid: row.price_minimum_bid ?? undefined,
    shareNumerator: row.share_numerator ?? undefined,
    shareDenominator: row.share_denominator ?? undefined,
    yearBuilt: row.year_built ?? undefined,
    lastRenovation: row.last_renovation ?? undefined,
    acceptanceYear: row.acceptance_year ?? undefined,
    beginningDate: row.beginning_date ?? undefined,
    finishDate: row.finish_date ?? undefined,
    saleDate: row.sale_date ?? undefined,
    firstTourDate: row.first_tour_date ?? undefined,
    extraInfo: row.extra_info ?? undefined,
    exclusivelyAtRk: row.exclusively_at_rk ?? undefined,
    personalTransfer: row.personal_transfer ?? undefined,
    numOwners: row.num_owners ?? undefined,
    matterportUrl: row.matterport_url ?? undefined,
    mapyPanoramaUrl: row.mapy_panorama_url ?? undefined,
    keywords: row.keywords ?? undefined,
    apartmentNumber: row.apartment_number ?? undefined,
    imageSrc: row.image_src,
    imageAlt: row.image_alt,
    images: row.images ?? [],
    brokerName: broker?.name ?? "",
    brokerPhone: broker?.phone ?? "",
    brokerEmail: broker?.email ?? "",
    brokerPhoto: broker?.photo ?? undefined,
    agencyName: broker?.agency_name ?? "",
    brokerId: row.broker_id ?? undefined,
    featured: row.featured,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbBrokerToApp(row: DbBroker): Broker {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    photo: row.photo ?? undefined,
    agencyId: row.agency_id ?? "",
    agencyName: row.agency_name,
    specialization: row.specialization,
    activeListings: row.active_listings,
    rating: Number(row.rating),
    totalDeals: row.total_deals,
    bio: row.bio,
    slug: row.slug ?? "",
    languages: row.languages ?? undefined,
    certifications: row.certifications ?? undefined,
    yearStarted: row.year_started ?? undefined,
    isPromoted: r.is_promoted ?? false,
    // Social
    linkedin: r.linkedin || undefined,
    instagram: r.instagram || undefined,
    facebook: r.facebook || undefined,
    twitter: r.twitter || undefined,
    website: r.website || undefined,
    whatsapp: r.whatsapp || undefined,
    // Video
    videoUrl: r.video_url || undefined,
    videoType: r.video_type || undefined,
    // Bio
    bioShort: r.bio_short || undefined,
    bioLong: r.bio_long || undefined,
    motto: r.motto || undefined,
    // Professional
    title: r.title || undefined,
    licenseNumber: r.license_number || undefined,
    education: r.education || undefined,
    awards: r.awards || undefined,
    // Expertise
    serviceAreas: r.service_areas || undefined,
    specializations: r.specializations || undefined,
    propertyTypes: r.property_types || undefined,
    priceRangeMin: r.price_range_min || undefined,
    priceRangeMax: r.price_range_max || undefined,
    // Performance
    totalSalesVolume: r.total_sales_volume || undefined,
    avgResponseTimeHours: r.avg_response_time_hours ? Number(r.avg_response_time_hours) : undefined,
    responseRatePct: r.response_rate_pct || undefined,
    // Visuals
    coverPhoto: r.cover_photo || undefined,
    gallery: r.gallery || undefined,
    // Booking
    calendlyUrl: r.calendly_url || undefined,
    // Personal
    hobbies: r.hobbies || undefined,
    funFact: r.fun_fact || undefined,
  };
}

function dbAgencyToApp(row: DbAgency): Agency {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: row.logo ?? undefined,
    description: row.description,
    phone: row.phone,
    email: row.email,
    website: row.website ?? undefined,
    foundedYear: row.founded_year ?? 0,
    totalBrokers: row.total_brokers,
    totalListings: row.total_listings,
    totalDeals: row.total_deals,
    rating: Number(row.rating),
    specializations: row.specializations ?? [],
    parentAgencyId: row.parent_agency_id ?? undefined,
    isIndependent: row.is_independent,
    seatCity: row.seat_city ?? undefined,
    seatAddress: row.seat_address ?? undefined,
    // Social
    linkedin: r.linkedin || undefined,
    instagram: r.instagram || undefined,
    facebook: r.facebook || undefined,
    twitter: r.twitter || undefined,
    whatsapp: r.whatsapp || undefined,
    // Video
    videoUrl: r.video_url || undefined,
    videoType: r.video_type || undefined,
    // Description
    descriptionLong: r.description_long || undefined,
    motto: r.motto || undefined,
    mission: r.mission || undefined,
    valuesText: r.values_text || undefined,
    // Visuals
    coverPhoto: r.cover_photo || undefined,
    gallery: r.gallery || undefined,
    // Performance
    totalSalesVolume: r.total_sales_volume || undefined,
    avgResponseTimeHours: r.avg_response_time_hours ? Number(r.avg_response_time_hours) : undefined,
    propertiesSoldCount: r.properties_sold_count || undefined,
    // Awards
    awards: r.awards || undefined,
    agencyCertifications: r.certifications || undefined,
    // Service
    serviceAreas: r.service_areas || undefined,
    serviceCountries: r.service_countries || undefined,
    // Contact
    calendlyUrl: r.calendly_url || undefined,
    // CTA
    newsletterEnabled: r.newsletter_enabled || undefined,
    ctaText: r.cta_text || undefined,
    ctaUrl: r.cta_url || undefined,
  };
}

function dbBranchToApp(row: DbBranch): Branch {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;
  return {
    id: row.id,
    agencyId: row.agency_id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    city: row.city,
    phone: row.phone,
    email: row.email,
    latitude: row.latitude,
    longitude: row.longitude,
    isHeadquarters: row.is_headquarters,
    photo: r.photo || undefined,
    description: r.description || undefined,
    openingHours: r.opening_hours || undefined,
    specializations: r.specializations || undefined,
    brokerCount: r.broker_count || undefined,
  };
}

function dbReviewToApp(row: DbReview): Review {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.broker_id ?? row.agency_id ?? "",
    authorName: row.author_name,
    rating: row.rating,
    text: row.text,
    date: row.date,
    propertyType: row.property_type ?? undefined,
  };
}

// ===== Properties =====

export async function fetchProperties(filters?: PropertyFilters): Promise<Property[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  let query = getSupabase()!
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
  if (error) { console.error("Supabase fetchProperties error:", JSON.stringify(error)); return []; }

  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

export async function fetchFeaturedProperties(): Promise<Property[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!
    .from("properties")
    .select("*, brokers(*)")
    .eq("active", true)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) { console.error("Supabase fetchFeatured error:", JSON.stringify(error)); return []; }

  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

export async function fetchPropertyBySlug(slug: string): Promise<Property | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const { data, error } = await getSupabase()!
    .from("properties")
    .select("*, brokers(*)")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  const row = data as DbProperty & { brokers?: DbBroker | null };
  return dbPropertyToApp(row, row.brokers);
}

export async function fetchAdjacentProperties(propertyId: string): Promise<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> {
  if (!isSupabaseConfigured || !getSupabase()) return { prev: null, next: null };
  const sb = getSupabase()!;

  const [prevRes, nextRes] = await Promise.all([
    sb.from("properties").select("slug, title").eq("active", true).lt("id", propertyId).order("id", { ascending: false }).limit(1),
    sb.from("properties").select("slug, title").eq("active", true).gt("id", propertyId).order("id", { ascending: true }).limit(1),
  ]);

  const prevRow = prevRes.data?.[0] as { slug: string; title: string } | undefined;
  const nextRow = nextRes.data?.[0] as { slug: string; title: string } | undefined;

  return {
    prev: prevRow ? { slug: prevRow.slug, title: prevRow.title } : null,
    next: nextRow ? { slug: nextRow.slug, title: nextRow.title } : null,
  };
}

export async function fetchSimilarProperties(slug: string, city: string): Promise<Property[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!
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

export async function fetchUniqueCities(): Promise<string[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  // Fetch only city column, paginated to handle >1000 rows
  const sb = getSupabase()!;
  const cities = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb
      .from("properties")
      .select("city")
      .eq("active", true)
      .order("city")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data as { city: string }[]) cities.add(r.city);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return [...cities].sort();
}

// ===== Brokers =====

export async function fetchBrokers(): Promise<Broker[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const sb = getSupabase()!;
  const allData = await fetchAllFromTable(sb, "brokers", "*", "name");
  if (!allData.length) return [];

  return allData.map(dbBrokerToApp);
}

export async function fetchBrokerById(id: string): Promise<Broker | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const sb = getSupabase()!;
  const { data, error } = await sb.from("brokers").select("*").eq("id", id).single();
  if (error || !data) return null;
  const broker = dbBrokerToApp(data);

  // Dynamically count active listings
  const { count } = await sb
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("broker_id", id)
    .eq("active", true);
  if (count !== null) broker.activeListings = count;

  return broker;
}

export async function fetchBrokerBySlug(slug: string): Promise<Broker | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const sb = getSupabase()!;
  const { data, error } = await sb.from("brokers").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  const broker = dbBrokerToApp(data);

  // Dynamically count active listings
  const { count } = await sb
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("broker_id", broker.id)
    .eq("active", true);
  if (count !== null) broker.activeListings = count;

  return broker;
}

export async function fetchBrokerProperties(brokerId: string, limit = 200): Promise<Property[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!
    .from("properties")
    .select("*, brokers(*)")
    .eq("broker_id", brokerId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

// ===== Agencies =====

export async function fetchAgencies(): Promise<Agency[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const sb = getSupabase()!;
  const allData = await fetchAllFromTable(sb, "agencies", "*", "name");
  if (!allData.length) return [];

  const agencies = allData.map(dbAgencyToApp);

  // Count brokers and listings per agency in 2 lightweight queries
  const brokersData = await fetchAllFromTable(sb, "brokers", "id, agency_id, active_listings", "name");
  const brokersByAgency: Record<string, number> = {};
  const listingsByAgency: Record<string, number> = {};
  for (const b of brokersData as { id: string; agency_id: string; active_listings: number }[]) {
    if (!b.agency_id) continue;
    brokersByAgency[b.agency_id] = (brokersByAgency[b.agency_id] ?? 0) + 1;
    listingsByAgency[b.agency_id] = (listingsByAgency[b.agency_id] ?? 0) + (b.active_listings ?? 0);
  }
  for (const a of agencies) {
    a.totalBrokers = brokersByAgency[a.id] ?? 0;
    a.totalListings = listingsByAgency[a.id] ?? 0;
  }

  return agencies;
}

async function enrichAgencyStats(sb: ReturnType<typeof getSupabase> & object, agency: Agency): Promise<Agency> {
  // Count brokers
  const { count: brokerCount } = await sb
    .from("brokers")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agency.id);
  agency.totalBrokers = brokerCount ?? 0;

  // Count active listings via brokers
  const { data: brokerIds } = await sb
    .from("brokers")
    .select("id")
    .eq("agency_id", agency.id);
  if (brokerIds && brokerIds.length > 0) {
    const ids = brokerIds.map((b: { id: string }) => b.id);
    const { count: listingCount } = await sb
      .from("properties")
      .select("id", { count: "exact", head: true })
      .in("broker_id", ids)
      .eq("active", true);
    agency.totalListings = listingCount ?? 0;
  } else {
    agency.totalListings = 0;
  }

  return agency;
}

export async function fetchAgencyById(id: string): Promise<Agency | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const sb = getSupabase()!;
  const { data, error } = await sb.from("agencies").select("*").eq("id", id).single();
  if (error || !data) return null;
  return enrichAgencyStats(sb, dbAgencyToApp(data));
}

export async function fetchAgencyBySlug(slug: string): Promise<Agency | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const sb = getSupabase()!;
  const { data, error } = await sb.from("agencies").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  return enrichAgencyStats(sb, dbAgencyToApp(data));
}

export async function fetchAgencyBrokers(agencyId: string): Promise<Broker[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const sb = getSupabase()!;
  const { data, error } = await sb.from("brokers").select("*").eq("agency_id", agencyId).order("name");
  if (error) return [];
  return (data ?? []).map(dbBrokerToApp);
}

export async function fetchAgencyBranches(agencyId: string): Promise<Branch[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!.from("branches").select("*").eq("agency_id", agencyId).order("name");
  if (error) return [];
  return (data ?? []).map(dbBranchToApp);
}

export async function fetchAgencyProperties(agencyId: string): Promise<Property[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  // Get broker IDs for this agency, then get their properties
  const { data: brokerData } = await getSupabase()!.from("brokers").select("id").eq("agency_id", agencyId);
  if (!brokerData?.length) return [];

  const brokerIds = (brokerData as { id: string }[]).map((b) => b.id);
  const { data, error } = await getSupabase()!
    .from("properties")
    .select("*, brokers(*)")
    .in("broker_id", brokerIds)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return [];
  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

// ===== Branches =====

export async function fetchAllBranches(): Promise<Branch[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!.from("branches").select("*").order("name");
  if (error) return [];
  return (data ?? []).map(dbBranchToApp);
}

// ===== Reviews =====

export async function fetchBrokerReviews(brokerId: string): Promise<Review[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!
    .from("reviews")
    .select("*")
    .eq("target_type", "broker")
    .eq("broker_id", brokerId)
    .order("date", { ascending: false });

  if (error) return [];
  return (data ?? []).map(dbReviewToApp);
}

export async function fetchAgencyReviews(agencyId: string): Promise<Review[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!
    .from("reviews")
    .select("*")
    .eq("target_type", "agency")
    .eq("agency_id", agencyId)
    .order("date", { ascending: false });

  if (error) return [];
  return (data ?? []).map(dbReviewToApp);
}

// ===== Recent Sales =====

export async function fetchRecentSales(type: "broker" | "agency", id: string): Promise<import("./types").RecentSale[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const col = type === "broker" ? "broker_id" : "agency_id";
  const { data, error } = await getSupabase()!
    .from("recent_sales")
    .select("*")
    .eq(col, id)
    .order("sold_date", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    id: r.id,
    brokerId: r.broker_id || undefined,
    agencyId: r.agency_id || undefined,
    propertyId: r.property_id || undefined,
    title: r.title || "",
    city: r.city || "",
    country: r.country || "cz",
    price: Number(r.price) || 0,
    priceCurrency: r.price_currency || "czk",
    area: Number(r.area) || 0,
    category: r.category || "apartment",
    imageUrl: r.image_url || "",
    soldDate: r.sold_date || "",
  }));
}

// ===== Utility: Cities =====

export async function fetchAllBrokerCities(): Promise<string[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  // Reuse fetchUniqueCities — same data source
  return fetchUniqueCities();
}

export async function fetchAllBranchCities(): Promise<string[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data } = await getSupabase()!.from("branches").select("city");
  if (!data) return [];
  return [...new Set((data as { city: string }[]).map((r) => r.city))].sort();
}

export async function fetchAllSpecializations(): Promise<string[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data } = await getSupabase()!.from("brokers").select("specialization");
  if (!data) return [];
  return [...new Set((data as { specialization: string }[]).map((r) => r.specialization))].sort();
}

// ===== Bulk city maps (for specialiste page) =====

/** Returns { brokerId → [city1, city2, ...] } from active properties.
 *  Fetches only broker_id + city with active filter, paginated. */
export async function fetchBrokerCitiesMap(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured || !getSupabase()) return {};
  const sb = getSupabase()!;
  const map: Record<string, string[]> = {};
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb
      .from("properties")
      .select("broker_id, city")
      .eq("active", true)
      .not("broker_id", "is", null)
      .order("broker_id")
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const row of data as { broker_id: string; city: string }[]) {
      const arr = (map[row.broker_id] ??= []);
      if (!arr.includes(row.city)) arr.push(row.city);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

/** Returns { agencyId → [city1, city2, ...] } from branches */
export async function fetchBranchCitiesMap(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured || !getSupabase()) return {};
  const { data } = await getSupabase()!.from("branches").select("agency_id, city");
  if (!data) return {};
  const map: Record<string, string[]> = {};
  for (const row of data as { agency_id: string; city: string }[]) {
    const arr = (map[row.agency_id] ??= []);
    if (!arr.includes(row.city)) arr.push(row.city);
  }
  return map;
}

// ===== Paginated fetches for detail pages =====

export type DetailPropertyFilters = {
  listingType?: string | null;
  category?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  areaMin?: number | null;
  areaMax?: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase query builder chained generics
function applyDetailFilters<T extends { eq: (...a: any[]) => T; gte: (...a: any[]) => T; lte: (...a: any[]) => T }>(query: T, filters?: DetailPropertyFilters): T {
  if (!filters) return query;
  if (filters.listingType) query = query.eq("listing_type", filters.listingType);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.priceMin) query = query.gte("price", filters.priceMin);
  if (filters.priceMax) query = query.lte("price", filters.priceMax);
  if (filters.areaMin) query = query.gte("area", filters.areaMin);
  if (filters.areaMax) query = query.lte("area", filters.areaMax);
  return query;
}

export async function fetchBrokerPropertiesPaginated(
  brokerId: string,
  page: number,
  perPage: number,
  filters?: DetailPropertyFilters
): Promise<{ items: Property[]; total: number }> {
  if (!isSupabaseConfigured || !getSupabase()) return { items: [], total: 0 };

  const sb = getSupabase()!;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let countQ = sb.from("properties").select("id", { count: "exact", head: true }).eq("broker_id", brokerId).eq("active", true);
  let dataQ = sb.from("properties").select("*, brokers(*)").eq("broker_id", brokerId).eq("active", true);
  countQ = applyDetailFilters(countQ, filters);
  dataQ = applyDetailFilters(dataQ, filters);

  const [{ count }, { data, error }] = await Promise.all([
    countQ,
    dataQ.order("created_at", { ascending: false }).range(from, to),
  ]);

  if (error) return { items: [], total: 0 };
  return {
    items: (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) => dbPropertyToApp(row, row.brokers)),
    total: count ?? 0,
  };
}

export async function fetchAgencyPropertiesPaginated(
  agencyId: string,
  page: number,
  perPage: number,
  filters?: DetailPropertyFilters
): Promise<{ items: Property[]; total: number }> {
  if (!isSupabaseConfigured || !getSupabase()) return { items: [], total: 0 };

  const sb = getSupabase()!;
  const { data: brokerData } = await sb.from("brokers").select("id").eq("agency_id", agencyId);
  if (!brokerData?.length) return { items: [], total: 0 };

  const brokerIds = (brokerData as { id: string }[]).map((b) => b.id);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let countQ = sb.from("properties").select("id", { count: "exact", head: true }).in("broker_id", brokerIds).eq("active", true);
  let dataQ = sb.from("properties").select("*, brokers(*)").in("broker_id", brokerIds).eq("active", true);
  countQ = applyDetailFilters(countQ, filters);
  dataQ = applyDetailFilters(dataQ, filters);

  const [{ count }, { data, error }] = await Promise.all([
    countQ,
    dataQ.order("created_at", { ascending: false }).range(from, to),
  ]);

  if (error) return { items: [], total: 0 };
  return {
    items: (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) => dbPropertyToApp(row, row.brokers)),
    total: count ?? 0,
  };
}
