"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getBrokers,
  getAgencies,
  getBrokerCities,
  getAgencyCities,
  getAgencyBranchCities,
  getAllBrokerActiveCities,
  getAllBranchCities,
} from "@/lib/api";
import type { Broker, Agency } from "@/lib/types";

// ===== DROPDOWN =====
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

export default function BrokersPage() {
  const [search, setSearch] = useState("");
  const [cityActivity, setCityActivity] = useState<string | null>(null);
  const [citySeat, setCitySeat] = useState<string | null>(null);
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "broker" | "agency">("all");
  const [allBrokers, setAllBrokers] = useState<Broker[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [activityCities, setActivityCities] = useState<string[]>([]);
  const [seatCities, setSeatCities] = useState<string[]>([]);
  const [brokerCitiesMap, setBrokerCitiesMap] = useState<Record<string, string[]>>({});
  const [agencyCitiesMap, setAgencyCitiesMap] = useState<Record<string, string[]>>({});
  const [branchCitiesMap, setBranchCitiesMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    Promise.all([getBrokers(), getAgencies(), getAllBrokerActiveCities(), getAllBranchCities()]).then(
      ([b, a, ac, sc]) => {
        setAllBrokers(b);
        setAllAgencies(a);
        setActivityCities(ac);
        setSeatCities(sc);
        // Pre-load broker cities for filtering
        Promise.all(b.map((broker) => getBrokerCities(broker.id).then((c) => [broker.id, c] as const))).then(
          (entries) => setBrokerCitiesMap(Object.fromEntries(entries))
        );
        // Pre-load agency branch cities
        const allIds = [...new Set([...b.map((br) => br.agencyId), ...a.map((ag) => ag.id)])].filter(Boolean);
        Promise.all(allIds.map((id) => getAgencyBranchCities(id).then((c) => [id, c] as const))).then(
          (entries) => setBranchCitiesMap(Object.fromEntries(entries))
        );
        // Pre-load agency cities
        Promise.all(a.map((ag) => getAgencyCities(ag.id).then((c) => [ag.id, c] as const))).then(
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
        if (agencyFilter && b.agencyId !== agencyFilter) return;
        if (cityActivity) {
          const cities = brokerCitiesMap[b.id] ?? [];
          if (!cities.includes(cityActivity)) return;
        }
        if (citySeat) {
          const branchCities = branchCitiesMap[b.agencyId] ?? [];
          if (!branchCities.includes(citySeat)) return;
        }
        results.push({ type: "broker", data: b });
      });
    }

    if (typeFilter !== "broker") {
      allAgencies.forEach((a) => {
        if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return;
        if (agencyFilter && a.id !== agencyFilter) return;
        if (cityActivity) {
          const aCities = agencyCitiesMap[a.id] ?? [];
          if (!aCities.includes(cityActivity)) return;
        }
        if (citySeat) {
          const brCities = branchCitiesMap[a.id] ?? [];
          if (!brCities.includes(citySeat)) return;
        }
        results.push({ type: "agency", data: a });
      });
    }

    // Sort by active listings descending
    results.sort((a, b) => {
      const listingsA = a.type === "broker" ? a.data.activeListings : (a.data as Agency).totalListings;
      const listingsB = b.type === "broker" ? b.data.activeListings : (b.data as Agency).totalListings;
      return listingsB - listingsA;
    });

    return results;
  }, [search, cityActivity, citySeat, agencyFilter, typeFilter, allBrokers, allAgencies, brokerCitiesMap, agencyCitiesMap, branchCitiesMap]);

  const hasFilters = search || cityActivity || citySeat || agencyFilter || typeFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCityActivity(null);
    setCitySeat(null);
    setAgencyFilter(null);
    setTypeFilter("all");
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
        <div className="container">
          <h1 className="section-title" style={{ fontSize: "2rem", marginBottom: 8 }}>
            Makléři a kanceláře
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1rem", marginBottom: 24, maxWidth: 600 }}>
            Tým profesionálů s rozsáhlými zkušenostmi na českém realitním trhu.
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
              label="Město působnosti"
              value={cityActivity}
              options={activityCities.map((c) => ({ value: c, label: c }))}
              onChange={setCityActivity}
            />
            <FilterDropdown
              label="Město sídla"
              value={citySeat}
              options={seatCities.map((c) => ({ value: c, label: c }))}
              onChange={setCitySeat}
            />
            <FilterDropdown
              label="Kancelář"
              value={agencyFilter}
              options={allAgencies.map((a) => ({ value: a.id, label: a.name }))}
              onChange={setAgencyFilter}
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

          <div className="brokers-grid">
            {filtered.map((item) =>
              item.type === "broker" ? (
                <Link key={`b-${item.data.id}`} href={`/makleri/${item.data.slug}`} className="broker-list-card" style={{ textDecoration: "none" }}>
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
                <Link key={`a-${item.data.id}`} href={`/kancelare/${(item.data as Agency).slug}`} className="broker-list-card" style={{ textDecoration: "none" }}>
                  <div className="agency-list-logo" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--bg-filter)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "0 auto 16px" }}>
                    {(item.data as Agency).logo ? (
                      <img src={(item.data as Agency).logo} alt={(item.data as Agency).name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                      </svg>
                    )}
                  </div>
                  <div className="broker-list-name">{(item.data as Agency).name}</div>
                  <div className="broker-list-agency">Realitní kancelář</div>
                  <div className="broker-list-spec">
                    {(item.data as Agency).specializations?.slice(0, 2).join(", ") || "Realitní kancelář"}
                  </div>
                  <div className="broker-list-stats">
                    <div className="broker-stat">
                      <div className="broker-stat-value">{(item.data as Agency).totalListings}</div>
                      <div className="broker-stat-label">Nabídek</div>
                    </div>
                    <div className="broker-stat">
                      <div className="broker-stat-value">{(item.data as Agency).totalBrokers}</div>
                      <div className="broker-stat-label">Makléřů</div>
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
              <p>Žádní makléři ani kanceláře neodpovídají zadaným filtrům.</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
