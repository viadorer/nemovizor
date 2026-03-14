"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import {
  ListingTypes,
  PropertyCategories,
  ApartmentSubtypes,
  HouseSubtypes,
  LandSubtypes,
  CommercialSubtypes,
  OtherSubtypes,
  PropertyConditions,
  BuildingMaterials,
  OwnershipTypes,
  FurnishingTypes,
  EnergyRatings,
  ParkingTypes,
  ObjectTypes,
  ObjectKinds,
  ObjectLocations,
  FlatClasses,
  HeatingTypes,
  HeatingElements,
  HeatingSources,
  WaterHeatSources,
  ElectricityTypes,
  GasTypes,
  WaterTypes,
  GullyTypes,
  RoadTypes,
  TelecommunicationTypes,
  TransportTypes,
  SurroundingsTypes,
  ProtectionTypes,
  CircuitBreakers,
  InternetConnectionTypes,
  WellTypes,
  AuctionKinds,
  LeaseTypes,
  PriceCurrencies,
  PriceUnits,
  ExtraInfoStatuses,
  EasyAccessTypes,
  PersonalTransferTypes,
  PhaseDistributions,
  type PropertyCategory,
} from "@/lib/types";

// ===== STEP DEFINITIONS =====
const STEPS = [
  { key: "basic", label: "Zakladni udaje" },
  { key: "price", label: "Cena" },
  { key: "location", label: "Lokace" },
  { key: "areas", label: "Plochy" },
  { key: "description", label: "Popis" },
  { key: "condition", label: "Stav a parametry" },
  { key: "floors", label: "Podlazi a parkovani" },
  { key: "amenities", label: "Vybaveni" },
  { key: "heating", label: "Topeni" },
  { key: "infrastructure", label: "Infrastruktura" },
  { key: "financial", label: "Financni udaje" },
  { key: "special", label: "Pronajem / Drazba / Podily" },
  { key: "dates", label: "Datumy a status" },
  { key: "media", label: "Media" },
  { key: "assignment", label: "Makler a publikace" },
] as const;

// ===== FORM DATA TYPE (mirrors DB columns exactly) =====
type PropertyFormData = {
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

const EMPTY_FORM: PropertyFormData = {
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
const SUBTYPE_MAP: Record<string, Record<string, string>> = {
  apartment: ApartmentSubtypes,
  house: HouseSubtypes,
  land: LandSubtypes,
  commercial: CommercialSubtypes,
  other: OtherSubtypes,
};

// ===== HELPERS =====

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {required && <span className="pf-required">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? `-- Vyberte --`}</option>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {required && <span className="pf-required">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  step,
  min,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: string;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {suffix && <span className="pf-suffix"> ({suffix})</span>}
      </label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        placeholder={placeholder}
        step={step ?? "any"}
        min={min}
      />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="pf-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function MultiSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: Record<string, string>;
}) {
  function toggle(key: string) {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <div className="pf-multi-select">
        {Object.entries(options).map(([k, v]) => (
          <label key={k} className="pf-multi-option">
            <input
              type="checkbox"
              checked={value.includes(k)}
              onChange={() => toggle(k)}
            />
            <span>{v}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
      />
    </div>
  );
}

function TagsField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const tag = input.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <div className="pf-tags-wrap">
        <div className="pf-tags">
          {value.map((tag, i) => (
            <span key={i} className="pf-tag">
              {tag}
              <button type="button" onClick={() => removeTag(i)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="pf-tags-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={placeholder ?? "Pridat..."}
          />
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={addTag}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addUrl() {
    const url = input.trim();
    if (url && !value.includes(url)) {
      onChange([...value, url]);
    }
    setInput("");
  }

  function removeUrl(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const arr = [...value];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onChange(arr);
  }

  function moveDown(idx: number) {
    if (idx === value.length - 1) return;
    const arr = [...value];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onChange(arr);
  }

  return (
    <div className="admin-form-group">
      <label>{label} ({value.length} fotek)</label>
      <div className="pf-image-list">
        {value.map((url, i) => (
          <div key={i} className="pf-image-item">
            <img src={url} alt={`Foto ${i + 1}`} className="pf-image-thumb" />
            <span className="pf-image-url">{url.length > 60 ? url.slice(0, 60) + "..." : url}</span>
            <div className="pf-image-actions">
              <button type="button" onClick={() => moveUp(i)} disabled={i === 0} title="Nahoru">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
              <button type="button" onClick={() => moveDown(i)} disabled={i === value.length - 1} title="Dolu">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <button type="button" onClick={() => removeUrl(i)} title="Odebrat" className="pf-image-remove">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="pf-tags-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="URL fotky..."
        />
        <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={addUrl}>
          Pridat
        </button>
      </div>
    </div>
  );
}

// ===== MAIN COMPONENT =====

type PropertyFormProps = {
  mode: "create" | "edit";
  propertyId?: string;
};

export function PropertyForm({ mode, propertyId }: PropertyFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PropertyFormData>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [brokers, setBrokers] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Load property data for edit mode
  useEffect(() => {
    if (mode === "edit" && propertyId) {
      setLoading(true);
      fetch(`/api/admin/properties?id=${propertyId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.data) {
            const d = res.data;
            setForm({
              slug: d.slug ?? "",
              title: d.title ?? "",
              listing_type: d.listing_type ?? "sale",
              category: d.category ?? "apartment",
              subtype: d.subtype ?? "",
              rooms_label: d.rooms_label ?? "",
              price: d.price ?? 0,
              price_note: d.price_note ?? "",
              price_currency: d.price_currency ?? "",
              price_unit: d.price_unit ?? "",
              price_negotiation: d.price_negotiation ?? false,
              city: d.city ?? "",
              district: d.district ?? "",
              street: d.street ?? "",
              zip: d.zip ?? "",
              region: d.region ?? "",
              city_part: d.city_part ?? "",
              location_label: d.location_label ?? "",
              latitude: d.latitude ?? 0,
              longitude: d.longitude ?? 0,
              area: d.area ?? 0,
              land_area: d.land_area ?? null,
              built_up_area: d.built_up_area ?? null,
              floor_area: d.floor_area ?? null,
              balcony_area: d.balcony_area ?? null,
              basin_area: d.basin_area ?? null,
              cellar_area: d.cellar_area ?? null,
              garden_area: d.garden_area ?? null,
              loggia_area: d.loggia_area ?? null,
              terrace_area: d.terrace_area ?? null,
              nolive_total_area: d.nolive_total_area ?? null,
              offices_area: d.offices_area ?? null,
              production_area: d.production_area ?? null,
              shop_area: d.shop_area ?? null,
              store_area: d.store_area ?? null,
              workshop_area: d.workshop_area ?? null,
              summary: d.summary ?? "",
              description: d.description ?? "",
              condition: d.condition ?? "",
              ownership: d.ownership ?? "",
              furnishing: d.furnishing ?? "",
              energy_rating: d.energy_rating ?? "",
              building_material: d.building_material ?? "",
              flooring: d.flooring ?? "",
              object_type: d.object_type ?? "",
              object_kind: d.object_kind ?? "",
              object_location: d.object_location ?? "",
              flat_class: d.flat_class ?? "",
              floor: d.floor ?? null,
              total_floors: d.total_floors ?? null,
              underground_floors: d.underground_floors ?? null,
              ceiling_height: d.ceiling_height ?? null,
              parking: d.parking ?? "",
              parking_spaces: d.parking_spaces ?? null,
              garage_count: d.garage_count ?? null,
              balcony: d.balcony ?? false,
              terrace: d.terrace ?? false,
              garden: d.garden ?? false,
              elevator: d.elevator ?? false,
              cellar: d.cellar ?? false,
              garage: d.garage ?? false,
              pool: d.pool ?? false,
              loggia: d.loggia ?? false,
              easy_access: d.easy_access ?? "",
              low_energy: d.low_energy ?? false,
              ftv_panels: d.ftv_panels ?? false,
              solar_panels: d.solar_panels ?? false,
              mortgage: d.mortgage ?? false,
              heating: d.heating ?? [],
              heating_element: d.heating_element ?? [],
              heating_source: d.heating_source ?? [],
              water_heat_source: d.water_heat_source ?? [],
              electricity: d.electricity ?? [],
              gas: d.gas ?? [],
              water: d.water ?? [],
              gully: d.gully ?? [],
              road_type: d.road_type ?? [],
              telecommunication: d.telecommunication ?? [],
              transport: d.transport ?? [],
              internet_connection_type: d.internet_connection_type ?? [],
              internet_connection_provider: d.internet_connection_provider ?? "",
              internet_connection_speed: d.internet_connection_speed ?? null,
              surroundings_type: d.surroundings_type ?? "",
              protection: d.protection ?? "",
              circuit_breaker: d.circuit_breaker ?? "",
              phase_distribution: d.phase_distribution ?? "",
              well_type: d.well_type ?? [],
              annuity: d.annuity ?? null,
              cost_of_living: d.cost_of_living ?? "",
              commission: d.commission ?? null,
              mortgage_percent: d.mortgage_percent ?? null,
              spor_percent: d.spor_percent ?? null,
              refundable_deposit: d.refundable_deposit ?? null,
              lease_type: d.lease_type ?? "",
              tenant_not_pay_commission: d.tenant_not_pay_commission ?? false,
              ready_date: d.ready_date ?? "",
              auction_kind: d.auction_kind ?? "",
              auction_date: d.auction_date ?? "",
              auction_place: d.auction_place ?? "",
              price_auction_principal: d.price_auction_principal ?? null,
              price_expert_report: d.price_expert_report ?? null,
              price_minimum_bid: d.price_minimum_bid ?? null,
              share_numerator: d.share_numerator ?? null,
              share_denominator: d.share_denominator ?? null,
              year_built: d.year_built ?? null,
              last_renovation: d.last_renovation ?? null,
              acceptance_year: d.acceptance_year ?? null,
              beginning_date: d.beginning_date ?? "",
              finish_date: d.finish_date ?? "",
              sale_date: d.sale_date ?? "",
              first_tour_date: d.first_tour_date ?? "",
              extra_info: d.extra_info ?? "",
              exclusively_at_rk: d.exclusively_at_rk ?? false,
              personal_transfer: d.personal_transfer ?? "",
              num_owners: d.num_owners ?? null,
              apartment_number: d.apartment_number ?? null,
              keywords: d.keywords ?? [],
              matterport_url: d.matterport_url ?? "",
              mapy_panorama_url: d.mapy_panorama_url ?? "",
              image_src: d.image_src ?? "",
              image_alt: d.image_alt ?? "",
              images: d.images ?? [],
              broker_id: d.broker_id ?? "",
              project_id: d.project_id ?? "",
              featured: d.featured ?? false,
              active: d.active ?? true,
            });
          }
        })
        .catch(() => setError("Nepodařilo se načíst nemovitost"))
        .finally(() => setLoading(false));
    }
  }, [mode, propertyId]);

  // Load brokers and projects for assignment step
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    // Load brokers
    supabase
      .from("brokers")
      .select("id, name")
      .order("name")
      .limit(500)
      .then(({ data }) => {
        if (data) setBrokers(data as { id: string; name: string }[]);
      });

    // Load projects
    supabase
      .from("projects")
      .select("id, name")
      .order("name")
      .limit(200)
      .then(({ data }) => {
        if (data) setProjects(data as { id: string; name: string }[]);
      });
  }, []);

  // Update field helper
  const set = useCallback(
    <K extends keyof PropertyFormData>(key: K, value: PropertyFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Auto-generate slug from title
  const autoSlug = useCallback(() => {
    if (form.title && !form.slug) {
      set("slug", slugify(form.title));
    }
  }, [form.title, form.slug, set]);

  // Auto-generate location_label
  useEffect(() => {
    const parts = [form.street, form.city_part, form.city, form.district].filter(Boolean);
    if (parts.length > 0) {
      set("location_label", parts.join(", "));
    }
  }, [form.street, form.city_part, form.city, form.district, set]);

  // Subtypes for current category
  const currentSubtypes = useMemo(() => {
    return SUBTYPE_MAP[form.category] ?? {};
  }, [form.category]);

  // Build payload (strip empty strings for nullable enums)
  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(form)) {
      // Skip empty strings for nullable enum/text fields — send null instead
      if (value === "" && key !== "title" && key !== "slug" && key !== "summary" && key !== "image_src" && key !== "image_alt") {
        payload[key] = null;
        continue;
      }
      payload[key] = value;
    }

    return payload;
  }

  // Submit
  async function handleSubmit() {
    if (!form.title.trim()) {
      setError("Nazev je povinny");
      setStep(0);
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug je povinny");
      setStep(0);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();

      const url = "/api/admin/properties";
      const method = mode === "create" ? "POST" : "PATCH";

      if (mode === "edit") {
        (payload as Record<string, unknown>).id = propertyId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Chyba pri ukladani");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/sprava/nemovitosti");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba pri ukladani");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="pf-loading">
        <div className="pf-spinner" />
        <p>Nacitam data...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="pf-success">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
        <h3>{mode === "create" ? "Nemovitost vytvorena" : "Nemovitost ulozena"}</h3>
        <p>Presmerovavam...</p>
      </div>
    );
  }

  return (
    <div className="pf-wrap">
      {/* Header */}
      <div className="pf-header">
        <button
          className="admin-btn admin-btn--secondary"
          onClick={() => router.push("/dashboard/sprava/nemovitosti")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Zpet
        </button>
        <h2>{mode === "create" ? "Nova nemovitost" : "Upravit nemovitost"}</h2>
      </div>

      {/* Step navigation */}
      <div className="pf-steps">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            className={`pf-step${i === step ? " pf-step--active" : ""}${i < step ? " pf-step--done" : ""}`}
            onClick={() => setStep(i)}
          >
            <span className="pf-step-num">{i + 1}</span>
            <span className="pf-step-label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="pf-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
          {error}
          <button onClick={() => setError(null)} className="pf-error-close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="pf-content">
        {/* STEP 0: Basic */}
        {step === 0 && (
          <div className="pf-section">
            <h3>Zakladni udaje</h3>
            <div className="admin-form-row">
              <SelectField
                label="Typ nabidky"
                value={form.listing_type}
                onChange={(v) => set("listing_type", v)}
                options={ListingTypes}
                required
              />
              <SelectField
                label="Kategorie"
                value={form.category}
                onChange={(v) => {
                  set("category", v);
                  set("subtype", "");
                }}
                options={PropertyCategories}
                required
              />
            </div>
            <div className="admin-form-row">
              <SelectField
                label="Podtyp"
                value={form.subtype}
                onChange={(v) => set("subtype", v)}
                options={currentSubtypes}
              />
              <TextField
                label="Dispozice"
                value={form.rooms_label}
                onChange={(v) => set("rooms_label", v)}
                placeholder="napr. 3+kk"
              />
            </div>
            <TextField
              label="Nazev inzeratu"
              value={form.title}
              onChange={(v) => set("title", v)}
              required
              placeholder="Prodej bytu 3+kk, Praha 5"
            />
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Slug (URL)
                  <span className="pf-required">*</span>
                </label>
                <div className="pf-slug-row">
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="prodej-bytu-3kk-praha-5"
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary admin-btn--sm"
                    onClick={autoSlug}
                    title="Vygenerovat z nazvu"
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Price */}
        {step === 1 && (
          <div className="pf-section">
            <h3>Cena</h3>
            <div className="admin-form-row">
              <NumberField
                label="Cena"
                value={form.price}
                onChange={(v) => set("price", v ?? 0)}
                suffix="Kc"
                min={0}
              />
              <SelectField
                label="Mena"
                value={form.price_currency}
                onChange={(v) => set("price_currency", v)}
                options={PriceCurrencies}
              />
            </div>
            <div className="admin-form-row">
              <SelectField
                label="Jednotka ceny"
                value={form.price_unit}
                onChange={(v) => set("price_unit", v)}
                options={PriceUnits}
              />
              <CheckboxField
                label="Cena k jednani"
                checked={form.price_negotiation}
                onChange={(v) => set("price_negotiation", v)}
              />
            </div>
            <TextField
              label="Poznamka k cene"
              value={form.price_note}
              onChange={(v) => set("price_note", v)}
              placeholder="napr. Cena vcetne provize"
            />
          </div>
        )}

        {/* STEP 2: Location */}
        {step === 2 && (
          <div className="pf-section">
            <h3>Lokace</h3>
            <div className="admin-form-row">
              <TextField
                label="Mesto"
                value={form.city}
                onChange={(v) => set("city", v)}
                required
                placeholder="Praha"
              />
              <TextField
                label="Okres"
                value={form.district}
                onChange={(v) => set("district", v)}
                placeholder="Praha-zapad"
              />
            </div>
            <div className="admin-form-row">
              <TextField
                label="Ulice"
                value={form.street}
                onChange={(v) => set("street", v)}
                placeholder="Vinohradska 123"
              />
              <TextField
                label="Mestska cast"
                value={form.city_part}
                onChange={(v) => set("city_part", v)}
                placeholder="Vinohrady"
              />
            </div>
            <div className="admin-form-row">
              <TextField
                label="PSC"
                value={form.zip}
                onChange={(v) => set("zip", v)}
                placeholder="120 00"
              />
              <TextField
                label="Kraj"
                value={form.region}
                onChange={(v) => set("region", v)}
                placeholder="Hlavni mesto Praha"
              />
            </div>
            <TextField
              label="Popis lokace (automaticky)"
              value={form.location_label}
              onChange={(v) => set("location_label", v)}
              placeholder="Automaticky z ulice, casti, mesta"
            />
            <div className="admin-form-row">
              <NumberField
                label="Zemepisna sirka"
                value={form.latitude}
                onChange={(v) => set("latitude", v ?? 0)}
                step="0.000001"
                suffix="lat"
              />
              <NumberField
                label="Zemepisna delka"
                value={form.longitude}
                onChange={(v) => set("longitude", v ?? 0)}
                step="0.000001"
                suffix="lon"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Areas */}
        {step === 3 && (
          <div className="pf-section">
            <h3>Plochy</h3>
            <div className="admin-form-row">
              <NumberField label="Uzitna plocha" value={form.area} onChange={(v) => set("area", v ?? 0)} suffix="m2" min={0} />
              <NumberField label="Plocha pozemku" value={form.land_area} onChange={(v) => set("land_area", v)} suffix="m2" min={0} />
            </div>
            <div className="admin-form-row">
              <NumberField label="Zastavena plocha" value={form.built_up_area} onChange={(v) => set("built_up_area", v)} suffix="m2" />
              <NumberField label="Celkova plocha" value={form.floor_area} onChange={(v) => set("floor_area", v)} suffix="m2" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Balkon" value={form.balcony_area} onChange={(v) => set("balcony_area", v)} suffix="m2" />
              <NumberField label="Lodzie" value={form.loggia_area} onChange={(v) => set("loggia_area", v)} suffix="m2" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Terasa" value={form.terrace_area} onChange={(v) => set("terrace_area", v)} suffix="m2" />
              <NumberField label="Zahrada" value={form.garden_area} onChange={(v) => set("garden_area", v)} suffix="m2" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Sklep" value={form.cellar_area} onChange={(v) => set("cellar_area", v)} suffix="m2" />
              <NumberField label="Bazen" value={form.basin_area} onChange={(v) => set("basin_area", v)} suffix="m2" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Kancelare" value={form.offices_area} onChange={(v) => set("offices_area", v)} suffix="m2" />
              <NumberField label="Vyroba" value={form.production_area} onChange={(v) => set("production_area", v)} suffix="m2" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Obchod" value={form.shop_area} onChange={(v) => set("shop_area", v)} suffix="m2" />
              <NumberField label="Sklad" value={form.store_area} onChange={(v) => set("store_area", v)} suffix="m2" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Dilna" value={form.workshop_area} onChange={(v) => set("workshop_area", v)} suffix="m2" />
              <NumberField label="Nebytove prostory celkem" value={form.nolive_total_area} onChange={(v) => set("nolive_total_area", v)} suffix="m2" />
            </div>
          </div>
        )}

        {/* STEP 4: Description */}
        {step === 4 && (
          <div className="pf-section">
            <h3>Popis nemovitosti</h3>
            <TextareaField
              label="Strucny popis (summary)"
              value={form.summary}
              onChange={(v) => set("summary", v)}
              placeholder="Kratky popisek pro karticku a nahled..."
              rows={3}
            />
            <TextareaField
              label="Podrobny popis"
              value={form.description ?? ""}
              onChange={(v) => set("description", v)}
              placeholder="Podrobny popis nemovitosti vcetne vsech dulezitych informaci..."
              rows={10}
            />
          </div>
        )}

        {/* STEP 5: Condition & Parameters */}
        {step === 5 && (
          <div className="pf-section">
            <h3>Stav a parametry</h3>
            <div className="admin-form-row">
              <SelectField label="Stav objektu" value={form.condition} onChange={(v) => set("condition", v)} options={PropertyConditions} />
              <SelectField label="Vlastnictvi" value={form.ownership} onChange={(v) => set("ownership", v)} options={OwnershipTypes} />
            </div>
            <div className="admin-form-row">
              <SelectField label="Vybaveni" value={form.furnishing} onChange={(v) => set("furnishing", v)} options={FurnishingTypes} />
              <SelectField label="Energeticky stitek" value={form.energy_rating} onChange={(v) => set("energy_rating", v)} options={EnergyRatings} />
            </div>
            <div className="admin-form-row">
              <SelectField label="Material stavby" value={form.building_material} onChange={(v) => set("building_material", v)} options={BuildingMaterials} />
              <TextField label="Podlaha" value={form.flooring} onChange={(v) => set("flooring", v)} placeholder="napr. dlazba, laminat" />
            </div>

            <h4 className="pf-subtitle">Dum / Byt specificke</h4>
            <div className="admin-form-row">
              <SelectField label="Typ domu" value={form.object_type} onChange={(v) => set("object_type", v)} options={ObjectTypes} />
              <SelectField label="Poloha domu" value={form.object_kind} onChange={(v) => set("object_kind", v)} options={ObjectKinds} />
            </div>
            <div className="admin-form-row">
              <SelectField label="Umisteni objektu" value={form.object_location} onChange={(v) => set("object_location", v)} options={ObjectLocations} />
              <SelectField label="Typ bytu" value={form.flat_class} onChange={(v) => set("flat_class", v)} options={FlatClasses} />
            </div>

            <h4 className="pf-subtitle">Stari</h4>
            <div className="admin-form-row">
              <NumberField label="Rok vystavby" value={form.year_built} onChange={(v) => set("year_built", v)} placeholder="1985" />
              <NumberField label="Posledni rekonstrukce" value={form.last_renovation} onChange={(v) => set("last_renovation", v)} placeholder="2020" />
            </div>
            <NumberField label="Rok kolaudace" value={form.acceptance_year} onChange={(v) => set("acceptance_year", v)} placeholder="1986" />
          </div>
        )}

        {/* STEP 6: Floors & Parking */}
        {step === 6 && (
          <div className="pf-section">
            <h3>Podlazi</h3>
            <div className="admin-form-row">
              <NumberField label="Podlazi" value={form.floor} onChange={(v) => set("floor", v)} placeholder="napr. 3" />
              <NumberField label="Pocet podlazi celkem" value={form.total_floors} onChange={(v) => set("total_floors", v)} placeholder="napr. 8" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Podzemni podlazi" value={form.underground_floors} onChange={(v) => set("underground_floors", v)} />
              <NumberField label="Svetla vyska stropu" value={form.ceiling_height} onChange={(v) => set("ceiling_height", v)} suffix="m" step="0.01" />
            </div>

            <h3 className="pf-subtitle">Parkovani</h3>
            <div className="admin-form-row">
              <SelectField label="Typ parkovani" value={form.parking} onChange={(v) => set("parking", v)} options={ParkingTypes} />
              <NumberField label="Pocet parkovacich mist" value={form.parking_spaces} onChange={(v) => set("parking_spaces", v)} min={0} />
            </div>
            <NumberField label="Pocet garazi" value={form.garage_count} onChange={(v) => set("garage_count", v)} min={0} />
          </div>
        )}

        {/* STEP 7: Amenities */}
        {step === 7 && (
          <div className="pf-section">
            <h3>Vybaveni a vlastnosti</h3>
            <div className="pf-checkbox-grid">
              <CheckboxField label="Balkon" checked={form.balcony} onChange={(v) => set("balcony", v)} />
              <CheckboxField label="Terasa" checked={form.terrace} onChange={(v) => set("terrace", v)} />
              <CheckboxField label="Zahrada" checked={form.garden} onChange={(v) => set("garden", v)} />
              <CheckboxField label="Vytah" checked={form.elevator} onChange={(v) => set("elevator", v)} />
              <CheckboxField label="Sklep" checked={form.cellar} onChange={(v) => set("cellar", v)} />
              <CheckboxField label="Garaz" checked={form.garage} onChange={(v) => set("garage", v)} />
              <CheckboxField label="Bazen" checked={form.pool} onChange={(v) => set("pool", v)} />
              <CheckboxField label="Lodzie" checked={form.loggia} onChange={(v) => set("loggia", v)} />
              <CheckboxField label="Nizkoenergeticky" checked={form.low_energy} onChange={(v) => set("low_energy", v)} />
              <CheckboxField label="FTV panely" checked={form.ftv_panels} onChange={(v) => set("ftv_panels", v)} />
              <CheckboxField label="Solarni panely" checked={form.solar_panels} onChange={(v) => set("solar_panels", v)} />
              <CheckboxField label="Hypoteka mozna" checked={form.mortgage} onChange={(v) => set("mortgage", v)} />
            </div>
            <div className="admin-form-row" style={{ marginTop: 16 }}>
              <SelectField label="Bezbarierovy pristup" value={form.easy_access} onChange={(v) => set("easy_access", v)} options={EasyAccessTypes} />
            </div>
          </div>
        )}

        {/* STEP 8: Heating */}
        {step === 8 && (
          <div className="pf-section">
            <h3>Topeni</h3>
            <MultiSelectField label="Typ topeni" value={form.heating} onChange={(v) => set("heating", v)} options={HeatingTypes} />
            <MultiSelectField label="Topne teleso" value={form.heating_element} onChange={(v) => set("heating_element", v)} options={HeatingElements} />
            <MultiSelectField label="Zdroj topeni" value={form.heating_source} onChange={(v) => set("heating_source", v)} options={HeatingSources} />
            <MultiSelectField label="Zdroj teple vody" value={form.water_heat_source} onChange={(v) => set("water_heat_source", v)} options={WaterHeatSources} />
          </div>
        )}

        {/* STEP 9: Infrastructure */}
        {step === 9 && (
          <div className="pf-section">
            <h3>Infrastruktura a site</h3>
            <MultiSelectField label="Elektrina" value={form.electricity} onChange={(v) => set("electricity", v)} options={ElectricityTypes} />
            <MultiSelectField label="Plyn" value={form.gas} onChange={(v) => set("gas", v)} options={GasTypes} />
            <MultiSelectField label="Voda" value={form.water} onChange={(v) => set("water", v)} options={WaterTypes} />
            <MultiSelectField label="Odpad" value={form.gully} onChange={(v) => set("gully", v)} options={GullyTypes} />
            <MultiSelectField label="Komunikace" value={form.road_type} onChange={(v) => set("road_type", v)} options={RoadTypes} />
            <MultiSelectField label="Telekomunikace" value={form.telecommunication} onChange={(v) => set("telecommunication", v)} options={TelecommunicationTypes} />
            <MultiSelectField label="Doprava" value={form.transport} onChange={(v) => set("transport", v)} options={TransportTypes} />
            <MultiSelectField label="Internet" value={form.internet_connection_type} onChange={(v) => set("internet_connection_type", v)} options={InternetConnectionTypes} />

            <h4 className="pf-subtitle">Internet podrobnosti</h4>
            <div className="admin-form-row">
              <TextField label="Poskytovatel internetu" value={form.internet_connection_provider} onChange={(v) => set("internet_connection_provider", v)} placeholder="napr. O2, UPC" />
              <NumberField label="Rychlost internetu" value={form.internet_connection_speed} onChange={(v) => set("internet_connection_speed", v)} suffix="Mbps" />
            </div>

            <h4 className="pf-subtitle">Okoli a ochrana</h4>
            <div className="admin-form-row">
              <SelectField label="Typ zastavby" value={form.surroundings_type} onChange={(v) => set("surroundings_type", v)} options={SurroundingsTypes} />
              <SelectField label="Ochrana" value={form.protection} onChange={(v) => set("protection", v)} options={ProtectionTypes} />
            </div>

            <h4 className="pf-subtitle">Elektricke parametry</h4>
            <div className="admin-form-row">
              <SelectField label="Jistic" value={form.circuit_breaker} onChange={(v) => set("circuit_breaker", v)} options={CircuitBreakers} />
              <SelectField label="Faze" value={form.phase_distribution} onChange={(v) => set("phase_distribution", v)} options={PhaseDistributions} />
            </div>

            <h4 className="pf-subtitle">Studna</h4>
            <MultiSelectField label="Typ studny" value={form.well_type} onChange={(v) => set("well_type", v)} options={WellTypes} />
          </div>
        )}

        {/* STEP 10: Financial */}
        {step === 10 && (
          <div className="pf-section">
            <h3>Financni udaje</h3>
            <div className="admin-form-row">
              <NumberField label="Anuita / mesicni splatka" value={form.annuity} onChange={(v) => set("annuity", v)} suffix="Kc" />
              <TextField label="Naklady na bydleni" value={form.cost_of_living} onChange={(v) => set("cost_of_living", v)} placeholder="napr. 5 000 Kc/mesic" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Provize" value={form.commission} onChange={(v) => set("commission", v)} suffix="Kc" />
              <NumberField label="Procento hypoteky" value={form.mortgage_percent} onChange={(v) => set("mortgage_percent", v)} suffix="%" />
            </div>
            <div className="admin-form-row">
              <NumberField label="Procento sporeni" value={form.spor_percent} onChange={(v) => set("spor_percent", v)} suffix="%" />
              <NumberField label="Vratna kauce" value={form.refundable_deposit} onChange={(v) => set("refundable_deposit", v)} suffix="Kc" />
            </div>
          </div>
        )}

        {/* STEP 11: Lease / Auction / Shares */}
        {step === 11 && (
          <div className="pf-section">
            <h3>Specialni udaje dle typu nabidky</h3>

            {/* Lease section — show for rent */}
            <div className="pf-conditional">
              <h4 className="pf-subtitle">Pronajem</h4>
              <p className="pf-hint">Relevantni pro typ nabidky: Pronajem</p>
              <div className="admin-form-row">
                <SelectField label="Typ pronajmu" value={form.lease_type} onChange={(v) => set("lease_type", v)} options={LeaseTypes} />
                <CheckboxField label="Najemce neplati provizi" checked={form.tenant_not_pay_commission} onChange={(v) => set("tenant_not_pay_commission", v)} />
              </div>
              <TextField label="Datum nastehhovani" value={form.ready_date} onChange={(v) => set("ready_date", v)} type="date" />
            </div>

            {/* Auction section */}
            <div className="pf-conditional">
              <h4 className="pf-subtitle">Drazba</h4>
              <p className="pf-hint">Relevantni pro typ nabidky: Drazba</p>
              <div className="admin-form-row">
                <SelectField label="Druh drazby" value={form.auction_kind} onChange={(v) => set("auction_kind", v)} options={AuctionKinds} />
                <TextField label="Datum drazby" value={form.auction_date} onChange={(v) => set("auction_date", v)} type="date" />
              </div>
              <TextField label="Misto drazby" value={form.auction_place} onChange={(v) => set("auction_place", v)} placeholder="Adresa mista drazby" />
              <div className="admin-form-row">
                <NumberField label="Jistina" value={form.price_auction_principal} onChange={(v) => set("price_auction_principal", v)} suffix="Kc" />
                <NumberField label="Cena znaleckeho posudku" value={form.price_expert_report} onChange={(v) => set("price_expert_report", v)} suffix="Kc" />
              </div>
              <NumberField label="Nejnizsi podani" value={form.price_minimum_bid} onChange={(v) => set("price_minimum_bid", v)} suffix="Kc" />
            </div>

            {/* Shares section */}
            <div className="pf-conditional">
              <h4 className="pf-subtitle">Podily</h4>
              <p className="pf-hint">Relevantni pro typ nabidky: Podily</p>
              <div className="admin-form-row">
                <NumberField label="Citatel podilu" value={form.share_numerator} onChange={(v) => set("share_numerator", v)} placeholder="napr. 1" />
                <NumberField label="Jmenovatel podilu" value={form.share_denominator} onChange={(v) => set("share_denominator", v)} placeholder="napr. 4" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 12: Dates & Status */}
        {step === 12 && (
          <div className="pf-section">
            <h3>Datumy a status</h3>

            <h4 className="pf-subtitle">Datumy vystavby</h4>
            <div className="admin-form-row">
              <TextField label="Zacatek vystavby" value={form.beginning_date} onChange={(v) => set("beginning_date", v)} type="date" />
              <TextField label="Konec vystavby" value={form.finish_date} onChange={(v) => set("finish_date", v)} type="date" />
            </div>
            <div className="admin-form-row">
              <TextField label="Datum prodeje" value={form.sale_date} onChange={(v) => set("sale_date", v)} type="date" />
              <TextField label="Prvni prohlidka" value={form.first_tour_date} onChange={(v) => set("first_tour_date", v)} type="date" />
            </div>

            <h4 className="pf-subtitle">Status inzeratu</h4>
            <div className="admin-form-row">
              <SelectField label="Stav" value={form.extra_info} onChange={(v) => set("extra_info", v)} options={ExtraInfoStatuses} />
              <SelectField label="Prevod do OV" value={form.personal_transfer} onChange={(v) => set("personal_transfer", v)} options={PersonalTransferTypes} />
            </div>
            <div className="admin-form-row">
              <CheckboxField label="Exkluzivne u RK" checked={form.exclusively_at_rk} onChange={(v) => set("exclusively_at_rk", v)} />
              <NumberField label="Pocet vlastniku" value={form.num_owners} onChange={(v) => set("num_owners", v)} />
            </div>
            <NumberField label="Cislo bytove jednotky" value={form.apartment_number} onChange={(v) => set("apartment_number", v)} />

            <h4 className="pf-subtitle">Klicova slova</h4>
            <TagsField
              label="Klicova slova"
              value={form.keywords}
              onChange={(v) => set("keywords", v)}
              placeholder="Pridat klicove slovo..."
            />
          </div>
        )}

        {/* STEP 13: Media */}
        {step === 13 && (
          <div className="pf-section">
            <h3>Media</h3>

            <h4 className="pf-subtitle">Hlavni fotka</h4>
            <div className="admin-form-row">
              <TextField label="URL hlavni fotky" value={form.image_src} onChange={(v) => set("image_src", v)} placeholder="https://..." />
              <TextField label="Alt text" value={form.image_alt} onChange={(v) => set("image_alt", v)} placeholder="Popis fotky" />
            </div>
            {form.image_src && (
              <div className="pf-main-image-preview">
                <img src={form.image_src} alt={form.image_alt || "Nahled"} />
              </div>
            )}

            <h4 className="pf-subtitle">Galerie fotek</h4>
            <ImageListField
              label="Fotky v galerii"
              value={form.images}
              onChange={(v) => set("images", v)}
            />

            <h4 className="pf-subtitle">Virtualni prohlidky a video</h4>
            <TextField
              label="Matterport URL (3D prohlidka)"
              value={form.matterport_url}
              onChange={(v) => set("matterport_url", v)}
              placeholder="https://my.matterport.com/show/?m=..."
            />
            <TextField
              label="Mapy.cz panorama URL"
              value={form.mapy_panorama_url}
              onChange={(v) => set("mapy_panorama_url", v)}
              placeholder="https://..."
            />
          </div>
        )}

        {/* STEP 14: Assignment & Publication */}
        {step === 14 && (
          <div className="pf-section">
            <h3>Makler a publikace</h3>

            <div className="admin-form-group">
              <label>Prirazeny makler</label>
              <select value={form.broker_id} onChange={(e) => set("broker_id", e.target.value)}>
                <option value="">-- Bez maklere --</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label>Projekt</label>
              <select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
                <option value="">-- Bez projektu --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="pf-checkbox-grid" style={{ marginTop: 16 }}>
              <CheckboxField label="Aktivni (zobrazit na webu)" checked={form.active} onChange={(v) => set("active", v)} />
              <CheckboxField label="Doporucena (premium)" checked={form.featured} onChange={(v) => set("featured", v)} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="pf-nav">
        <button
          className="admin-btn admin-btn--secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Predchozi
        </button>

        <span className="pf-nav-info">
          Krok {step + 1} z {STEPS.length}
        </span>

        {step < STEPS.length - 1 ? (
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Dalsi
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          <button
            className="admin-btn admin-btn--primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <span className="pf-spinner-sm" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            {mode === "create" ? "Vytvorit nemovitost" : "Ulozit zmeny"}
          </button>
        )}
      </div>
    </div>
  );
}
