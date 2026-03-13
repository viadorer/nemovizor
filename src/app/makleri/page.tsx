"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getBrokers,
  getAgencies,
  getBrokerCities,
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

export default function BrokersPage() {
  const [search, setSearch] = useState("");
  const [cityActivity, setCityActivity] = useState<string | null>(null);
  const [citySeat, setCitySeat] = useState<string | null>(null);
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);
  const [allBrokers, setAllBrokers] = useState<Broker[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [activityCities, setActivityCities] = useState<string[]>([]);
  const [seatCities, setSeatCities] = useState<string[]>([]);
  const [brokerCitiesMap, setBrokerCitiesMap] = useState<Record<string, string[]>>({});
  const [branchCitiesMap, setBranchCitiesMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    Promise.all([getBrokers(), getAgencies(), getAllBrokerActiveCities(), getAllBranchCities()]).then(
      ([b, a, ac, sc]) => {
        setAllBrokers(b);
        setAgencies(a);
        setActivityCities(ac);
        setSeatCities(sc);
        // Pre-load broker cities and branch cities for filtering
        Promise.all(b.map((broker) => getBrokerCities(broker.id).then((c) => [broker.id, c] as const))).then(
          (entries) => setBrokerCitiesMap(Object.fromEntries(entries))
        );
        Promise.all([...new Set(b.map((broker) => broker.agencyId))].filter(Boolean).map(
          (aid) => getAgencyBranchCities(aid).then((c) => [aid, c] as const)
        )).then((entries) => setBranchCitiesMap(Object.fromEntries(entries)));
      }
    );
  }, []);

  const filtered = useMemo(() => {
    return allBrokers.filter((b) => {
      if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (agencyFilter && b.agencyId !== agencyFilter) return false;
      if (cityActivity) {
        const cities = brokerCitiesMap[b.id] ?? [];
        if (!cities.includes(cityActivity)) return false;
      }
      if (citySeat) {
        const branchCities = branchCitiesMap[b.agencyId] ?? [];
        if (!branchCities.includes(citySeat)) return false;
      }
      return true;
    });
  }, [search, cityActivity, citySeat, agencyFilter, allBrokers, brokerCitiesMap, branchCitiesMap]);

  const hasFilters = search || cityActivity || citySeat || agencyFilter;

  function clearFilters() {
    setSearch("");
    setCityActivity(null);
    setCitySeat(null);
    setAgencyFilter(null);
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
        <div className="container">
          <h1 className="section-title" style={{ fontSize: "2rem", marginBottom: 8 }}>
            Naši makléři
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
              placeholder="Hledat makléře podle jména…"
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
              options={agencies.map((a) => ({ value: a.id, label: a.name }))}
              onChange={setAgencyFilter}
            />
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
            Nalezeno {filtered.length} {filtered.length === 1 ? "makléř" : filtered.length >= 2 && filtered.length <= 4 ? "makléři" : "makléřů"}
          </div>

          <div className="brokers-grid">
            {filtered.map((broker) => (
              <Link key={broker.id} href={`/makleri/${broker.slug}`} className="broker-list-card" style={{ textDecoration: "none" }}>
                <div className="broker-list-avatar">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="broker-list-name">{broker.name}</div>
                <div className="broker-list-agency">{broker.agencyName}</div>
                <div className="broker-list-spec">{broker.specialization}</div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
                  {broker.bio.length > 120 ? broker.bio.slice(0, 120) + "…" : broker.bio}
                </p>
                <div className="broker-list-stats">
                  <div className="broker-stat">
                    <div className="broker-stat-value">{broker.activeListings}</div>
                    <div className="broker-stat-label">Nabídek</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{broker.rating}</div>
                    <div className="broker-stat-label">Hodnocení</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{broker.totalDeals}</div>
                    <div className="broker-stat-label">Obchodů</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p>Žádní makléři neodpovídají zadaným filtrům.</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
