"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { PropertyCard } from "@/components/property-card";
import { Pagination } from "@/components/pagination";
import { getBrokerPropertiesPaginated, getAgencyPropertiesPaginated } from "@/lib/api";
import type { DetailPropertyFilters } from "@/lib/api";
import type { Property } from "@/lib/types";
import { useT } from "@/i18n/provider";

const PER_PAGE = 24;

// ===== Filter dropdown (same pattern as listings-content) =====

type DropdownProps<T extends string> = {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
};

function FilterDropdown<T extends string>({ label, value, options, onChange }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

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
            {t.filters.all}
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

// ===== Range input pair =====

function RangeFilter({ label, minVal, maxVal, onMinChange, onMaxChange, unit }: {
  label: string;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  unit: string;
}) {
  const t = useT();
  return (
    <div className="detail-range-filter">
      <span className="detail-range-label">{label}</span>
      <input
        type="number"
        className="detail-range-input"
        placeholder={t.detailGrid.from}
        value={minVal}
        onChange={(e) => onMinChange(e.target.value)}
      />
      <span className="detail-range-sep">-</span>
      <input
        type="number"
        className="detail-range-input"
        placeholder={t.detailGrid.to}
        value={maxVal}
        onChange={(e) => onMaxChange(e.target.value)}
      />
      <span className="detail-range-unit">{unit}</span>
    </div>
  );
}

// ===== Main component =====

type DetailPropertiesGridProps = {
  brokerId?: string;
  agencyId?: string;
  initialItems: Property[];
  initialTotal: number;
};

export function DetailPropertiesGrid({ brokerId, agencyId, initialItems, initialTotal }: DetailPropertiesGridProps) {
  const t = useT();
  const [page, setPage] = useState(1);

  const LISTING_TYPE_OPTIONS = useMemo(() => [
    { value: "sale" as const, label: t.enumLabels.listingTypes.sale },
    { value: "rent" as const, label: t.enumLabels.listingTypes.rent },
    { value: "auction" as const, label: t.enumLabels.listingTypes.auction },
    { value: "shares" as const, label: t.enumLabels.listingTypes.shares },
  ], [t]);

  const CATEGORY_OPTIONS = useMemo(() => [
    { value: "apartment" as const, label: t.enumLabels.propertyCategories.apartment },
    { value: "house" as const, label: t.enumLabels.propertyCategories.house },
    { value: "land" as const, label: t.enumLabels.propertyCategories.land },
    { value: "commercial" as const, label: t.enumLabels.propertyCategories.commercial },
    { value: "other" as const, label: t.enumLabels.propertyCategories.other },
  ], [t]);
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  // Filters
  const [listingType, setListingType] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");

  const showFilters = initialTotal > PER_PAGE;

  const totalPages = Math.ceil(total / PER_PAGE);

  // Build filters object
  function buildFilters(): DetailPropertyFilters | undefined {
    if (!listingType && !category && !priceMin && !priceMax && !areaMin && !areaMax) return undefined;
    return {
      listingType: listingType || null,
      category: category || null,
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
      areaMin: areaMin ? Number(areaMin) : null,
      areaMax: areaMax ? Number(areaMax) : null,
    };
  }

  const hasActiveFilters = !!(listingType || category || priceMin || priceMax || areaMin || areaMax);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [listingType, category, priceMin, priceMax, areaMin, areaMax]);

  // Fetch data
  useEffect(() => {
    const filters = buildFilters();

    // Page 1 with no filters → use server-provided data
    if (page === 1 && !filters) {
      setItems(initialItems);
      setTotal(initialTotal);
      return;
    }

    setLoading(true);
    const fetcher = brokerId
      ? getBrokerPropertiesPaginated(brokerId, page, PER_PAGE, filters)
      : getAgencyPropertiesPaginated(agencyId!, page, PER_PAGE, filters);

    fetcher.then((res) => {
      setItems(res.items);
      setTotal(res.total);
      setLoading(false);
      if (page > 1) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, brokerId, agencyId, initialItems, initialTotal, listingType, category, priceMin, priceMax, areaMin, areaMax]);

  function clearFilters() {
    setListingType(null);
    setCategory(null);
    setPriceMin("");
    setPriceMax("");
    setAreaMin("");
    setAreaMax("");
  }

  if (total === 0 && !hasActiveFilters) {
    return (
      <div className="detail-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
        </svg>
        <p>{t.detailGrid.noListings}</p>
      </div>
    );
  }

  return (
    <div className="detail-cards-section">
      {showFilters && (
        <div className="detail-filters-bar">
          <FilterDropdown label={t.detailGrid.listingTypeLabel} value={listingType} options={LISTING_TYPE_OPTIONS} onChange={setListingType} />
          <FilterDropdown label={t.detailGrid.categoryLabel} value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
          <RangeFilter label={t.detailGrid.priceLabel} minVal={priceMin} maxVal={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} unit={t.detailGrid.priceUnit} />
          <RangeFilter label={t.detailGrid.areaLabel} minVal={areaMin} maxVal={areaMax} onMinChange={setAreaMin} onMaxChange={setAreaMax} unit="m²" />
          {hasActiveFilters && (
            <button className="detail-filters-clear" onClick={clearFilters}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              {t.detailGrid.clearFilters}
            </button>
          )}
        </div>
      )}

      <div className="detail-results-info">
        {total.toLocaleString()} {total === 1 ? t.detailGrid.offerOne : total >= 2 && total <= 4 ? t.detailGrid.offerFew : t.detailGrid.offerMany}
        {totalPages > 1 && <span className="detail-results-page"> ({t.detailGrid.pageInfo.replace("{page}", String(page)).replace("{total}", String(totalPages))})</span>}
      </div>

      {items.length === 0 && hasActiveFilters ? (
        <div className="detail-empty">
          <p>{t.detailGrid.noListingsFiltered}</p>
          <button className="detail-filters-clear" onClick={clearFilters}>{t.detailGrid.clearFilters}</button>
        </div>
      ) : (
        <>
          <div className="detail-cards-grid" style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}>
            {items.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
