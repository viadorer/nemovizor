"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Pagination } from "@/components/pagination";
import type { Broker, Agency } from "@/lib/types";
import { useT } from "@/i18n/provider";

type DropdownProps<T extends string> = {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
};

function FilterDropdown<T extends string>({ label, value, options, onChange }: DropdownProps<T>) {
  const t = useT();
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

type ResultItem =
  | { type: "broker"; data: Broker }
  | { type: "agency"; data: Agency };

type SpecialistsContentProps = {
  allBrokers: Broker[];
  allAgencies: Agency[];
  cities: string[];
  specs: string[];
  brokerCitiesMap: Record<string, string[]>;
  branchCitiesMap: Record<string, string[]>;
};

const PER_PAGE = 30;

export function SpecialistsContent({
  allBrokers,
  allAgencies,
  cities,
  specs,
  brokerCitiesMap,
  branchCitiesMap,
}: SpecialistsContentProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [specialization, setSpecialization] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "broker" | "agency">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const results: ResultItem[] = [];

    if (typeFilter !== "agency") {
      allBrokers.forEach((b) => {
        if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return;
        if (city) {
          const bCities = brokerCitiesMap[b.id] ?? [];
          const brCities = branchCitiesMap[b.agencyId] ?? [];
          if (!bCities.includes(city) && !brCities.includes(city)) return;
        }
        if (specialization && !b.specialization.includes(specialization)) return;
        results.push({ type: "broker", data: b });
      });
    }

    if (typeFilter !== "broker") {
      allAgencies.forEach((a) => {
        if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return;
        if (city) {
          const brCities = branchCitiesMap[a.id] ?? [];
          if (!brCities.includes(city)) return;
        }
        if (specialization && !a.specializations.includes(specialization)) return;
        results.push({ type: "agency", data: a });
      });
    }

    results.sort((a, b) => {
      const lA = a.type === "broker" ? a.data.activeListings : (a.data as Agency).totalListings;
      const lB = b.type === "broker" ? b.data.activeListings : (b.data as Agency).totalListings;
      return lB - lA;
    });

    return results;
  }, [search, city, specialization, typeFilter, allBrokers, allAgencies, brokerCitiesMap, branchCitiesMap]);

  const hasFilters = search || city || specialization || typeFilter !== "all";

  useEffect(() => { setPage(1); }, [search, city, specialization, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginatedResults = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function clearFilters() {
    setSearch("");
    setCity(null);
    setSpecialization(null);
    setTypeFilter("all");
  }

  return (
    <>
      <div className="listing-search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder={t.specialists.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="listing-filters">
        <FilterDropdown
          label={t.specialists.location}
          value={city}
          options={cities.map((c) => ({ value: c, label: c }))}
          onChange={setCity}
        />
        <FilterDropdown
          label={t.specialists.specialization}
          value={specialization}
          options={specs.map((s) => ({ value: s, label: s }))}
          onChange={setSpecialization}
        />

        <div className="specialist-type-toggle">
          {(["all", "broker", "agency"] as const).map((ft) => (
            <button
              key={ft}
              className={`specialist-type-btn ${typeFilter === ft ? "specialist-type-btn--active" : ""}`}
              onClick={() => setTypeFilter(ft)}
            >
              {ft === "all" ? t.specialists.all : ft === "broker" ? t.specialists.brokers : t.specialists.agencies}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button className="filter-pill filter-pill--clear" onClick={clearFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            {t.specialists.clearFilters}
          </button>
        )}
      </div>

      <div className="listing-results-count">
        {(filtered.length === 1 ? t.specialists.foundOne : filtered.length >= 2 && filtered.length <= 4 ? t.specialists.foundFew : t.specialists.foundMany).replace("{count}", String(filtered.length))}
      </div>

      <div className="specialists-grid">
        {paginatedResults.map((item) =>
          item.type === "broker" ? (
            <Link key={`b-${item.data.id}`} href={`/makleri/${item.data.slug}`} className="specialist-card" style={{ textDecoration: "none" }}>
              <span className="specialist-badge specialist-badge--broker">{t.specialists.badgeBroker}</span>
              <div className="broker-list-avatar">
                {item.data.photo ? (
                  <img src={item.data.photo} alt={item.data.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div className="broker-list-name">{item.data.name}</div>
              <div className="broker-list-agency">{item.data.agencyName}</div>
              <div className="broker-list-spec">{item.data.specialization}</div>
              <div className="broker-list-stats">
                <div className="broker-stat">
                  <div className="broker-stat-value">{item.data.activeListings}</div>
                  <div className="broker-stat-label">{t.specialists.listingsLabel}</div>
                </div>
                <div className="broker-stat">
                  <div className="broker-stat-value">{item.data.rating}</div>
                  <div className="broker-stat-label">{t.specialists.ratingLabel}</div>
                </div>
                <div className="broker-stat">
                  <div className="broker-stat-value">{item.data.totalDeals}</div>
                  <div className="broker-stat-label">{t.specialists.dealsLabel}</div>
                </div>
              </div>
            </Link>
          ) : (
            <Link key={`a-${item.data.id}`} href={`/kancelare/${(item.data as Agency).slug}`} className="specialist-card" style={{ textDecoration: "none" }}>
              <span className="specialist-badge specialist-badge--agency">{t.specialists.badgeAgency}</span>
              <div className="agency-list-logo">
                {(item.data as Agency).logo ? (
                  <img src={(item.data as Agency).logo} alt={(item.data as Agency).name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                  </svg>
                )}
              </div>
              <div className="agency-list-name">{(item.data as Agency).name}</div>
              <div className="agency-list-desc">{(item.data as Agency).description}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {(item.data as Agency).specializations.slice(0, 3).map((spec) => (
                  <span key={spec} className="broker-profile-tag">{spec}</span>
                ))}
              </div>
              <div className="agency-list-stats">
                <div className="broker-stat">
                  <div className="broker-stat-value">{(item.data as Agency).totalBrokers}</div>
                  <div className="broker-stat-label">{t.specialists.brokersLabel}</div>
                </div>
                <div className="broker-stat">
                  <div className="broker-stat-value">{(item.data as Agency).rating}</div>
                  <div className="broker-stat-label">{t.specialists.ratingLabel}</div>
                </div>
                <div className="broker-stat">
                  <div className="broker-stat-value">{(item.data as Agency).totalDeals}</div>
                  <div className="broker-stat-label">{t.specialists.dealsLabel}</div>
                </div>
              </div>
            </Link>
          )
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p>{t.specialists.noResults}</p>
        </div>
      )}
    </>
  );
}
