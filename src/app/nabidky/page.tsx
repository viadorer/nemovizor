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

const PropertyMap = dynamic(() => import("@/components/property-map"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span>Nacitani mapy...</span>
    </div>
  ),
});

const categoryLabels: Record<PropertyCategory, string> = {
  apartment: "Byt", house: "Dum", land: "Pozemek", commercial: "Komercni", other: "Ostatni",
};

const subtypesByCategory: Record<PropertyCategory, Record<string, string>> = {
  apartment: ApartmentSubtypes, house: HouseSubtypes, land: LandSubtypes,
  commercial: CommercialSubtypes, other: OtherSubtypes,
};

const listingTypeLabels: Record<ListingType, string> = {
  sale: "Prodej", rent: "Pronajem", auction: "Drazba", shares: "Podily", project: "Projekt",
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="page-shell"><SiteHeader /><main className="search-page" /></div>}>
      <ListingsContent />
    </Suspense>
  );
}

// ===== DROPDOWN COMPONENT =====
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
            Vse
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
  category: string;
  listing_type: string;
  title: string;
  slug: string;
  rooms_label: string;
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
  category: string | null;
  subtype: string | null;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
}) {
  const p = new URLSearchParams();
  if (filters.listingType) p.set("listing_type", filters.listingType);
  if (filters.category) p.set("category", filters.category);
  if (filters.subtype) p.set("subtype", filters.subtype);
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
    city: (row.city as string) || "",
    district: (row.district as string) || "",
    locationLabel: (row.location_label as string) || "",
    latitude: (row.latitude as number) || 0,
    longitude: (row.longitude as number) || 0,
    area: (row.area as number) || 0,
    summary: (row.summary as string) || "",
    description: (row.description as string) || undefined,
    imageSrc: (row.image_src as string) || "/images/placeholder.jpg",
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
    subtype: "",
    roomsLabel: pt.rooms_label || "",
    price: pt.price,
    city: "",
    district: "",
    locationLabel: "",
    latitude: pt.lat,
    longitude: pt.lon,
    area: 0,
    summary: "",
    imageSrc: "",
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

// ===== MAIN CONTENT =====
function ListingsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as PropertyCategory | null;
  const initialListingType = searchParams.get("listingType") as ListingType | null;
  const initialCity = searchParams.get("city");

  // Filter state
  const [listingType, setListingType] = useState<ListingType | null>(initialListingType);
  const [category, setCategory] = useState<PropertyCategory | null>(initialCategory);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(initialCity);
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [areaMin, setAreaMin] = useState<number | null>(null);
  const [areaMax, setAreaMax] = useState<number | null>(null);

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

  // Build filter params object
  const filters = useMemo(() => ({
    listingType, category, subtype, city: selectedCity,
    priceMin, priceMax, areaMin, areaMax,
  }), [listingType, category, subtype, selectedCity, priceMin, priceMax, areaMin, areaMax]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filters]);

  // Reset page when bounds change
  useEffect(() => { setPage(1); }, [debouncedBounds]);

  // Fetch properties (paginated grid) — filtered by dropdown filters + map bounds
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const params = buildFilterParams(filters);
    params.set("page", String(page));
    params.set("limit", "24");

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
  }, [filters, page, debouncedBounds]);

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
      .then((data: { points: MapPoint[] }) => {
        setMapPoints((data.points || []).map(mapPointToMapProperty));
        setMapLoading(false);
      })
      .catch((e) => { if (e.name !== "AbortError") { setMapLoading(false); } });

    return () => controller.abort();
  }, [filters, debouncedBounds]);

  // Fetch filter options
  useEffect(() => {
    const params = new URLSearchParams();
    if (listingType) params.set("listing_type", listingType);
    if (category) params.set("category", category);

    fetch(`/api/filter-options?${params}`)
      .then((r) => r.json())
      .then((data: FilterOptionsResponse) => setFilterOptions(data))
      .catch(() => {});
  }, [listingType, category]);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      setDebouncedBounds(bounds);
    }, 400);
  }, []);

  // Build dropdown options from filter-options API
  const listingTypeOptions = useMemo(() => {
    if (!filterOptions) {
      return (Object.entries(listingTypeLabels) as [ListingType, string][]).map(([value, label]) => ({ value, label }));
    }
    return filterOptions.listingTypes
      .map((o) => ({
        value: o.value as ListingType,
        label: listingTypeLabels[o.value as ListingType] || o.value,
        count: o.count,
      }))
      .filter((o) => o.label);
  }, [filterOptions]);

  const categoryOptions = useMemo(() => {
    if (!filterOptions) {
      return (Object.entries(categoryLabels) as [PropertyCategory, string][]).map(([value, label]) => ({ value, label }));
    }
    return filterOptions.categories
      .map((o) => ({
        value: o.value as PropertyCategory,
        label: categoryLabels[o.value as PropertyCategory] || o.value,
        count: o.count,
      }))
      .filter((o) => o.label);
  }, [filterOptions]);

  const subtypeOptions = useMemo(() => {
    if (!category) return [];
    if (filterOptions?.subtypes?.length) {
      const subs = subtypesByCategory[category] || {};
      return filterOptions.subtypes
        .map((o) => ({ value: o.value, label: subs[o.value] || o.value, count: o.count }));
    }
    return Object.entries(subtypesByCategory[category] || {}).map(([value, label]) => ({ value, label }));
  }, [category, filterOptions]);

  const cityOptions = useMemo(() => {
    if (!filterOptions) return [];
    return filterOptions.cities
      .slice(0, 80)
      .map((o) => ({ value: o.value, label: o.value, count: o.count }));
  }, [filterOptions]);

  const clearFilters = () => {
    setListingType(null); setCategory(null); setSubtype(null);
    setSelectedCity(null); setPriceMin(null); setPriceMax(null);
    setAreaMin(null); setAreaMax(null);
  };

  const hasFilters = listingType || category || subtype || selectedCity || priceMin || priceMax || areaMin || areaMax;

  const pricePresets = [1000000, 3000000, 5000000, 8000000, 10000000, 15000000, 20000000];
  const areaPresets = [30, 50, 80, 100, 150, 200, 300];

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="search-page">
        <div className="search-layout">
          <div className={`search-sidebar ${isMobile && mobileView === "map" ? "search-sidebar--mobile-hidden" : ""}`}>
            <div className="search-filters-bar">
              <FilterDropdown label="Typ nabidky" value={listingType} options={listingTypeOptions} onChange={setListingType} />
              <FilterDropdown
                label="Typ nemovitosti" value={category} options={categoryOptions}
                onChange={(val) => { setCategory(val); setSubtype(null); }}
              />
              {category && subtypeOptions.length > 0 && (
                <FilterDropdown label="Podtyp" value={subtype} options={subtypeOptions} onChange={setSubtype} />
              )}
              <FilterDropdown label="Mesto" value={selectedCity} options={cityOptions} onChange={setSelectedCity} />
              <RangeDropdown label="Cena" minValue={priceMin} maxValue={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} presets={pricePresets} unit="Kc" />
              <RangeDropdown label="Plocha" minValue={areaMin} maxValue={areaMax} onMinChange={setAreaMin} onMaxChange={setAreaMax} presets={areaPresets} unit="m2" />

              <LocationSearch
                placeholder="Hledat lokalitu..."
                onSelect={(item) => {
                  setMapFlyTo({ lat: item.lat, lon: item.lon, bbox: item.bbox });
                  if (item.city) setSelectedCity(item.city);
                }}
              />

              {hasFilters && (
                <button className="filter-pill filter-pill--clear" onClick={clearFilters}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Smazat filtry
                </button>
              )}

              <span className="search-results-count">
                {totalResults.toLocaleString("cs")} {totalResults === 1 ? "nabidka" : totalResults < 5 ? "nabidky" : "nabidek"}
                {totalPages > 1 && ` (str. ${page}/${totalPages})`}
              </span>
            </div>

            <div className="search-results-scroll">
              {loading && properties.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                  Nacitani...
                </div>
              ) : (
                <>
                  <div className="search-results-grid">
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
                        Zadne nemovitosti neodpovidaji zadanym filtrum.
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
          <span>Nabidky</span>
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
          <span>Oceneni</span>
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
