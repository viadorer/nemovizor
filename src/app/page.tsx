"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AiSearch } from "@/components/ai-search";
import { filtersToSearchParams } from "@/lib/saved-searches";
import { Property } from "@/lib/types";
import Link from "next/link";
import dynamic from "next/dynamic";

const HeroMap = dynamic(() => import("@/components/hero-map"), { ssr: false });

function useHomepageData() {
  const [latest, setLatest] = useState<Property[]>([]);
  const [stats, setStats] = useState({ total: 0, cities: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch latest properties via API
    fetch("/api/properties?sort=newest&limit=8")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          slug: row.slug as string,
          title: row.title as string,
          listingType: row.listing_type === "pronajem" ? "rent" : row.listing_type === "drazba" ? "auction" : "sale",
          category: row.category as string,
          roomsLabel: (row.rooms_label as string) || "",
          price: (row.price as number) || 0,
          area: (row.area as number) || 0,
          city: (row.city as string) || "",
          district: (row.district as string) || "",
          locationLabel: (row.location_label as string) || "",
          latitude: (row.latitude as number) || 0,
          longitude: (row.longitude as number) || 0,
          imageSrc: ((row.images as string[]) || [])[0] || "/images/placeholder.svg",
          imageAlt: (row.title as string) || "",
          featured: (row.featured as boolean) || false,
          showAgencyLogo: false,
          agencyName: "",
          matterportUrl: (row.matterport_url as string) || "",
          videoUrl: (row.video_url as string) || "",
          viewsTrend: undefined,
          summary: (row.summary as string) || "",
        }));
        setLatest(rows);
        setStats((s) => ({ ...s, total: d.total || 0 }));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch stats
    fetch("/api/filter-options")
      .then((r) => r.json())
      .then((d) => {
        setStats((s) => ({ ...s, cities: d.cities?.length || 0 }));
      })
      .catch(() => {});
  }, []);

  return { latest, stats, loading };
}

const CATEGORIES = [
  { key: "apartment", label: "Byty", desc: "Prodej i pronájem" },
  { key: "house", label: "Domy", desc: "Rodinné, vily, chalupy" },
  { key: "land", label: "Pozemky", desc: "Stavební i komerční" },
  { key: "commercial", label: "Komerční", desc: "Kanceláře, sklady, obchody" },
];

const POPULAR_CITIES = [
  { name: "Praha", count: "500+" },
  { name: "Brno", count: "200+" },
  { name: "Ostrava", count: "150+" },
  { name: "Plzeň", count: "80+" },
  { name: "Olomouc", count: "60+" },
  { name: "Liberec", count: "50+" },
  { name: "České Budějovice", count: "45+" },
  { name: "Hradec Králové", count: "40+" },
];

export default function Home() {
  const router = useRouter();
  const { latest, stats, loading } = useHomepageData();

  const latestSale = useMemo(() => latest.filter((p) => p.listingType === "sale").slice(0, 4), [latest]);
  const latestRent = useMemo(() => latest.filter((p) => p.listingType === "rent").slice(0, 4), [latest]);
  const latestAll = useMemo(() => {
    if (latestSale.length >= 4) return latestSale;
    if (latestRent.length >= 4) return latestRent;
    return latest.slice(0, 4);
  }, [latest, latestSale, latestRent]);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        {/* ===== HERO ===== */}
        <section className="hero hero--map">
          <HeroMap />
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="hero-center">
              <h1 className="hero-headline">
                Najděte svůj nový domov
              </h1>
              <p className="hero-sub">
                {stats.total > 0 ? `${stats.total.toLocaleString("cs")} nemovitostí` : "Tisíce nemovitostí"} z celé České republiky na jednom místě
              </p>

              <div className="hero-search">
                <AiSearch
                  onFiltersReady={(aiFilters) => {
                    const params = filtersToSearchParams(aiFilters as Record<string, string | number | null | undefined>);
                    router.push(`/nabidky?${params.toString()}`);
                  }}
                />
              </div>

              <div className="hero-quick-links">
                <Link href="/nabidky?listingType=sale" className="hero-quick-link">Prodej</Link>
                <Link href="/nabidky?listingType=rent" className="hero-quick-link">{"Pron\u00e1jem"}</Link>
                <Link href="/prodat" className="hero-quick-link">{"Hled\u00e1m makl\u00e9\u0159e"}</Link>
                <Link href="/oceneni" className="hero-quick-link">Odhad ceny</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ===== STATS STRIP ===== */}
        <section className="hp-stats">
          <div className="container hp-stats-grid">
            <div className="hp-stat">
              <span className="hp-stat-value">{stats.total > 0 ? stats.total.toLocaleString("cs") : "---"}</span>
              <span className="hp-stat-label">aktivních nabídek</span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat-value">{stats.cities > 0 ? stats.cities : "---"}</span>
              <span className="hp-stat-label">měst a obcí</span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat-value">AI</span>
              <span className="hp-stat-label">chytré vyhledávání</span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat-value">24/7</span>
              <span className="hp-stat-label">hlídač nabídek</span>
            </div>
          </div>
        </section>

        {/* ===== CATEGORIES ===== */}
        <section className="hp-categories">
          <div className="container">
            <h2 className="hp-section-title">Hledáte nemovitost?</h2>
            <div className="hp-cat-grid">
              {CATEGORIES.map((cat) => (
                <Link key={cat.key} href={`/nabidky?category=${cat.key}`} className="hp-cat-card">
                  <div className="hp-cat-label">{cat.label}</div>
                  <div className="hp-cat-desc">{cat.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ===== LATEST LISTINGS ===== */}
        <section className="hp-listings">
          <div className="container">
            <div className="hp-section-header">
              <h2 className="hp-section-title">Nejnovější nabídky</h2>
              <Link href="/nabidky?sort=newest" className="hp-section-link">
                Zobrazit vše
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>Načítání...</div>
            ) : (
              <div className="hp-property-grid">
                {latestAll.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="hp-steps">
          <div className="container">
            <div className="hp-steps-grid">
              <div className="hp-step">
                <span className="hp-step-num">1</span>
                <div className="hp-step-content">
                  <h3>Najděte nemovitost</h3>
                  <p>Prohledejte tisíce nabídek z celé Evropy. Filtry, mapa, AI vyhledávání.</p>
                  <Link href="/nabidky" className="hp-step-link">
                    Prohlížet nabídky
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
              <div className="hp-step">
                <span className="hp-step-num">2</span>
                <div className="hp-step-content">
                  <h3>Zjistěte reálnou cenu</h3>
                  <p>Odhad tržní hodnoty zdarma do 24 hodin. Žádné závazky.</p>
                  <Link href="/oceneni" className="hp-step-link">
                    Získat odhad
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
              <div className="hp-step">
                <span className="hp-step-num">3</span>
                <div className="hp-step-content">
                  <h3>Spojte se se specialistou</h3>
                  <p>Ověření makléři a kanceláře podle lokality, recenzí a výsledků.</p>
                  <Link href="/specialiste" className="hp-step-link">
                    Najít specialistu
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== POPULAR LOCATIONS ===== */}
        <section className="hp-locations">
          <div className="container">
            <h2 className="hp-section-title">Populární lokality</h2>
            <div className="hp-loc-grid">
              {POPULAR_CITIES.map((city) => (
                <Link key={city.name} href={`/nabidky?location=${encodeURIComponent(city.name)}`} className="hp-loc-card">
                  <span className="hp-loc-name">{city.name}</span>
                  <span className="hp-loc-count">{city.count} nabídek</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="hp-cta">
          <div className="container hp-cta-inner">
            <h2>Chcete prodat nebo pronajmout nemovitost?</h2>
            <p>Získejte odhad ceny zdarma a oslovte tisíce zájemců.</p>
            <div className="hp-cta-buttons">
              <Link href="/oceneni" className="hp-cta-btn hp-cta-btn--primary">Zjistit hodnotu nemovitosti</Link>
              <Link href="/specialiste" className="hp-cta-btn hp-cta-btn--secondary">Najít specialistu</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
