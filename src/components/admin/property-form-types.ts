import {
  ApartmentSubtypes,
  HouseSubtypes,
  LandSubtypes,
  CommercialSubtypes,
  OtherSubtypes,
} from "@/lib/types";

// ===== FORM DATA TYPE (mirrors DB columns exactly) =====
export type PropertyFormData = {
  // Basic
  slug: string;
  title: string;
  listing_type: string;
  category: string;
  subtype: string;
  rooms_label: string;

  // Price
  price: number;
  price_note: string;
  price_currency: string;
  price_unit: string;
  price_negotiation: boolean;

  // Location
  city: string;
  district: string;
  street: string;
  zip: string;
  region: string;
  city_part: string;
  location_label: string;
  latitude: number;
  longitude: number;

  // Areas
  area: number;
  land_area: number | null;
  built_up_area: number | null;
  floor_area: number | null;
  balcony_area: number | null;
  basin_area: number | null;
  cellar_area: number | null;
  garden_area: number | null;
  loggia_area: number | null;
  terrace_area: number | null;
  nolive_total_area: number | null;
  offices_area: number | null;
  production_area: number | null;
  shop_area: number | null;
  store_area: number | null;
  workshop_area: number | null;

  // Description
  summary: string;
  description: string;

  // Condition & params
  condition: string;
  ownership: string;
  furnishing: string;
  energy_rating: string;
  building_material: string;
  flooring: string;

  // House-specific
  object_type: string;
  object_kind: string;
  object_location: string;
  flat_class: string;

  // Floors
  floor: number | null;
  total_floors: number | null;
  underground_floors: number | null;
  ceiling_height: number | null;

  // Parking
  parking: string;
  parking_spaces: number | null;
  garage_count: number | null;

  // Amenities (booleans)
  balcony: boolean;
  terrace: boolean;
  garden: boolean;
  elevator: boolean;
  cellar: boolean;
  garage: boolean;
  pool: boolean;
  loggia: boolean;
  easy_access: string;
  low_energy: boolean;
  ftv_panels: boolean;
  solar_panels: boolean;
  mortgage: boolean;

  // Heating (arrays)
  heating: string[];
  heating_element: string[];
  heating_source: string[];
  water_heat_source: string[];

  // Infrastructure (arrays)
  electricity: string[];
  gas: string[];
  water: string[];
  gully: string[];
  road_type: string[];
  telecommunication: string[];
  transport: string[];
  internet_connection_type: string[];

  // Internet
  internet_connection_provider: string;
  internet_connection_speed: number | null;

  // Surroundings
  surroundings_type: string;
  protection: string;

  // Electrical
  circuit_breaker: string;
  phase_distribution: string;

  // Well
  well_type: string[];

  // Financial
  annuity: number | null;
  cost_of_living: string;
  commission: number | null;
  mortgage_percent: number | null;
  spor_percent: number | null;
  refundable_deposit: number | null;

  // Lease
  lease_type: string;
  tenant_not_pay_commission: boolean;
  ready_date: string;

  // Auction
  auction_kind: string;
  auction_date: string;
  auction_place: string;
  price_auction_principal: number | null;
  price_expert_report: number | null;
  price_minimum_bid: number | null;

  // Shares
  share_numerator: number | null;
  share_denominator: number | null;

  // Age
  year_built: number | null;
  last_renovation: number | null;
  acceptance_year: number | null;

  // Construction dates
  beginning_date: string;
  finish_date: string;
  sale_date: string;

  // Tour
  first_tour_date: string;

  // Status
  extra_info: string;
  exclusively_at_rk: boolean;
  personal_transfer: string;
  num_owners: number | null;
  apartment_number: number | null;

  // Keywords
  keywords: string[];

  // VR / panorama
  matterport_url: string;
  mapy_panorama_url: string;

  // Media
  image_src: string;
  image_alt: string;
  images: string[];

  // Assignment
  broker_id: string;
  project_id: string;
  featured: boolean;
  active: boolean;
};

export const EMPTY_FORM: PropertyFormData = {
  slug: "",
  title: "",
  listing_type: "sale",
  category: "apartment",
  subtype: "",
  rooms_label: "",
  price: 0,
  price_note: "",
  price_currency: "",
  price_unit: "",
  price_negotiation: false,
  city: "",
  district: "",
  street: "",
  zip: "",
  region: "",
  city_part: "",
  location_label: "",
  latitude: 0,
  longitude: 0,
  area: 0,
  land_area: null,
  built_up_area: null,
  floor_area: null,
  balcony_area: null,
  basin_area: null,
  cellar_area: null,
  garden_area: null,
  loggia_area: null,
  terrace_area: null,
  nolive_total_area: null,
  offices_area: null,
  production_area: null,
  shop_area: null,
  store_area: null,
  workshop_area: null,
  summary: "",
  description: "",
  condition: "",
  ownership: "",
  furnishing: "",
  energy_rating: "",
  building_material: "",
  flooring: "",
  object_type: "",
  object_kind: "",
  object_location: "",
  flat_class: "",
  floor: null,
  total_floors: null,
  underground_floors: null,
  ceiling_height: null,
  parking: "",
  parking_spaces: null,
  garage_count: null,
  balcony: false,
  terrace: false,
  garden: false,
  elevator: false,
  cellar: false,
  garage: false,
  pool: false,
  loggia: false,
  easy_access: "",
  low_energy: false,
  ftv_panels: false,
  solar_panels: false,
  mortgage: false,
  heating: [],
  heating_element: [],
  heating_source: [],
  water_heat_source: [],
  electricity: [],
  gas: [],
  water: [],
  gully: [],
  road_type: [],
  telecommunication: [],
  transport: [],
  internet_connection_type: [],
  internet_connection_provider: "",
  internet_connection_speed: null,
  surroundings_type: "",
  protection: "",
  circuit_breaker: "",
  phase_distribution: "",
  well_type: [],
  annuity: null,
  cost_of_living: "",
  commission: null,
  mortgage_percent: null,
  spor_percent: null,
  refundable_deposit: null,
  lease_type: "",
  tenant_not_pay_commission: false,
  ready_date: "",
  auction_kind: "",
  auction_date: "",
  auction_place: "",
  price_auction_principal: null,
  price_expert_report: null,
  price_minimum_bid: null,
  share_numerator: null,
  share_denominator: null,
  year_built: null,
  last_renovation: null,
  acceptance_year: null,
  beginning_date: "",
  finish_date: "",
  sale_date: "",
  first_tour_date: "",
  extra_info: "",
  exclusively_at_rk: false,
  personal_transfer: "",
  num_owners: null,
  apartment_number: null,
  keywords: [],
  matterport_url: "",
  mapy_panorama_url: "",
  image_src: "",
  image_alt: "",
  images: [],
  broker_id: "",
  project_id: "",
  featured: false,
  active: true,
};

// ===== SUBTYPE MAP =====
export const SUBTYPE_MAP: Record<string, Record<string, string>> = {
  apartment: ApartmentSubtypes,
  house: HouseSubtypes,
  land: LandSubtypes,
  commercial: CommercialSubtypes,
  other: OtherSubtypes,
};

// ===== HELPERS =====

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatPreviewPrice(price: number, currency?: string): string {
  if (!price) return "Na dotaz";
  const cur = (currency || "czk").toUpperCase();
  const localeMap: Record<string, string> = { CZK: "cs-CZ", EUR: "de-DE", GBP: "en-GB", USD: "en-US" };
  const symbolMap: Record<string, string> = { CZK: "K\u010d", EUR: "\u20ac", GBP: "\u00a3", USD: "$" };
  const locale = localeMap[cur] || "cs-CZ";
  const sym = symbolMap[cur] || "K\u010d";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price) + " " + sym;
}
