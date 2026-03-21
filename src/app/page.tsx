"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AiSearch } from "@/components/ai-search";
import { filtersToSearchParams } from "@/lib/saved-searches";
import { Property } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { brand } from "@/brands";
import Link from "next/link";
import dynamic from "next/dynamic";

const HeroMap = dynamic(() => import("@/components/hero-map"), { ssr: false });

function useHomepageData() {
  const [latest, setLatest] = useState<Property[]>([]);
  const [stats, setStats] = useState({ total: 0, cities: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch latest properties via API
    fetch("/api/properties?sort=newest&limit=8", { cache: "no-store" })
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
      .catch((e) => { console.error("Failed to fetch latest properties:", e); setLoading(false); });

    // Fetch stats
    fetch("/api/filter-options")
      .then((r) => r.json())
      .then((d) => {
        setStats((s) => ({ ...s, cities: d.cities?.length || 0 }));
      })
      .catch((e) => { console.error("Failed to fetch filter options:", e); });
  }, []);

  return { latest, stats, loading };
}

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
  const t = useT();

  const categories = [
    { key: "apartment", label: t.categories.apartment, desc: t.categories.apartmentDesc },
    { key: "house", label: t.categories.house, desc: t.categories.houseDesc },
    { key: "land", label: t.categories.land, desc: t.categories.landDesc },
    { key: "commercial", label: t.categories.commercial, desc: t.categories.commercialDesc },
  ];

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
                {t.hero.title}
              </h1>
              <p className="hero-sub">
                {stats.total > 0 ? `${stats.total.toLocaleString(brand.locale)} ${t.hero.stats.properties} ${t.hero.statsSuffix}` : `${t.hero.statsPrefix} ${t.hero.stats.properties} ${t.hero.statsSuffix}`}
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
                <Link href="/nabidky?listingType=sale" className="hero-quick-link">{t.listingTypes.sale}</Link>
                <Link href="/nabidky?listingType=rent" className="hero-quick-link">{t.listingTypes.rent}</Link>
                <Link href="/prodat" className="hero-quick-link">{t.sell.lookingForBroker}</Link>
                {brand.features.valuation && (
                  <Link href="/oceneni" className="hero-quick-link">{t.valuation.priceEstimate}</Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ===== STATS STRIP ===== */}
        <section className="hp-stats">
          <div className="container hp-stats-grid">
            <div className="hp-stat">
              <span className="hp-stat-value">{stats.total > 0 ? stats.total.toLocaleString(brand.locale) : "---"}</span>
              <span className="hp-stat-label">{t.hero.stats.properties}</span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat-value">{stats.cities > 0 ? stats.cities : "---"}</span>
              <span className="hp-stat-label">{t.hero.stats.cities}</span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat-value">AI</span>
              <span className="hp-stat-label">{t.hero.stats.aiSearch}</span>
            </div>
            <div className="hp-stat">
              <span className="hp-stat-value">24/7</span>
              <span className="hp-stat-label">{t.hero.stats.alerts}</span>
            </div>
          </div>
        </section>

        {/* ===== CATEGORIES ===== */}
        <section className="hp-categories">
          <div className="container">
            <h2 className="hp-section-title">{t.homepage.searchingTitle}</h2>
            <div className="hp-cat-grid">
              {categories.map((cat) => (
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
              <h2 className="hp-section-title">{t.homepage.latestTitle}</h2>
              <Link href="/nabidky?sort=newest" className="hp-section-link">
                {t.common.seeAll}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>{t.common.loading}</div>
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
                  <h3>{t.homepage.step1Title}</h3>
                  <p>{t.homepage.step1Desc}</p>
                  <Link href="/nabidky" className="hp-step-link">
                    {t.homepage.step1Link}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
              {brand.features.valuation && (
              <div className="hp-step">
                <span className="hp-step-num">2</span>
                <div className="hp-step-content">
                  <h3>{t.homepage.step2Title}</h3>
                  <p>{t.homepage.step2Desc}</p>
                  <Link href="/oceneni" className="hp-step-link">
                    {t.homepage.step2Link}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
              )}
              <div className="hp-step">
                <span className="hp-step-num">{brand.features.valuation ? "3" : "2"}</span>
                <div className="hp-step-content">
                  <h3>{t.homepage.step3Title}</h3>
                  <p>{t.homepage.step3Desc}</p>
                  <Link href="/specialiste" className="hp-step-link">
                    {t.homepage.step3Link}
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
            <h2 className="hp-section-title">{t.homepage.popularLocations}</h2>
            <div className="hp-loc-grid">
              {POPULAR_CITIES.map((city) => (
                <Link key={city.name} href={`/nabidky?location=${encodeURIComponent(city.name)}`} className="hp-loc-card">
                  <span className="hp-loc-name">{city.name}</span>
                  <span className="hp-loc-count">{city.count} {t.homepage.listingsCount}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="hp-cta">
          <div className="container hp-cta-inner">
            <h2>{t.homepage.ctaTitle}</h2>
            <p>{t.homepage.ctaSubtitle}</p>
            <div className="hp-cta-buttons">
              {brand.features.valuation && (
                <Link href="/oceneni" className="hp-cta-btn hp-cta-btn--primary">{t.homepage.ctaValuation}</Link>
              )}
              <Link href="/specialiste" className="hp-cta-btn hp-cta-btn--secondary">{t.homepage.ctaSpecialist}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
