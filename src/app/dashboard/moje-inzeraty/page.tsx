"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";
import { PurchaseDialog } from "@/components/purchase-dialog";

type PropertyRow = {
  id: string; slug: string; title: string; city: string; price: number; price_currency: string;
  listing_type: string; category: string; active: boolean; created_at: string;
  image_src: string; area: number; rooms_label: string;
  featured: boolean; featured_until: string | null;
};

// ── Reusable filter dropdown (same style as listings page) ──────────
function FilterDropdown({ label, value, options, onChange }: {
  label: string; value: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sel = value ? options.find((o) => o.value === value)?.label : null;
  return (
    <div className="filter-dropdown" ref={ref}>
      <button className={`filter-dropdown-trigger ${value ? "filter-dropdown-trigger--active" : ""}`} onClick={() => setOpen(!open)}>
        <span>{sel ?? label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`filter-dropdown-chevron ${open ? "filter-dropdown-chevron--open" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="filter-dropdown-menu">
          <button className={`filter-dropdown-item ${!value ? "filter-dropdown-item--active" : ""}`} onClick={() => { onChange(null); setOpen(false); }}>Vše</button>
          {options.map((o) => (
            <button key={o.value} className={`filter-dropdown-item ${value === o.value ? "filter-dropdown-item--active" : ""}`} onClick={() => { onChange(value === o.value ? null : o.value); setOpen(false); }}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function RangeDropdown({ label, minValue, maxValue, onMinChange, onMaxChange, presets, unit }: {
  label: string; minValue: number | null; maxValue: number | null;
  onMinChange: (v: number | null) => void; onMaxChange: (v: number | null) => void;
  presets: number[]; unit: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const hasValue = minValue !== null || maxValue !== null;
  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1).replace(".0", "")} M` : n >= 1000 ? `${n / 1000} tis.` : String(n);
  const displayLabel = hasValue ? `${minValue ? fmt(minValue) : "0"} – ${maxValue ? fmt(maxValue) : "∞"} ${unit}` : label;
  return (
    <div className="filter-dropdown" ref={ref}>
      <button className={`filter-dropdown-trigger ${hasValue ? "filter-dropdown-trigger--active" : ""}`} onClick={() => setOpen(!open)}>
        <span>{displayLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`filter-dropdown-chevron ${open ? "filter-dropdown-chevron--open" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="filter-dropdown-menu" style={{ minWidth: 220, padding: 12 }}>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Od</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            <button className={`filter-dropdown-item ${minValue === null ? "filter-dropdown-item--active" : ""}`} style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMinChange(null)}>Min</button>
            {presets.map((v) => <button key={`min-${v}`} className={`filter-dropdown-item ${minValue === v ? "filter-dropdown-item--active" : ""}`} style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMinChange(minValue === v ? null : v)}>{fmt(v)}</button>)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Do</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button className={`filter-dropdown-item ${maxValue === null ? "filter-dropdown-item--active" : ""}`} style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMaxChange(null)}>Max</button>
            {presets.map((v) => <button key={`max-${v}`} className={`filter-dropdown-item ${maxValue === v ? "filter-dropdown-item--active" : ""}`} style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => onMaxChange(maxValue === v ? null : v)}>{fmt(v)}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

const ALL_CATEGORIES: Record<string, string> = { apartment: "Byt", house: "Dům", land: "Pozemek", commercial: "Komerční", other: "Ostatní" };
const ALL_TYPES: Record<string, string> = { sale: "Prodej", rent: "Pronájem" };
const ALL_CURRENCIES: Record<string, string> = { czk: "CZK", eur: "EUR", chf: "CHF", gbp: "GBP", usd: "USD" };
const SORT_OPTIONS = [
  { value: "created_at-desc", label: "Nejnovější" },
  { value: "created_at-asc", label: "Nejstarší" },
  { value: "price-desc", label: "Cena ↓" },
  { value: "price-asc", label: "Cena ↑" },
];
const PAGE_SIZE = 24;

// Generate smart price presets based on actual data range and currency
function generatePricePresets(min: number, max: number, currency: string): number[] {
  if (!max) return [];
  // Default presets per currency
  const defaults: Record<string, number[]> = {
    czk: [500000, 1000000, 2000000, 3000000, 5000000, 8000000, 10000000, 15000000, 20000000, 50000000],
    eur: [20000, 50000, 100000, 150000, 200000, 300000, 500000, 750000, 1000000, 2000000],
    chf: [50000, 100000, 200000, 300000, 500000, 750000, 1000000, 1500000, 2000000, 5000000],
    gbp: [20000, 50000, 100000, 200000, 300000, 500000, 750000, 1000000, 2000000],
    usd: [20000, 50000, 100000, 200000, 300000, 500000, 750000, 1000000, 2000000],
  };
  const presets = defaults[currency] || defaults.czk;
  // Filter to relevant range: keep presets between 50% of min and 150% of max
  const lo = min * 0.5;
  const hi = max * 1.5;
  return presets.filter((p) => p >= lo && p <= hi);
}

function generateAreaPresets(min: number, max: number): number[] {
  const all = [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 300, 500, 1000, 2000, 5000];
  if (!max) return all.slice(0, 8);
  const lo = Math.max(0, min * 0.5);
  const hi = max * 1.5;
  return all.filter((p) => p >= lo && p <= hi);
}

type FilterStats = {
  categories: { value: string; label: string; count: number }[];
  types: { value: string; label: string; count: number }[];
  currencies: { value: string; label: string; count: number }[];
  statuses: { value: string; label: string; count: number }[];
  priceRange: { min: number; max: number };
  areaRange: { min: number; max: number };
};

export default function BrokerListingsPage() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [listingType, setListingType] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sort, setSort] = useState("created_at-desc");
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [areaMin, setAreaMin] = useState<number | null>(null);
  const [areaMax, setAreaMax] = useState<number | null>(null);
  const [filterStats, setFilterStats] = useState<FilterStats | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchTimeout = useRef<any>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<{ city: string; count: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load filter stats + cities from broker's properties
  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    (async () => {
      const brokerIds: string[] = [];
      const { data: myBroker } = await supabase.from("brokers").select("id, agency_id").eq("user_id", user.id).single();
      const { data: myAgency } = await supabase.from("agencies").select("id").eq("user_id", user.id).single();
      const agencyId = myAgency?.id || myBroker?.agency_id || null;
      if (agencyId) {
        const { data: team } = await supabase.from("brokers").select("id").eq("agency_id", agencyId);
        if (team) for (const b of team) brokerIds.push(b.id);
      } else if (myBroker) {
        brokerIds.push(myBroker.id);
      }
      if (brokerIds.length === 0) return;

      const orFilter = `broker_id.in.(${brokerIds.join(",")}),created_by.eq.${user.id}`;

      // Fetch lightweight aggregation data (category, type, currency, price, area, city, active)
      let allRows: { city: string; category: string; listing_type: string; price_currency: string; price: number; area: number; active: boolean }[] = [];
      let pg = 0;
      while (true) {
        const { data } = await supabase
          .from("properties")
          .select("city, category, listing_type, price_currency, price, area, active")
          .or(orFilter)
          .range(pg * 1000, (pg + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data as typeof allRows);
        if (data.length < 1000) break;
        pg++;
      }

      // Cities
      const cityCount: Record<string, number> = {};
      for (const r of allRows) { if (r.city) cityCount[r.city] = (cityCount[r.city] || 0) + 1; }
      setSuggestions(Object.entries(cityCount).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count));

      // Categories
      const catCount: Record<string, number> = {};
      for (const r of allRows) { if (r.category) catCount[r.category] = (catCount[r.category] || 0) + 1; }
      const categories = Object.entries(catCount)
        .map(([value, count]) => ({ value, label: ALL_CATEGORIES[value] || value, count }))
        .sort((a, b) => b.count - a.count);

      // Types
      const typeCount: Record<string, number> = {};
      for (const r of allRows) { if (r.listing_type) typeCount[r.listing_type] = (typeCount[r.listing_type] || 0) + 1; }
      const types = Object.entries(typeCount)
        .map(([value, count]) => ({ value, label: ALL_TYPES[value] || value, count }))
        .sort((a, b) => b.count - a.count);

      // Currencies
      const curCount: Record<string, number> = {};
      for (const r of allRows) {
        const c = (r.price_currency || "czk").toLowerCase();
        curCount[c] = (curCount[c] || 0) + 1;
      }
      const currencies = Object.entries(curCount)
        .map(([value, count]) => ({ value, label: ALL_CURRENCIES[value] || value.toUpperCase(), count }))
        .sort((a, b) => b.count - a.count);

      // Statuses
      let activeCount = 0, inactiveCount = 0;
      for (const r of allRows) { if (r.active) activeCount++; else inactiveCount++; }
      const statuses = [
        ...(activeCount > 0 ? [{ value: "active", label: "Aktivní", count: activeCount }] : []),
        ...(inactiveCount > 0 ? [{ value: "inactive", label: "Neaktivní", count: inactiveCount }] : []),
      ];

      // Price range
      const prices = allRows.map((r) => r.price).filter((p) => p > 0);
      const priceRange = { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };

      // Area range
      const areas = allRows.map((r) => r.area).filter((a) => a > 0);
      const areaRange = { min: areas.length ? Math.min(...areas) : 0, max: areas.length ? Math.max(...areas) : 0 };

      setFilterStats({ categories, types, currencies, statuses, priceRange, areaRange });
    })();
  }, [user]);

  // Close suggestions on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredSuggestions = search.length > 0
    ? suggestions.filter((s) => s.city.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : suggestions.slice(0, 15);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, listingType, category, currency, status, sort, priceMin, priceMax, areaMin, areaMax]);

  const fetchData = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    setLoading(true);

    // Get broker/agency scope
    const brokerIds: string[] = [];
    const { data: myBroker } = await supabase.from("brokers").select("id, agency_id").eq("user_id", user.id).single();
    const { data: myAgency } = await supabase.from("agencies").select("id").eq("user_id", user.id).single();
    const agencyId = myAgency?.id || myBroker?.agency_id || null;

    if (agencyId) {
      const { data: team } = await supabase.from("brokers").select("id").eq("agency_id", agencyId);
      if (team) for (const b of team) brokerIds.push(b.id);
    } else if (myBroker) {
      brokerIds.push(myBroker.id);
    }

    if (brokerIds.length === 0 && !user) { setLoading(false); return; }

    const offset = (page - 1) * PAGE_SIZE;
    const filters: string[] = [];
    if (brokerIds.length > 0) filters.push(`broker_id.in.(${brokerIds.join(",")})`);
    filters.push(`created_by.eq.${user.id}`);

    let query = supabase
      .from("properties")
      .select("id, slug, title, city, price, price_currency, listing_type, category, active, created_at, image_src, area, rooms_label, featured, featured_until", { count: "exact" })
      .or(filters.join(","));

    if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%`);
    if (listingType) query = query.eq("listing_type", listingType);
    if (category) query = query.eq("category", category);
    if (currency) query = query.eq("price_currency", currency);
    if (status === "active") query = query.eq("active", true);
    if (status === "inactive") query = query.eq("active", false);
    if (priceMin) query = query.gte("price", priceMin);
    if (priceMax) query = query.lte("price", priceMax);
    if (areaMin) query = query.gte("area", areaMin);
    if (areaMax) query = query.lte("area", areaMax);

    const [sortCol, sortDir] = sort.split("-");
    query = query.order(sortCol, { ascending: sortDir === "asc" }).range(offset, offset + PAGE_SIZE - 1);

    const { data, count } = await query;
    setProperties((data as PropertyRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [user, page, debouncedSearch, listingType, category, currency, status, sort, priceMin, priceMax, areaMin, areaMax]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilters = [listingType, category, currency, status, priceMin, priceMax, areaMin, areaMax].filter(Boolean).length;

  // Derive dynamic options from filterStats
  const fs = filterStats;
  const activeCurrency = currency || (fs?.currencies.length === 1 ? fs.currencies[0].value : "czk");
  const pricePresets = fs ? generatePricePresets(fs.priceRange.min, fs.priceRange.max, activeCurrency) : [];
  const areaPresets = fs ? generateAreaPresets(fs.areaRange.min, fs.areaRange.max) : [];
  const currencyUnit = activeCurrency === "eur" ? "€" : activeCurrency === "chf" ? "CHF" : activeCurrency === "gbp" ? "£" : activeCurrency === "usd" ? "$" : "Kč";

  const formatPrice = (p: number, cur: string) => {
    if (!p) return "—";
    const c = (cur || "czk").toUpperCase();
    return `${p.toLocaleString("cs")} ${c === "CZK" ? "Kč" : c === "EUR" ? "€" : c === "CHF" ? "CHF" : c}`;
  };

  return (
    <div className="dashboard-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 className="dashboard-page-title" style={{ marginBottom: 0 }}>
          {t.dashboard.myListingsTitle}
          <span style={{ fontWeight: 400, fontSize: "0.75em", color: "var(--text-muted)", marginLeft: 8 }}>
            ({total.toLocaleString("cs")})
          </span>
        </h1>
        <button className="admin-btn admin-btn--primary" onClick={() => router.push("/dashboard/moje-inzeraty/novy")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          {t.dashboard.newProperty}
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <div ref={searchContainerRef} style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={t.dashboard.myListingsSearchPlaceholder}
            style={{ width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: "0.85rem" }}
          />
          {search && (
            <button onClick={() => { setSearch(""); setShowSuggestions(false); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}>×</button>
          )}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="filter-dropdown-menu" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, maxHeight: 280, overflowY: "auto", marginTop: 4 }}>
              {filteredSuggestions.map((s) => (
                <button
                  key={s.city}
                  className={`filter-dropdown-item ${search === s.city ? "filter-dropdown-item--active" : ""}`}
                  onClick={() => { setSearch(s.city); setShowSuggestions(false); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4, marginRight: 6, flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {s.city}
                  <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: "0.8em" }}>{s.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {fs && fs.types.length > 1 && <FilterDropdown label="Typ" value={listingType} options={fs.types.map((t) => ({ value: t.value, label: `${t.label} (${t.count})` }))} onChange={setListingType} />}
        {fs && fs.categories.length > 1 && <FilterDropdown label="Kategorie" value={category} options={fs.categories.map((c) => ({ value: c.value, label: `${c.label} (${c.count})` }))} onChange={setCategory} />}
        {fs && fs.currencies.length > 1 && <FilterDropdown label="Měna" value={currency} options={fs.currencies.map((c) => ({ value: c.value, label: `${c.label} (${c.count})` }))} onChange={(v) => { setCurrency(v); setPriceMin(null); setPriceMax(null); }} />}
        {fs && fs.statuses.length > 1 && <FilterDropdown label="Stav" value={status} options={fs.statuses.map((s) => ({ value: s.value, label: `${s.label} (${s.count})` }))} onChange={setStatus} />}
        {pricePresets.length > 0 && <RangeDropdown label="Cena" minValue={priceMin} maxValue={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} presets={pricePresets} unit={currencyUnit} />}
        {areaPresets.length > 0 && <RangeDropdown label="Plocha" minValue={areaMin} maxValue={areaMax} onMinChange={setAreaMin} onMaxChange={setAreaMax} presets={areaPresets} unit="m²" />}
        <FilterDropdown label="Řazení" value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v || "created_at-desc")} />
        {activeFilters > 0 && (
          <button
            onClick={() => { setListingType(null); setCategory(null); setCurrency(null); setStatus(null); setPriceMin(null); setPriceMax(null); setAreaMin(null); setAreaMax(null); setSearch(""); }}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: "0.82rem", cursor: "pointer", color: "var(--text-muted)" }}
          >Resetovat ({activeFilters})</button>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: "var(--text-muted)", padding: 20 }}>{t.common.loading}</p>
      ) : properties.length === 0 ? (
        <p style={{ color: "var(--text-muted)", padding: 20 }}>Žádné nabídky neodpovídají filtrům.</p>
      ) : (
        <PropertyGrid properties={properties} router={router} formatPrice={formatPrice} allCategories={ALL_CATEGORIES} onRefresh={() => setPage(page)} />

      )}

      {/* ── Pagination ───────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24, alignItems: "center" }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: page > 1 ? "pointer" : "default", opacity: page <= 1 ? 0.4 : 1 }}>←</button>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: page < totalPages ? "pointer" : "default", opacity: page >= totalPages ? 0.4 : 1 }}>→</button>
        </div>
      )}
    </div>
  );
}

// ── Property Grid with TIP/TOP buttons ────────────────────────────
function PropertyGrid({ properties, router, formatPrice, allCategories, onRefresh }: {
  properties: PropertyRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
  formatPrice: (p: number, c: string) => string;
  allCategories: Record<string, string>;
  onRefresh: () => void;
}) {
  const [purchaseTarget, setPurchaseTarget] = useState<{ id: string; code: string } | null>(null);

  function isTipActive(p: PropertyRow) {
    return p.featured && (!p.featured_until || new Date(p.featured_until) > new Date());
  }

  return (
    <>
      <div className="dashboard-favorites-grid">
        {properties.map((p) => (
          <div key={p.id} className="dashboard-fav-card" style={{ position: "relative" }}>
            <div className="dashboard-fav-image" style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/moje-inzeraty/${p.id}/upravit`)}>
              <img src={p.image_src && !p.image_src.includes("placeholder") ? p.image_src : "/branding/placeholder.png"} alt={p.title || ""} />
              <span className={`property-badge property-badge--${p.listing_type}`}>
                {p.listing_type === "sale" ? "Prodej" : p.listing_type === "rent" ? "Pronájem" : p.listing_type}
              </span>
              <span style={{ position: "absolute", top: 6, right: 6, background: p.active ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 600 }}>
                {p.active ? "Aktivní" : "Neaktivní"}
              </span>
              {isTipActive(p) && (
                <span style={{ position: "absolute", bottom: 6, left: 6, background: "var(--color-accent, #ffb800)", color: "#000", borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 700 }}>
                  TIP
                </span>
              )}
            </div>
            <div className="dashboard-fav-info" style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/moje-inzeraty/${p.id}/upravit`)}>
              <span className="dashboard-fav-price">{formatPrice(p.price, p.price_currency)}</span>
              <span className="dashboard-fav-meta">
                {allCategories[p.category] || p.category}
                {p.rooms_label ? ` · ${p.rooms_label}` : ""}
                {p.area ? ` · ${p.area} m²` : ""}
              </span>
              <span className="dashboard-fav-location">{p.city || "—"}</span>
            </div>
            {/* Service buttons */}
            <div style={{ display: "flex", gap: 4, padding: "0 10px 10px", flexWrap: "wrap" }}>
              {!isTipActive(p) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setPurchaseTarget({ id: p.id, code: "tip_7d" }); }}
                  style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-accent, #ffb800)", background: "transparent", color: "var(--color-accent, #ffb800)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}
                >
                  TIP
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setPurchaseTarget({ id: p.id, code: "top_listing_7d" }); }}
                style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}
              >
                TOP
              </button>
            </div>
          </div>
        ))}
      </div>

      {purchaseTarget && (
        <PurchaseDialog
          serviceCode={purchaseTarget.code}
          targetId={purchaseTarget.id}
          targetType="property"
          onSuccess={() => { setPurchaseTarget(null); onRefresh(); }}
          onClose={() => setPurchaseTarget(null)}
        />
      )}
    </>
  );
}
