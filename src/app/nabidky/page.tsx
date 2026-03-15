"use client";

import { Suspense, useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { PropertyCard } from "@/components/property-card";
import { SiteHeader } from "@/components/site-header";
import type { Property } from "@/lib/types";
import type { MapBounds } from "@/components/property-map";
import {
  ListingType, PropertyCategory,
  ApartmentSubtypes, HouseSubtypes, LandSubtypes, CommercialSubtypes, OtherSubtypes,
} from "@/lib/types";
import { LocationSearch } from "@/components/location-search";
import type { DbCity } from "@/components/location-search";
import { SavedSearches } from "@/components/saved-searches";
import { AiSearch } from "@/components/ai-search";
import { saveCurrentSearch } from "@/lib/saved-searches";
import type { SavedSearch } from "@/lib/types";

const PropertyMap = dynamic(() => import("@/components/property-map"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span>Načítání mapy...</span>
    </div>
  ),
});

const categoryLabels: Record<PropertyCategory, string> = {
  apartment: "Byt", house: "Dům", land: "Pozemek", commercial: "Komerční", other: "Ostatní",
};

const subtypesByCategory: Record<PropertyCategory, Record<string, string>> = {
  apartment: ApartmentSubtypes, house: HouseSubtypes, land: LandSubtypes,
  commercial: CommercialSubtypes, other: OtherSubtypes,
};

const listingTypeLabels: Record<ListingType, string> = {
  sale: "Prodej", rent: "Pronájem", auction: "Dražba", shares: "Podíly", project: "Projekt",
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="page-shell"><SiteHeader /><main className="search-page" /></div>}>
      <ListingsContent />
    </Suspense>
  );
}

// ===== DROPDOWN COMPONENT (single-select) =====
type DropdownProps<T extends string> = {
  label: string;
  value: T | null;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T | null) => void;
};

function FilterDropdown<T extends string>({ label, value, options, onChange }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedLabel = value ? options.find((o) => o.value === value)?.label : null;

  return (
    <div className="filter-dropdown" ref={ref}>
      <button
        className={`filter-dropdown-trigger ${value ? "filter-dropdown-trigger--active" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span>{selectedLabel ?? label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`filter-dropdown-chevron ${open ? "filter-dropdown-chevron--open" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="filter-dropdown-menu">
          <button
            className={`filter-dropdown-item ${!value ? "filter-dropdown-item--active" : ""}`}
            onClick={() => { onChange(null); setOpen(false); }}
          >
            Vše
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`filter-dropdown-item ${value === opt.value ? "filter-dropdown-item--active" : ""}`}
              onClick={() => { onChange(value === opt.value ? null : opt.value); setOpen(false); }}
            >
              {opt.label}
              {opt.count !== undefined && (
                <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: "0.8em" }}>{opt.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== MULTI-SELECT DROPDOWN =====
type DropdownOption = { value: string; label: string; count?: number };
type DropdownGroup = { groupLabel: string; options: DropdownOption[] };
type MultiDropdownProps = {
  label: string;
  values: string[];
  options: DropdownOption[];
  groups?: DropdownGroup[];
  onChange: (values: string[]) => void;
};

function MultiFilterDropdown({ label, values, options, groups, onChange }: MultiDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allOpts = groups ? groups.flatMap((g) => g.options) : options;
  const isActive = values.length > 0;
  const displayLabel = isActive
    ? values.length === 1
      ? allOpts.find((o) => o.value === values[0])?.label ?? label
      : `${label} (${values.length})`
    : label;

  function toggle(val: string) {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  }

  function renderOption(opt: DropdownOption, keyPrefix: string | number = "") {
    const k = typeof keyPrefix === "string" && keyPrefix ? `${keyPrefix}-${opt.value}` : opt.value;
    return (
      <button
        key={k}
        className={`filter-dropdown-item ${values.includes(opt.value) ? "filter-dropdown-item--active" : ""}`}
        onClick={() => toggle(opt.value)}
      >
        <span className="filter-checkbox">{values.includes(opt.value) ? "\u2713" : ""}</span>
        {opt.label}
        {opt.count !== undefined && (
          <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: "0.8em" }}>{opt.count}</span>
        )}
      </button>
    );
  }

  return (
    <div className="filter-dropdown" ref={ref}>
      <button
        className={`filter-dropdown-trigger ${isActive ? "filter-dropdown-trigger--active" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span>{displayLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`filter-dropdown-chevron ${open ? "filter-dropdown-chevron--open" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="filter-dropdown-menu">
          <button
            className={`filter-dropdown-item ${!isActive ? "filter-dropdown-item--active" : ""}`}
            onClick={() => { onChange([]); }}
          >
            Vše
          </button>
          {groups ? (
            groups.map((g) => (
              <div key={g.groupLabel}>
                <div className="filter-dropdown-group-label">{g.groupLabel}</div>
                {g.options.map((opt) => (
                  <button
                    key={`${g.groupLabel}-${opt.value}`}
                    className={`filter-dropdown-item ${values.includes(opt.value) ? "filter-dropdown-item--active" : ""}`}
                    onClick={() => toggle(opt.value)}
                  >
                    <span className="filter-checkbox">{values.includes(opt.value) ? "\u2713" : ""}</span>
                    {opt.label}
                    {opt.count !== undefined && (
                      <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: "0.8em" }}>{opt.count}</span>
                    )}
                  </button>
                ))}
              </div>
            ))
          ) : (
            options.map(renderOption)
          )}
        </div>
      )}
    </div>
  );
}

// ===== RANGE DROPDOWN =====
function RangeDropdown({
  label, minValue, maxValue, onMinChange, onMaxChange, presets, unit,
}: {
  label: string; minValue: number | null; maxValue: number | null;
  onMinChange: (v: number | null) => void; onMaxChange: (v: number | null) => void;
  presets: number[]; unit: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasValue = minValue !== null || maxValue !== null;
  const formatNum = (n: number) =>
    n >= 1000000 ? `${(n / 1000000).toFixed(1).replace(".0", "")} M` : n >= 1000 ? `${n / 1000} tis.` : String(n);

  const displayLabel = hasValue
    ? `${minValue ? formatNum(minValue) : "0"} - ${maxValue ? formatNum(maxValue) : "\u221e"} ${unit}`
    : label;

  return (
    <div className="filter-dropdown" ref={ref}>
      <button
        className={`filter-dropdown-trigger ${hasValue ? "filter-dropdown-trigger--active" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span>{displayLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`filter-dropdown-chevron ${open ? "filter-dropdown-chevron--open" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="filter-dropdown-menu" style={{ minWidth: 220, padding: 12 }}>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Od</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            <button className={`filter-dropdown-item ${minValue === null ? "filter-dropdown-item--active" : ""}`} style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMinChange(null)}>Min</button>
            {presets.map((v) => (
              <button key={`min-${v}`} className={`filter-dropdown-item ${minValue === v ? "filter-dropdown-item--active" : ""}`} style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMinChange(minValue === v ? null : v)}>
                {formatNum(v)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Do</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button className={`filter-dropdown-item ${maxValue === null ? "filter-dropdown-item--active" : ""}`} style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMaxChange(null)}>Max</button>
            {presets.map((v) => (
              <button key={`max-${v}`} className={`filter-dropdown-item ${maxValue === v ? "filter-dropdown-item--active" : ""}`} style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMaxChange(maxValue === v ? null : v)}>
                {formatNum(v)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Types for API responses =====
type FilterOption = { value: string; count: number };
type FilterOptionsResponse = {
  categories: FilterOption[];
  cities: FilterOption[];
  subtypes: FilterOption[];
  listingTypes: FilterOption[];
  priceRange: { min: number; max: number };
  areaRange: { min: number; max: number };
};

type MapPoint = {
  id: string;
  lat: number;
  lon: number;
  price: number;
  price_currency: string | null;
  category: string;
  listing_type: string;
  title: string;
  slug: string;
  rooms_label: string;
  image_src: string | null;
  subtype: string | null;
  area: number | null;
  district: string | null;
};

type PropertiesResponse = {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

// ===== Helper: build query string from filters =====
function buildFilterParams(filters: {
  listingType: string | null;
  categories: string[];
  subtypes: string[];
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
}) {
  const p = new URLSearchParams();
  if (filters.listingType) p.set("listing_type", filters.listingType);
  if (filters.categories.length) p.set("category", filters.categories.join(","));
  if (filters.subtypes.length) p.set("subtype", filters.subtypes.join(","));
  if (filters.city) p.set("city", filters.city);
  if (filters.priceMin) p.set("price_min", String(filters.priceMin));
  if (filters.priceMax) p.set("price_max", String(filters.priceMax));
  if (filters.areaMin) p.set("area_min", String(filters.areaMin));
  if (filters.areaMax) p.set("area_max", String(filters.areaMax));
  return p;
}

// ===== Convert DB row to Property =====
function rowToProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    listingType: row.listing_type as ListingType,
    category: row.category as PropertyCategory,
    subtype: (row.subtype as string) || "",
    roomsLabel: (row.rooms_label as string) || "",
    price: (row.price as number) || 0,
    priceNote: (row.price_note as string) || undefined,
    priceCurrency: (row.price_currency as string) || undefined,
    city: (row.city as string) || "",
    district: (row.district as string) || "",
    locationLabel: (row.location_label as string) || "",
    latitude: (row.latitude as number) || 0,
    longitude: (row.longitude as number) || 0,
    area: (row.area as number) || 0,
    summary: (row.summary as string) || "",
    description: (row.description as string) || undefined,
    imageSrc: (row.image_src as string) || "/images/placeholder.svg",
    imageAlt: (row.image_alt as string) || "",
    images: (row.images as string[]) || [],
    featured: (row.featured as boolean) || false,
    active: (row.active as boolean) ?? true,
    condition: (row.condition as string) || "",
    ownership: (row.ownership as string) || "",
    furnishing: (row.furnishing as string) || "",
    energyRating: (row.energy_rating as string) || "",
    floor: row.floor as number | undefined,
    totalFloors: row.total_floors as number | undefined,
    buildingMaterial: row.building_material as string | undefined,
    balcony: (row.balcony as boolean) || false,
    terrace: (row.terrace as boolean) || false,
    garden: (row.garden as boolean) || false,
    elevator: (row.elevator as boolean) || false,
    cellar: (row.cellar as boolean) || false,
    garage: (row.garage as boolean) || false,
    pool: (row.pool as boolean) || false,
    loggia: (row.loggia as boolean) || false,
    matterportUrl: row.matterport_url as string | undefined,
    videoUrl: row.video_url as string | undefined,
    brokerId: row.broker_id as string | undefined,
    brokerName: ((row.brokers as Record<string, unknown>)?.name as string) || "",
    brokerPhone: ((row.brokers as Record<string, unknown>)?.phone as string) || "",
    brokerPhoto: (row.brokers as Record<string, unknown>)?.photo as string | undefined,
    brokerEmail: ((row.brokers as Record<string, unknown>)?.email as string) || "",
    agencyName: ((row.brokers as Record<string, unknown>)?.agency_name as string) || "",
    parking: (row.parking as string) || "",
    showAgencyLogo: false,
    viewsTrend: undefined,
  } as Property;
}

// ===== Map points to lightweight Property-like objects for the map =====
function mapPointToMapProperty(pt: MapPoint) {
  return {
    id: pt.id,
    slug: pt.slug,
    title: pt.title,
    listingType: pt.listing_type as ListingType,
    category: pt.category as PropertyCategory,
    subtype: pt.subtype || "",
    roomsLabel: pt.rooms_label || "",
    price: pt.price,
    priceCurrency: pt.price_currency || undefined,
    city: "",
    district: pt.district || "",
    locationLabel: "",
    latitude: pt.lat,
    longitude: pt.lon,
    area: pt.area || 0,
    summary: "",
    imageSrc: pt.image_src || "/images/placeholder.svg",
    imageAlt: "",
    images: [],
    featured: false,
    active: true,
    condition: "",
    ownership: "",
    furnishing: "",
    energyRating: "",
    parking: "",
    brokerName: "",
    brokerPhone: "",
    brokerEmail: "",
    agencyName: "",
    balcony: false, terrace: false, garden: false, elevator: false,
    cellar: false, garage: false, pool: false, loggia: false,
    showAgencyLogo: false,
  } as Property;
}

// ===== FILTER PERSISTENCE =====
const FILTERS_KEY = "nemovizor-filters";

type PersistedFilters = {
  listingType: string | null;
  categories: string[];
  subtypes: string[];
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  sortBy: string;
  locationLabel: string | null;
};

function loadPersistedFilters(): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function savePersistedFilters(f: PersistedFilters) {
  try { localStorage.setItem(FILTERS_KEY, JSON.stringify(f)); } catch {}
}

function clearPersistedFilters() {
  try { localStorage.removeItem(FILTERS_KEY); } catch {}
}

// ===== MAIN CONTENT =====
function ListingsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as PropertyCategory | null;
  const initialListingType = searchParams.get("listingType") as ListingType | null;

  // Load persisted filters (URL params override persisted values)
  const persisted = useMemo(() => loadPersistedFilters(), []);
  const hasUrlParams = initialCategory !== null || initialListingType !== null;

  // Filter state — URL params > persisted > defaults
  const [listingType, setListingType] = useState<ListingType | null>(
    initialListingType ?? (hasUrlParams ? null : (persisted?.listingType as ListingType | null) ?? null)
  );
  const [categories, setCategories] = useState<string[]>(
    initialCategory ? [initialCategory] : (hasUrlParams ? [] : persisted?.categories ?? [])
  );
  const [subtypes, setSubtypes] = useState<string[]>(hasUrlParams ? [] : persisted?.subtypes ?? []);
  const [priceMin, setPriceMin] = useState<number | null>(hasUrlParams ? null : persisted?.priceMin ?? null);
  const [priceMax, setPriceMax] = useState<number | null>(hasUrlParams ? null : persisted?.priceMax ?? null);
  const [areaMin, setAreaMin] = useState<number | null>(hasUrlParams ? null : persisted?.areaMin ?? null);
  const [areaMax, setAreaMax] = useState<number | null>(hasUrlParams ? null : persisted?.areaMax ?? null);

  // Sort
  const [sortBy, setSortBy] = useState<string>(hasUrlParams ? "featured" : persisted?.sortBy ?? "featured");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Data
  const [properties, setProperties] = useState<Property[]>([]);
  const [mapPoints, setMapPoints] = useState<Property[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapTruncated, setMapTruncated] = useState(false);

  // UI
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lon: number; bbox?: [number, number, number, number] } | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [debouncedBounds, setDebouncedBounds] = useState<MapBounds | null>(null);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Build filter params object (no city — location is controlled by map bounds)
  const filters = useMemo(() => ({
    listingType, categories, subtypes, city: null as string | null,
    priceMin, priceMax, areaMin, areaMax,
  }), [listingType, categories, subtypes, priceMin, priceMax, areaMin, areaMax]);

  // Reset page when filters or sort change
  useEffect(() => { setPage(1); }, [filters, sortBy]);

  // Reset page when bounds change
  useEffect(() => { setPage(1); }, [debouncedBounds]);

  // Fetch properties (paginated grid) — filtered by dropdown filters + map bounds
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const params = buildFilterParams(filters);
    params.set("page", String(page));
    params.set("limit", "24");
    if (sortBy !== "featured") params.set("sort", sortBy);

    // Add bounds from map viewport
    if (debouncedBounds) {
      params.set("sw_lat", String(debouncedBounds.south));
      params.set("sw_lon", String(debouncedBounds.west));
      params.set("ne_lat", String(debouncedBounds.north));
      params.set("ne_lon", String(debouncedBounds.east));
    }

    fetch(`/api/properties?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: PropertiesResponse) => {
        setProperties((data.data || []).map(rowToProperty));
        setTotalPages(data.pages || 1);
        setTotalResults(data.total || 0);
        setLoading(false);
      })
      .catch((e) => { if (e.name !== "AbortError") { setLoading(false); } });

    return () => controller.abort();
  }, [filters, page, debouncedBounds, sortBy]);

  // Fetch map points (all matching in viewport, lightweight)
  useEffect(() => {
    const controller = new AbortController();
    setMapLoading(true);

    const params = buildFilterParams(filters);
    // Map points always use bounds if available
    if (debouncedBounds) {
      params.set("sw_lat", String(debouncedBounds.south));
      params.set("sw_lon", String(debouncedBounds.west));
      params.set("ne_lat", String(debouncedBounds.north));
      params.set("ne_lon", String(debouncedBounds.east));
    }
    params.set("limit", "5000");

    fetch(`/api/map-points?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { points: MapPoint[]; total?: number; truncated?: boolean }) => {
        setMapPoints((data.points || []).map(mapPointToMapProperty));
        setMapTruncated(data.truncated || false);
        setMapLoading(false);
      })
      .catch((e) => { if (e.name !== "AbortError") { setMapLoading(false); } });

    return () => controller.abort();
  }, [filters, debouncedBounds]);

  // Fetch filter options
  useEffect(() => {
    const params = new URLSearchParams();
    if (listingType) params.set("listing_type", listingType);
    if (categories.length) params.set("category", categories.join(","));

    fetch(`/api/filter-options?${params}`)
      .then((r) => r.json())
      .then((data: FilterOptionsResponse) => setFilterOptions(data))
      .catch(() => {});
  }, [listingType, categories]);

  // Location label for display
  const [locationLabel, setLocationLabel] = useState<string | null>(
    hasUrlParams ? null : persisted?.locationLabel ?? null
  );

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    savePersistedFilters({
      listingType, categories, subtypes,
      priceMin, priceMax, areaMin, areaMax,
      sortBy, locationLabel,
    });
  }, [listingType, categories, subtypes, priceMin, priceMax, areaMin, areaMax, sortBy, locationLabel]);

  // Persist current search to sessionStorage (for auto-save on detail view)
  useEffect(() => {
    saveCurrentSearch(filters, locationLabel);
  }, [filters, locationLabel]);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    // Ignore degenerate bounds (e.g. when map is display:none on mobile)
    const latSpan = Math.abs(bounds.north - bounds.south);
    const lonSpan = Math.abs(bounds.east - bounds.west);
    if (latSpan < 0.0001 || lonSpan < 0.0001) return;

    setMapBounds(bounds);
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      setDebouncedBounds(bounds);
    }, 400);
  }, []);

  // Check if map is zoomed in (not showing all of Czech Republic)
  const isZoomed = debouncedBounds && (
    (debouncedBounds.north - debouncedBounds.south) < 4 ||
    (debouncedBounds.east - debouncedBounds.west) < 6
  );

  // Reset map to whole Czech Republic
  const handleResetLocation = useCallback(() => {
    setLocationLabel(null);
    // Fly to Czech Republic bounds
    setMapFlyTo({ lat: 49.8, lon: 15.5, bbox: [12.09, 48.55, 18.86, 51.06] });
  }, []);

  // Build dropdown options from filter-options API
  const listingTypeOptions = useMemo(() => {
    if (!filterOptions) {
      return (Object.entries(listingTypeLabels) as [ListingType, string][]).map(([value, label]) => ({ value, label }));
    }
    return (filterOptions.listingTypes ?? [])
      .map((o) => ({
        value: o.value as ListingType,
        label: listingTypeLabels[o.value as ListingType] || o.value,
        count: o.count,
      }))
      .filter((o) => o.label);
  }, [filterOptions]);

  const categoryOptions = useMemo(() => {
    // Always show all categories, using counts from filterOptions when available
    const countMap = new Map<string, number>();
    if (filterOptions?.categories) {
      for (const o of filterOptions.categories) {
        countMap.set(o.value, o.count);
      }
    }
    return (Object.entries(categoryLabels) as [PropertyCategory, string][]).map(([value, label]) => ({
      value,
      label,
      count: countMap.get(value),
    }));
  }, [filterOptions]);

  // All subtype labels merged into a single lookup
  const allSubtypeLabels = useMemo(() => {
    const merged: Record<string, string> = {};
    for (const subs of Object.values(subtypesByCategory)) {
      Object.assign(merged, subs);
    }
    return merged;
  }, []);

  // Subtype options grouped by category
  const subtypeGroups = useMemo((): DropdownGroup[] => {
    const activeCats = categories.length > 0
      ? categories as PropertyCategory[]
      : (Object.keys(subtypesByCategory) as PropertyCategory[]);

    const countMap = new Map<string, number>();
    if (filterOptions?.subtypes?.length) {
      for (const o of filterOptions.subtypes) countMap.set(o.value, o.count || 0);
    }

    return activeCats
      .map((cat) => {
        const subs = subtypesByCategory[cat] || {};
        let opts = Object.entries(subs).map(([value, label]) => ({
          value,
          label,
          count: countMap.get(value),
        }));
        // If we have filter counts, only show subtypes that exist and sort by count
        if (countMap.size > 0) {
          opts = opts.filter((o) => o.count !== undefined && o.count > 0)
            .sort((a, b) => (b.count || 0) - (a.count || 0));
        }
        return { groupLabel: categoryLabels[cat], options: opts };
      })
      .filter((g) => g.options.length > 0);
  }, [categories, filterOptions]);

  // Flat list fallback (used when only 1 category selected)
  const subtypeOptions = useMemo(() => {
    return subtypeGroups.flatMap((g) => g.options);
  }, [subtypeGroups]);

  // DB cities for LocationSearch autocomplete
  const dbCities: DbCity[] = useMemo(() => {
    if (!filterOptions) return [];
    return (filterOptions.cities ?? []).slice(0, 100);
  }, [filterOptions]);

  const clearFilters = () => {
    setListingType(null); setCategories([]); setSubtypes([]);
    setPriceMin(null); setPriceMax(null);
    setAreaMin(null); setAreaMax(null);
    setSortBy("featured");
    setLocationLabel(null);
    setDebouncedBounds(null);
    setMapBounds(null);
    setMapFlyTo({ lat: 49.8, lon: 15.5, bbox: [12.09, 48.55, 18.86, 51.06] });
    clearPersistedFilters();
  };

  // Geocode a city name via Mapy.cz Suggest API
  const geocodeCity = useCallback(async (cityName: string) => {
    const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY ?? "";
    if (!apiKey) return null;
    try {
      const params = new URLSearchParams({
        query: cityName, lang: "cs", limit: "1", type: "regional",
        locality: "cz", apikey: apiKey,
      });
      const res = await fetch(`https://api.mapy.cz/v1/suggest?${params}`, {
        headers: { "X-Mapy-Api-Key": apiKey },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const item = data.items?.[0];
      if (!item) return null;
      return {
        lat: item.position.lat as number,
        lon: item.position.lon as number,
        bbox: item.bbox as [number, number, number, number] | undefined,
      };
    } catch {
      return null;
    }
  }, []);

  // Restore map position from persisted locationLabel on mount
  useEffect(() => {
    if (!hasUrlParams && persisted?.locationLabel) {
      geocodeCity(persisted.locationLabel).then((geo) => {
        if (geo) {
          setMapFlyTo({ lat: geo.lat, lon: geo.lon, bbox: geo.bbox });
          if (geo.bbox && geo.bbox.length >= 4) {
            const bounds: MapBounds = {
              south: geo.bbox[1], west: geo.bbox[0],
              north: geo.bbox[3], east: geo.bbox[2],
            };
            setDebouncedBounds(bounds);
            setMapBounds(bounds);
          }
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore a saved search
  const handleRestoreSavedSearch = useCallback(async (search: SavedSearch) => {
    const f = search.filters;
    setListingType((f.listingType as ListingType) || null);
    setCategories(f.category ? [f.category as string] : []);
    setSubtypes(f.subtype ? [f.subtype as string] : []);
    setPriceMin(f.priceMin || null);
    setPriceMax(f.priceMax || null);
    setAreaMin(f.areaMin || null);
    setAreaMax(f.areaMax || null);
    if (search.locationLabel) {
      setLocationLabel(search.locationLabel);
      // Geocode to set map bounds
      const geo = await geocodeCity(search.locationLabel);
      if (geo) {
        setMapFlyTo({ lat: geo.lat, lon: geo.lon, bbox: geo.bbox });
        if (geo.bbox && geo.bbox.length >= 4) {
          const bounds: MapBounds = {
            south: geo.bbox[1], west: geo.bbox[0],
            north: geo.bbox[3], east: geo.bbox[2],
          };
          setDebouncedBounds(bounds);
          setMapBounds(bounds);
        }
      }
    } else {
      setLocationLabel(null);
      setDebouncedBounds(null);
      setMapBounds(null);
    }
  }, [geocodeCity, setMapFlyTo, setDebouncedBounds, setMapBounds]);

  // Handle AI search results
  const handleAiFilters = useCallback(async (aiFilters: Record<string, unknown>) => {
    if (aiFilters.listingType) setListingType(aiFilters.listingType as ListingType);
    if (aiFilters.category) setCategories([aiFilters.category as string]);
    if (aiFilters.subtype) setSubtypes([aiFilters.subtype as string]);
    if (aiFilters.priceMin) setPriceMin(aiFilters.priceMin as number);
    if (aiFilters.priceMax) setPriceMax(aiFilters.priceMax as number);
    if (aiFilters.areaMin) setAreaMin(aiFilters.areaMin as number);
    if (aiFilters.areaMax) setAreaMax(aiFilters.areaMax as number);
    if (aiFilters.city) {
      const cityName = aiFilters.city as string;
      setLocationLabel(cityName);
      // Geocode the city via Mapy.cz to get real coordinates
      const geo = await geocodeCity(cityName);
      if (geo) {
        setMapFlyTo({ lat: geo.lat, lon: geo.lon, bbox: geo.bbox });
        // Also set bounds directly so list view filters even when map is hidden (mobile)
        if (geo.bbox && geo.bbox.length >= 4) {
          const bounds: MapBounds = {
            south: geo.bbox[1],
            west: geo.bbox[0],
            north: geo.bbox[3],
            east: geo.bbox[2],
          };
          setDebouncedBounds(bounds);
          setMapBounds(bounds);
        }
      }
    }
  }, [geocodeCity]);

  const hasFilters = listingType || categories.length > 0 || subtypes.length > 0 || priceMin || priceMax || areaMin || areaMax || sortBy !== "featured";

  const pricePresets = [1000000, 3000000, 5000000, 8000000, 10000000, 15000000, 20000000];
  const areaPresets = [30, 50, 80, 100, 150, 200, 300];

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="search-page">
        <div className="search-layout">
          <div className={`search-sidebar ${isMobile && mobileView === "map" ? "search-sidebar--mobile-hidden" : ""}`}>
            <div className="search-filters-bar">
              <AiSearch onFiltersReady={handleAiFilters} compact />
              <div className="search-filters-row">
              <FilterDropdown label="Typ nabídky" value={listingType} options={listingTypeOptions} onChange={setListingType} />
              <MultiFilterDropdown
                label="Typ nemovitosti" values={categories} options={categoryOptions}
                onChange={(vals) => { setCategories(vals); setSubtypes([]); }}
              />
              {categories.length > 0 && subtypeOptions.length > 0 && (
                <MultiFilterDropdown label="Podtyp" values={subtypes} options={subtypeOptions} groups={subtypeGroups.length > 1 ? subtypeGroups : undefined} onChange={setSubtypes} />
              )}
              <RangeDropdown label="Cena" minValue={priceMin} maxValue={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} presets={pricePresets} unit="Kč" />
              <RangeDropdown label="Plocha" minValue={areaMin} maxValue={areaMax} onMinChange={setAreaMin} onMaxChange={setAreaMax} presets={areaPresets} unit="m2" />

              <LocationSearch
                placeholder="Hledat město, ulici..."
                dbCities={dbCities}
                onSelect={(item) => {
                  setMapFlyTo({ lat: item.lat, lon: item.lon, bbox: item.bbox });
                  setLocationLabel(item.name);
                  // Set bounds directly so list filters even when map is hidden (mobile)
                  if (item.bbox && item.bbox.length >= 4) {
                    const bounds: MapBounds = {
                      south: item.bbox[1], west: item.bbox[0],
                      north: item.bbox[3], east: item.bbox[2],
                    };
                    setDebouncedBounds(bounds);
                    setMapBounds(bounds);
                  }
                }}
                onClear={handleResetLocation}
              />

              {isZoomed && (
                <button className="filter-pill filter-pill--location" onClick={handleResetLocation}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {locationLabel || "Celé Česko"}
                </button>
              )}

              {hasFilters && (
                <button className="filter-pill filter-pill--clear" onClick={clearFilters}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Smazat filtry
                </button>
              )}

              <SavedSearches
                currentFilters={filters}
                locationLabel={locationLabel}
                onRestore={handleRestoreSavedSearch}
              />

              <div className="search-results-bar">
                <span className="search-results-count">
                  {totalResults.toLocaleString("cs")} {totalResults === 1 ? "nabídka" : totalResults < 5 ? "nabídky" : "nabídek"}
                  {locationLabel ? ` v ${locationLabel}` : isZoomed ? " v této oblasti" : ""}
                  {totalPages > 1 && ` (str. ${page}/${totalPages})`}
                </span>
                <select
                  className="search-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="featured">Doporučené</option>
                  <option value="newest">Nejnovější</option>
                  <option value="oldest">Nejstarší</option>
                  <option value="price_desc">Nejdražší</option>
                  <option value="price_asc">Nejlevnější</option>
                  <option value="area_desc">Největší plocha</option>
                  <option value="area_asc">Nejmenší plocha</option>
                </select>
              </div>
              </div>
            </div>

            <div className="search-results-scroll">
              {loading && properties.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                  Načítání...
                </div>
              ) : (
                <>
                  <div className="search-results-grid" ref={(el) => {
                    if (el && properties.length > 0) {
                      try { sessionStorage.setItem("listing-slugs", JSON.stringify(properties.map(p => p.slug))); } catch {}
                    }
                  }}>
                    {properties.map((property) => (
                      <div
                        key={property.id}
                        onMouseEnter={() => setSelectedPropertyId(property.id)}
                        onMouseLeave={() => setSelectedPropertyId(null)}
                      >
                        <PropertyCard property={property} />
                      </div>
                    ))}
                    {properties.length === 0 && !loading && (
                      <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                        Žádné nemovitosti neodpovídají zadaným filtrům.
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "24px 0" }}>
                      <button
                        className="filter-dropdown-trigger"
                        disabled={page <= 1}
                        onClick={() => setPage(Math.max(1, page - 1))}
                        style={{ opacity: page <= 1 ? 0.4 : 1 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                      </button>

                      {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                        let p: number;
                        if (totalPages <= 7) p = i + 1;
                        else if (page <= 4) p = i + 1;
                        else if (page >= totalPages - 3) p = totalPages - 6 + i;
                        else p = page - 3 + i;
                        return (
                          <button
                            key={p}
                            className={`filter-dropdown-trigger ${p === page ? "filter-dropdown-trigger--active" : ""}`}
                            onClick={() => setPage(p)}
                            style={{ minWidth: 36, justifyContent: "center" }}
                          >
                            {p}
                          </button>
                        );
                      })}

                      <button
                        className="filter-dropdown-trigger"
                        disabled={page >= totalPages}
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        style={{ opacity: page >= totalPages ? 0.4 : 1 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div
            className="search-resize-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              const layout = e.currentTarget.parentElement!;
              const startX = e.clientX;
              const sidebar = layout.querySelector(".search-sidebar") as HTMLElement;
              const startWidth = sidebar.offsetWidth;
              const layoutWidth = layout.offsetWidth;
              function onMove(ev: MouseEvent) {
                const dx = ev.clientX - startX;
                const newPct = Math.min(80, Math.max(25, ((startWidth + dx) / layoutWidth) * 100));
                sidebar.style.width = `${newPct}%`;
                const mapPanel = layout.querySelector(".search-map-panel") as HTMLElement;
                if (mapPanel) mapPanel.style.width = `${100 - newPct}%`;
                window.dispatchEvent(new Event("resize"));
              }
              function onUp() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
              }
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
            }}
          >
            <div className="search-resize-grip" />
          </div>

          <div className={`search-map-panel ${isMobile ? (mobileView === "map" ? "search-map-panel--mobile-full" : "search-map-panel--mobile-hidden") : ""}`}>
            <PropertyMap
              properties={mapPoints}
              selectedPropertyId={selectedPropertyId}
              onPropertySelect={setSelectedPropertyId}
              onBoundsChange={handleBoundsChange}
              mode="prices"
              truncated={mapTruncated}
              flyTo={mapFlyTo}
              onFlyToDone={() => setMapFlyTo(null)}
            />
          </div>
        </div>
      </main>

      {/* Mobilni spodni lista */}
      <div className="mobile-bottom-bar">
        <Link href="/" className="mobile-bar-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Domov</span>
        </Link>
        <Link href="/nabidky" className="mobile-bar-item mobile-bar-item--active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>Nabídky</span>
        </Link>
        <button
          className="mobile-bar-toggle"
          onClick={() => {
            setMobileView((v) => v === "list" ? "map" : "list");
            setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
          }}
        >
          {mobileView === "list" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 6l7-3 8 3 7-3v15l-7 3-8-3-7 3V6z" />
              <path d="M8 3v15" /><path d="M16 6v15" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
              <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
            </svg>
          )}
          <span>{mobileView === "list" ? "Mapa" : "Seznam"}</span>
        </button>
        <Link href="/oceneni" className="mobile-bar-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M8 6h8" /><path d="M8 10h8" /><path d="M8 14h4" />
          </svg>
          <span>Ocenění</span>
        </Link>
        <Link href="/" className="mobile-bar-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Profil</span>
        </Link>
      </div>
    </div>
  );
}
