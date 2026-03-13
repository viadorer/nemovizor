"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getBrokers,
  getAgencies,
  getAllLocationCities,
  getAllSpecializations,
  getBrokerCities,
  getAgencyCities,
  getAgencyBranchCities,
} from "@/lib/api";
import type { Broker, Agency } from "@/lib/types";

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

type ResultItem =
  | { type: "broker"; data: Broker }
  | { type: "agency"; data: Agency };

export default function SpecialistePage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [specialization, setSpecialization] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "broker" | "agency">("all");
  const [allBrokers, setAllBrokers] = useState<Broker[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [specs, setSpecs] = useState<string[]>([]);
  const [brokerCitiesMap, setBrokerCitiesMap] = useState<Record<string, string[]>>({});
  const [agencyCitiesMap, setAgencyCitiesMap] = useState<Record<string, string[]>>({});
  const [branchCitiesMap, setBranchCitiesMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    Promise.all([getBrokers(), getAgencies(), getAllLocationCities(), getAllSpecializations()]).then(
      ([b, a, c, s]) => {
        setAllBrokers(b);
        setAllAgencies(a);
        setCities(c);
        setSpecs(s);
        // Pre-load city maps
        Promise.all(b.map((br) => getBrokerCities(br.id).then((cc) => [br.id, cc] as const))).then(
          (entries) => setBrokerCitiesMap(Object.fromEntries(entries))
        );
        const allIds = [...new Set([...b.map((br) => br.agencyId), ...a.map((ag) => ag.id)])].filter(Boolean);
        Promise.all(allIds.map((id) => getAgencyBranchCities(id).then((cc) => [id, cc] as const))).then(
          (entries) => setBranchCitiesMap(Object.fromEntries(entries))
        );
        Promise.all(a.map((ag) => getAgencyCities(ag.id).then((cc) => [ag.id, cc] as const))).then(
          (entries) => setAgencyCitiesMap(Object.fromEntries(entries))
        );
      }
    );
  }, []);

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
          const aCities = agencyCitiesMap[a.id] ?? [];
          const brCities = branchCitiesMap[a.id] ?? [];
          if (!aCities.includes(city) && !brCities.includes(city)) return;
        }
        if (specialization && !a.specializations.includes(specialization)) return;
        results.push({ type: "agency", data: a });
      });
    }

    results.sort((a, b) => {
      const rA = a.type === "broker" ? a.data.rating : a.data.rating;
      const rB = b.type === "broker" ? b.data.rating : b.data.rating;
      return rB - rA;
    });

    return results;
  }, [search, city, specialization, typeFilter, allBrokers, allAgencies, brokerCitiesMap, agencyCitiesMap, branchCitiesMap]);

  const hasFilters = search || city || specialization || typeFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCity(null);
    setSpecialization(null);
    setTypeFilter("all");
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
        <div className="container">
          <h1 className="section-title" style={{ fontSize: "2rem", marginBottom: 8 }}>
            Najděte specialistu
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1rem", marginBottom: 24, maxWidth: 600 }}>
            Vyhledejte makléře nebo kancelář podle lokality a zaměření.
          </p>

          <div className="listing-search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Hledat podle jména…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="listing-filters">
            <FilterDropdown
              label="Lokalita"
              value={city}
              options={cities.map((c) => ({ value: c, label: c }))}
              onChange={setCity}
            />
            <FilterDropdown
              label="Zaměření"
              value={specialization}
              options={specs.map((s) => ({ value: s, label: s }))}
              onChange={setSpecialization}
            />

            <div className="specialist-type-toggle">
              {(["all", "broker", "agency"] as const).map((t) => (
                <button
                  key={t}
                  className={`specialist-type-btn ${typeFilter === t ? "specialist-type-btn--active" : ""}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === "all" ? "Vše" : t === "broker" ? "Makléři" : "Kanceláře"}
                </button>
              ))}
            </div>

            {hasFilters && (
              <button className="filter-pill filter-pill--clear" onClick={clearFilters}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Vymazat filtry
              </button>
            )}
          </div>

          <div className="listing-results-count">
            Nalezeno {filtered.length} {filtered.length === 1 ? "výsledek" : filtered.length >= 2 && filtered.length <= 4 ? "výsledky" : "výsledků"}
          </div>

          <div className="specialists-grid">
            {filtered.map((item) =>
              item.type === "broker" ? (
                <Link key={`b-${item.data.id}`} href={`/makleri/${item.data.slug}`} className="specialist-card" style={{ textDecoration: "none" }}>
                  <span className="specialist-badge specialist-badge--broker">Makléř</span>
                  <div className="broker-list-avatar">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="broker-list-name">{item.data.name}</div>
                  <div className="broker-list-agency">{item.data.agencyName}</div>
                  <div className="broker-list-spec">{item.data.specialization}</div>
                  <div className="broker-list-stats">
                    <div className="broker-stat">
                      <div className="broker-stat-value">{item.data.activeListings}</div>
                      <div className="broker-stat-label">Nabídek</div>
                    </div>
                    <div className="broker-stat">
                      <div className="broker-stat-value">{item.data.rating}</div>
                      <div className="broker-stat-label">Hodnocení</div>
                    </div>
                    <div className="broker-stat">
                      <div className="broker-stat-value">{item.data.totalDeals}</div>
                      <div className="broker-stat-label">Obchodů</div>
                    </div>
                  </div>
                </Link>
              ) : (
                <Link key={`a-${item.data.id}`} href={`/kancelare/${(item.data as Agency).slug}`} className="specialist-card" style={{ textDecoration: "none" }}>
                  <span className="specialist-badge specialist-badge--agency">Kancelář</span>
                  <div className="agency-list-logo">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                    </svg>
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
                      <div className="broker-stat-label">Makléřů</div>
                    </div>
                    <div className="broker-stat">
                      <div className="broker-stat-value">{(item.data as Agency).rating}</div>
                      <div className="broker-stat-label">Hodnocení</div>
                    </div>
                    <div className="broker-stat">
                      <div className="broker-stat-value">{(item.data as Agency).totalDeals}</div>
                      <div className="broker-stat-label">Obchodů</div>
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p>Žádným filtrům neodpovídají žádné výsledky.</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
