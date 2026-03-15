import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Property, Broker, Agency, Branch, Review, PropertyFilters } from "./types";
import type { Database } from "./supabase-types";

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
    agencyName: broker?.agency_name ?? "",
    brokerId: row.broker_id ?? undefined,
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
  };
}

function dbAgencyToApp(row: DbAgency): Agency {
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
  };
}

function dbBranchToApp(row: DbBranch): Branch {
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

  const { data, error } = await getSupabase()!.from("properties").select("city").eq("active", true);
  if (error || !data) return [];
  return [...new Set((data as { city: string }[]).map((r) => r.city))].sort();
}

// ===== Brokers =====

export async function fetchBrokers(): Promise<Broker[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const sb = getSupabase()!;
  const { data, error } = await sb.from("brokers").select("*").order("name");
  if (error) return [];

  const brokers = (data ?? []).map(dbBrokerToApp);

  // Dynamically count active listings per broker
  const { data: props } = await sb
    .from("properties")
    .select("broker_id")
    .eq("active", true)
    .not("broker_id", "is", null);
  if (props) {
    const countMap: Record<string, number> = {};
    for (const p of props as { broker_id: string }[]) {
      countMap[p.broker_id] = (countMap[p.broker_id] || 0) + 1;
    }
    for (const b of brokers) {
      b.activeListings = countMap[b.id] ?? 0;
    }
  }

  return brokers;
}

export async function fetchBrokerById(id: string): Promise<Broker | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const { data, error } = await getSupabase()!.from("brokers").select("*").eq("id", id).single();
  if (error || !data) return null;
  return dbBrokerToApp(data);
}

export async function fetchBrokerBySlug(slug: string): Promise<Broker | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const { data, error } = await getSupabase()!.from("brokers").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  return dbBrokerToApp(data);
}

export async function fetchBrokerProperties(brokerId: string): Promise<Property[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!
    .from("properties")
    .select("*, brokers(*)")
    .eq("broker_id", brokerId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row: DbProperty & { brokers?: DbBroker | null }) =>
    dbPropertyToApp(row, row.brokers)
  );
}

// ===== Agencies =====

export async function fetchAgencies(): Promise<Agency[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const sb = getSupabase()!;
  const { data, error } = await sb.from("agencies").select("*").order("name");
  if (error) return [];

  const agencies = (data ?? []).map(dbAgencyToApp);

  // Dynamically count brokers per agency and listings via broker->property
  const { data: brokersData } = await sb.from("brokers").select("id, agency_id");
  if (brokersData) {
    const brokersByAgency: Record<string, string[]> = {};
    for (const b of brokersData as { id: string; agency_id: string }[]) {
      if (!b.agency_id) continue;
      (brokersByAgency[b.agency_id] ??= []).push(b.id);
    }
    for (const a of agencies) {
      a.totalBrokers = brokersByAgency[a.id]?.length ?? 0;
    }

    // Count listings per agency (via broker_id)
    const { data: props } = await sb
      .from("properties")
      .select("broker_id")
      .eq("active", true)
      .not("broker_id", "is", null);
    if (props) {
      const brokerToAgency: Record<string, string> = {};
      for (const b of brokersData as { id: string; agency_id: string }[]) {
        if (b.agency_id) brokerToAgency[b.id] = b.agency_id;
      }
      const listingsByAgency: Record<string, number> = {};
      for (const p of props as { broker_id: string }[]) {
        const aid = brokerToAgency[p.broker_id];
        if (aid) listingsByAgency[aid] = (listingsByAgency[aid] || 0) + 1;
      }
      for (const a of agencies) {
        a.totalListings = listingsByAgency[a.id] ?? 0;
      }
    }
  }

  return agencies;
}

export async function fetchAgencyById(id: string): Promise<Agency | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const { data, error } = await getSupabase()!.from("agencies").select("*").eq("id", id).single();
  if (error || !data) return null;
  return dbAgencyToApp(data);
}

export async function fetchAgencyBySlug(slug: string): Promise<Agency | null> {
  if (!isSupabaseConfigured || !getSupabase()) return null;

  const { data, error } = await getSupabase()!.from("agencies").select("*").eq("slug", slug).single();
  if (error || !data) return null;
  return dbAgencyToApp(data);
}

export async function fetchAgencyBrokers(agencyId: string): Promise<Broker[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  const { data, error } = await getSupabase()!.from("brokers").select("*").eq("agency_id", agencyId).order("name");
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
    .order("created_at", { ascending: false });

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

// ===== Utility: Cities =====

export async function fetchAllBrokerCities(): Promise<string[]> {
  if (!isSupabaseConfigured || !getSupabase()) return [];

  // Cities from properties linked to brokers
  const { data } = await getSupabase()!.from("properties").select("city").eq("active", true);
  if (!data) return [];
  return [...new Set((data as { city: string }[]).map((r) => r.city))].sort();
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
