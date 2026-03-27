"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";

type PropertyRow = {
  id: string; slug: string; title: string; city: string; price: number; price_currency: string;
  listing_type: string; category: string; active: boolean; created_at: string;
  image_src: string; area: number; rooms_label: string;
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

const CATEGORY_OPTIONS = [
  { value: "apartment", label: "Byt" },
  { value: "house", label: "Dům" },
  { value: "land", label: "Pozemek" },
  { value: "commercial", label: "Komerční" },
  { value: "other", label: "Ostatní" },
];
const TYPE_OPTIONS = [
  { value: "sale", label: "Prodej" },
  { value: "rent", label: "Pronájem" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Aktivní" },
  { value: "inactive", label: "Neaktivní" },
];
const SORT_OPTIONS = [
  { value: "created_at-desc", label: "Nejnovější" },
  { value: "created_at-asc", label: "Nejstarší" },
  { value: "price-desc", label: "Cena ↓" },
  { value: "price-asc", label: "Cena ↑" },
];
const PRICE_PRESETS = [500000, 1000000, 2000000, 5000000, 10000000, 20000000];
const AREA_PRESETS = [20, 40, 60, 80, 100, 150, 200, 500];
const PAGE_SIZE = 24;

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
  const [status, setStatus] = useState<string | null>(null);
  const [sort, setSort] = useState("created_at-desc");
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [areaMin, setAreaMin] = useState<number | null>(null);
  const [areaMax, setAreaMax] = useState<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchTimeout = useRef<any>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<{ city: string; count: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load unique cities from broker's properties for autocomplete
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
      // Fetch all cities (distinct via RPC or manual dedup)
      const { data: cityData } = await supabase
        .from("properties")
        .select("city")
        .or(`broker_id.in.(${brokerIds.join(",")}),created_by.eq.${user.id}`)
        .not("city", "is", null)
        .not("city", "eq", "");
      if (cityData) {
        const cityCount: Record<string, number> = {};
        for (const r of cityData as { city: string }[]) {
          if (r.city) cityCount[r.city] = (cityCount[r.city] || 0) + 1;
        }
        setSuggestions(
          Object.entries(cityCount)
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => b.count - a.count)
        );
      }
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
  useEffect(() => { setPage(1); }, [debouncedSearch, listingType, category, status, sort, priceMin, priceMax, areaMin, areaMax]);

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
      .select("id, slug, title, city, price, price_currency, listing_type, category, active, created_at, image_src, area, rooms_label", { count: "exact" })
      .or(filters.join(","));

    if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%`);
    if (listingType) query = query.eq("listing_type", listingType);
    if (category) query = query.eq("category", category);
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
  }, [user, page, debouncedSearch, listingType, category, status, sort, priceMin, priceMax, areaMin, areaMax]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilters = [listingType, category, status, priceMin, priceMax, areaMin, areaMax].filter(Boolean).length;

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
        <FilterDropdown label="Typ" value={listingType} options={TYPE_OPTIONS} onChange={setListingType} />
        <FilterDropdown label="Kategorie" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
        <FilterDropdown label="Stav" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <RangeDropdown label="Cena" minValue={priceMin} maxValue={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} presets={PRICE_PRESETS} unit="Kč" />
        <RangeDropdown label="Plocha" minValue={areaMin} maxValue={areaMax} onMinChange={setAreaMin} onMaxChange={setAreaMax} presets={AREA_PRESETS} unit="m²" />
        <FilterDropdown label="Řazení" value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v || "created_at-desc")} />
        {activeFilters > 0 && (
          <button
            onClick={() => { setListingType(null); setCategory(null); setStatus(null); setPriceMin(null); setPriceMax(null); setAreaMin(null); setAreaMax(null); setSearch(""); }}
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
        <div className="dashboard-favorites-grid">
          {properties.map((p) => (
            <div key={p.id} className="dashboard-fav-card" style={{ cursor: "pointer", position: "relative" }} onClick={() => router.push(`/dashboard/moje-inzeraty/${p.id}/upravit`)}>
              <div className="dashboard-fav-image">
                <img src={p.image_src && !p.image_src.includes("placeholder") ? p.image_src : "/branding/placeholder.png"} alt={p.title || ""} />
                <span className={`property-badge property-badge--${p.listing_type}`}>
                  {p.listing_type === "sale" ? "Prodej" : p.listing_type === "rent" ? "Pronájem" : p.listing_type}
                </span>
                <span style={{ position: "absolute", top: 6, right: 6, background: p.active ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 600 }}>
                  {p.active ? "Aktivní" : "Neaktivní"}
                </span>
              </div>
              <div className="dashboard-fav-info">
                <span className="dashboard-fav-price">{formatPrice(p.price, p.price_currency)}</span>
                <span className="dashboard-fav-meta">
                  {CATEGORY_OPTIONS.find((c) => c.value === p.category)?.label || p.category}
                  {p.rooms_label ? ` · ${p.rooms_label}` : ""}
                  {p.area ? ` · ${p.area} m²` : ""}
                </span>
                <span className="dashboard-fav-location">{p.city || "—"}</span>
              </div>
            </div>
          ))}
        </div>
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
