"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getAgencies,
  getAgencyCities,
  getAgencyBranchCities,
  getAllBranchCities,
  getAllBrokerActiveCities,
} from "@/lib/api";
import type { Agency } from "@/lib/types";

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

export default function AgenciesPage() {
  const [search, setSearch] = useState("");
  const [cityActivity, setCityActivity] = useState<string | null>(null);
  const [citySeat, setCitySeat] = useState<string | null>(null);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [activityCities, setActivityCities] = useState<string[]>([]);
  const [seatCities, setSeatCities] = useState<string[]>([]);
  const [agencyCitiesMap, setAgencyCitiesMap] = useState<Record<string, string[]>>({});
  const [branchCitiesMap, setBranchCitiesMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    Promise.all([getAgencies(), getAllBrokerActiveCities(), getAllBranchCities()]).then(([a, ac, sc]) => {
      setAllAgencies(a);
      setActivityCities(ac);
      setSeatCities(sc);
      Promise.all(a.map((ag) => getAgencyCities(ag.id).then((c) => [ag.id, c] as const))).then(
        (entries) => setAgencyCitiesMap(Object.fromEntries(entries))
      );
      Promise.all(a.map((ag) => getAgencyBranchCities(ag.id).then((c) => [ag.id, c] as const))).then(
        (entries) => setBranchCitiesMap(Object.fromEntries(entries))
      );
    });
  }, []);

  const filtered = useMemo(() => {
    return allAgencies.filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (cityActivity) {
        const cities = agencyCitiesMap[a.id] ?? [];
        if (!cities.includes(cityActivity)) return false;
      }
      if (citySeat) {
        const branchCities = branchCitiesMap[a.id] ?? [];
        if (!branchCities.includes(citySeat)) return false;
      }
      return true;
    });
  }, [search, cityActivity, citySeat, allAgencies, agencyCitiesMap, branchCitiesMap]);

  const hasFilters = search || cityActivity || citySeat;

  function clearFilters() {
    setSearch("");
    setCityActivity(null);
    setCitySeat(null);
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, paddingBottom: 48 }}>
        <div className="container">
          <h1 className="section-title" style={{ marginBottom: 8 }}>Realitní kanceláře</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: 24 }}>
            Přehled prověřených realitních kanceláří a jejich nabídek
          </p>

          <div className="listing-search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Hledat kancelář podle názvu…"
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
            Nalezeno {filtered.length} {filtered.length === 1 ? "kancelář" : filtered.length >= 2 && filtered.length <= 4 ? "kanceláře" : "kanceláří"}
          </div>

          <div className="agencies-grid">
            {filtered.map((agency) => (
              <Link key={agency.id} href={`/kancelare/${agency.slug}`} className="agency-list-card">
                <div className="agency-list-logo">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                  </svg>
                </div>
                <div className="agency-list-name">{agency.name}</div>
                <div className="agency-list-desc">{agency.description}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {agency.specializations.map((spec) => (
                    <span key={spec} className="broker-profile-tag">{spec}</span>
                  ))}
                </div>
                <div className="agency-list-stats">
                  <div className="broker-stat">
                    <div className="broker-stat-value">{agency.totalBrokers}</div>
                    <div className="broker-stat-label">Makléřů</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{agency.totalListings}</div>
                    <div className="broker-stat-label">Nabídek</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{agency.totalDeals}</div>
                    <div className="broker-stat-label">Obchodů</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{agency.rating}</div>
                    <div className="broker-stat-label">Hodnocení</div>
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
              <p>Žádné kanceláře neodpovídají zadaným filtrům.</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
