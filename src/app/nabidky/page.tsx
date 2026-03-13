"use client";

import { Suspense, useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { PropertyCard } from "@/components/property-card";
import { SiteHeader } from "@/components/site-header";
import { getAllProperties, getUniqueCities } from "@/lib/api";
import type { Property } from "@/lib/types";
import type { MapBounds } from "@/components/property-map";
import {
  ListingType, PropertyCategory,
  ListingTypes, PropertyCategories,
  PropertyConditions, OwnershipTypes,
  ApartmentSubtypes, HouseSubtypes, LandSubtypes, CommercialSubtypes, OtherSubtypes,
  enumToOptions,
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
      <span>Načítání mapy…</span>
    </div>
  ),
});

const categoryLabels: Record<PropertyCategory, string> = {
  apartment: "Byt",
  house: "Dům",
  land: "Pozemek",
  commercial: "Komerční",
  other: "Ostatní",
};

const subtypesByCategory: Record<PropertyCategory, Record<string, string>> = {
  apartment: ApartmentSubtypes,
  house: HouseSubtypes,
  land: LandSubtypes,
  commercial: CommercialSubtypes,
  other: OtherSubtypes,
};

const listingTypeLabels: Record<ListingType, string> = {
  sale: "Prodej",
  rent: "Pronájem",
  auction: "Dražba",
  shares: "Podíly",
  project: "Projekt",
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
  options: { value: T; label: string }[];
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== RANGE DROPDOWN (cena, plocha) =====
function RangeDropdown({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  presets,
  unit,
}: {
  label: string;
  minValue: number | null;
  maxValue: number | null;
  onMinChange: (v: number | null) => void;
  onMaxChange: (v: number | null) => void;
  presets: number[];
  unit: string;
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
    ? `${minValue ? formatNum(minValue) : "0"} – ${maxValue ? formatNum(maxValue) : "∞"} ${unit}`
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
            <button
              className={`filter-dropdown-item ${minValue === null ? "filter-dropdown-item--active" : ""}`}
              style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }}
              onClick={() => onMinChange(null)}
            >
              Min
            </button>
            {presets.map((v) => (
              <button
                key={`min-${v}`}
                className={`filter-dropdown-item ${minValue === v ? "filter-dropdown-item--active" : ""}`}
                style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }}
                onClick={() => onMinChange(minValue === v ? null : v)}
              >
                {formatNum(v)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Do</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button
              className={`filter-dropdown-item ${maxValue === null ? "filter-dropdown-item--active" : ""}`}
              style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }}
              onClick={() => onMaxChange(null)}
            >
              Max
            </button>
            {presets.map((v) => (
              <button
                key={`max-${v}`}
                className={`filter-dropdown-item ${maxValue === v ? "filter-dropdown-item--active" : ""}`}
                style={{ flex: "0 0 auto", padding: "4px 10px", fontSize: "0.78rem" }}
                onClick={() => onMaxChange(maxValue === v ? null : v)}
              >
                {formatNum(v)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== MAIN CONTENT =====
function ListingsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as PropertyCategory | null;
  const initialListingType = searchParams.get("listingType") as ListingType | null;
  const initialCity = searchParams.get("city");

  const [listingType, setListingType] = useState<ListingType | null>(initialListingType);
  const [category, setCategory] = useState<PropertyCategory | null>(initialCategory);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(initialCity);
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [areaMin, setAreaMin] = useState<number | null>(null);
  const [areaMax, setAreaMax] = useState<number | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lon: number; bbox?: [number, number, number, number] } | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [isMobile, setIsMobile] = useState(false);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    Promise.all([getAllProperties(), getUniqueCities()]).then(([props, c]) => {
      setAllProperties(props);
      setCities(c);
      setLoading(false);
    });
  }, []);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  const filtered = useMemo(() => {
    return allProperties.filter((p) => {
      if (listingType && p.listingType !== listingType) return false;
      if (category && p.category !== category) return false;
      if (subtype && p.subtype !== subtype) return false;
      if (selectedCity && p.city !== selectedCity) return false;
      if (priceMin && p.price < priceMin) return false;
      if (priceMax && p.price > priceMax) return false;
      if (areaMin && p.area < areaMin) return false;
      if (areaMax && p.area > areaMax) return false;
      return true;
    });
  }, [allProperties, listingType, category, subtype, selectedCity, priceMin, priceMax, areaMin, areaMax]);

  // Filtrovat seznam podle viditelné oblasti mapy (na mobilu v list view nefiltrovat)
  const visibleInMap = useMemo(() => {
    if (!mapBounds || (isMobile && mobileView === "list")) return filtered;
    return filtered.filter((p) => {
      if (!p.latitude || !p.longitude) return false;
      return (
        p.latitude >= mapBounds.south &&
        p.latitude <= mapBounds.north &&
        p.longitude >= mapBounds.west &&
        p.longitude <= mapBounds.east
      );
    });
  }, [filtered, mapBounds, isMobile, mobileView]);

  const clearFilters = () => {
    setListingType(null);
    setCategory(null);
    setSubtype(null);
    setSelectedCity(null);
    setPriceMin(null);
    setPriceMax(null);
    setAreaMin(null);
    setAreaMax(null);
  };

  const hasFilters = listingType || category || subtype || selectedCity || priceMin || priceMax || areaMin || areaMax;

  const listingTypeOptions = (Object.entries(listingTypeLabels) as [ListingType, string][])
    .filter(([k]) => k !== "auction") // skryjeme dražbu prozatím
    .map(([value, label]) => ({ value, label }));

  const categoryOptions = (Object.entries(categoryLabels) as [PropertyCategory, string][])
    .map(([value, label]) => ({ value, label }));

  const subtypeOptions = category
    ? Object.values(subtypesByCategory[category]).map((label) => ({ value: label, label }))
    : [];

  const cityOptions = cities.map((city) => ({ value: city, label: city }));

  const pricePresets = [1000000, 3000000, 5000000, 8000000, 10000000, 15000000, 20000000];
  const areaPresets = [30, 50, 80, 100, 150, 200, 300];

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="search-page">
        <div className="search-layout">
          <div className={`search-sidebar ${isMobile && mobileView === "map" ? "search-sidebar--mobile-hidden" : ""}`}>
            <div className="search-filters-bar">
              <FilterDropdown
                label="Typ nabídky"
                value={listingType}
                options={listingTypeOptions}
                onChange={setListingType}
              />
              <FilterDropdown
                label="Typ nemovitosti"
                value={category}
                options={categoryOptions}
                onChange={(val) => { setCategory(val); setSubtype(null); }}
              />
              {category && subtypeOptions.length > 0 && (
                <FilterDropdown
                  label="Podtyp"
                  value={subtype}
                  options={subtypeOptions}
                  onChange={setSubtype}
                />
              )}
              <FilterDropdown
                label="Město"
                value={selectedCity}
                options={cityOptions}
                onChange={setSelectedCity}
              />
              <RangeDropdown
                label="Cena"
                minValue={priceMin}
                maxValue={priceMax}
                onMinChange={setPriceMin}
                onMaxChange={setPriceMax}
                presets={pricePresets}
                unit="Kč"
              />
              <RangeDropdown
                label="Plocha"
                minValue={areaMin}
                maxValue={areaMax}
                onMinChange={setAreaMin}
                onMaxChange={setAreaMax}
                presets={areaPresets}
                unit="m²"
              />

              <LocationSearch
                placeholder="Hledat lokalitu…"
                onSelect={(item) => {
                  setMapFlyTo({
                    lat: item.lat,
                    lon: item.lon,
                    bbox: item.bbox,
                  });
                  // Pokud město odpovídá existujícímu filtru, nastavíme ho
                  if (item.city && cities.includes(item.city)) {
                    setSelectedCity(item.city);
                  }
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
                {visibleInMap.length} z {filtered.length} {filtered.length === 1 ? "nabídka" : filtered.length < 5 ? "nabídky" : "nabídek"}
              </span>
            </div>

            <div className="search-results-scroll">
              <div className="search-results-grid">
                {visibleInMap.map((property) => (
                  <div
                    key={property.id}
                    onMouseEnter={() => setSelectedPropertyId(property.id)}
                    onMouseLeave={() => setSelectedPropertyId(null)}
                  >
                    <PropertyCard property={property} />
                  </div>
                ))}
                {visibleInMap.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                    Žádné nemovitosti neodpovídají zadaným filtrům.
                  </div>
                )}
              </div>
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
                // Trigger leaflet resize
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
              properties={filtered}
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

      {/* Mobilní spodní lišta */}
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
            // Trigger resize pro Leaflet
            setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
          }}
        >
          {mobileView === "list" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 6l7-3 8 3 7-3v15l-7 3-8-3-7 3V6z" />
              <path d="M8 3v15" />
              <path d="M16 6v15" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
          )}
          <span>{mobileView === "list" ? "Mapa" : "Seznam"}</span>
        </button>
        <Link href="/oceneni" className="mobile-bar-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M8 6h8" />
            <path d="M8 10h8" />
            <path d="M8 14h4" />
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
