"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LocationSearch } from "@/components/location-search";
import { getFeaturedProperties, getLatestProperties, getAllProperties } from "@/lib/api";
import { Property } from "@/lib/types";
import Link from "next/link";

/** Haversine vzdálenost v km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useNearbyProperties(count = 6): { nearby: Property[]; cityLabel: string; loading: boolean } {
  const [nearby, setNearby] = useState<Property[]>([]);
  const [cityLabel, setCityLabel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllProperties().then((allProps) => {
      const fallback = (label = "Praha") => {
        const sorted = allProps
          .filter((p) => p.latitude && p.longitude)
          .sort((a, b) => {
            const dA = haversineKm(50.08, 14.42, a.latitude, a.longitude);
            const dB = haversineKm(50.08, 14.42, b.latitude, b.longitude);
            return dA - dB;
          });
        setNearby(sorted.slice(0, count));
        setCityLabel(label);
        setLoading(false);
      };

      if (!navigator.geolocation) {
        fallback();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: uLat, longitude: uLon } = pos.coords;
          const withDist = allProps
            .filter((p) => p.latitude && p.longitude)
            .map((p) => ({ p, dist: haversineKm(uLat, uLon, p.latitude, p.longitude) }))
            .sort((a, b) => a.dist - b.dist);

          const top = withDist.slice(0, count).map((x) => x.p);
          const closestCity = top[0]?.city || "vás";
          setNearby(top);
          setCityLabel(closestCity);
          setLoading(false);
        },
        () => fallback(),
        { timeout: 5000, maximumAge: 300000 }
      );
    });
  }, [count]);

  return { nearby, cityLabel, loading };
}

export default function Home() {
  const router = useRouter();
  const { nearby, cityLabel, loading } = useNearbyProperties(6);
  const [featured, setFeatured] = useState<Property[]>([]);
  const [latest, setLatest] = useState<Property[]>([]);

  useEffect(() => {
    getFeaturedProperties().then(setFeatured);
    getLatestProperties().then(setLatest);
  }, []);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="hero-flex-container">
              <div className="hero-text">
                <h1>Sledujte Nemovizor</h1>
                <h2>
                  Nejlepší způsob,
                  <br />
                  jak najít nový domov!
                </h2>

                <div className="hero-rating-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span>4.9 hodnocení</span>
                  <span className="hero-rating-separator">·</span>
                  <span>500+ recenzí</span>
                </div>

                <div className="hero-search">
                  <LocationSearch
                    placeholder="Zadejte adresu nebo město…"
                    onSelect={(item) => {
                      const city = item.city || item.name;
                      router.push(`/nabidky?location=${encodeURIComponent(city)}`);
                    }}
                  />
                </div>

                <p className="signup-text">
                  Staňte se členem.{" "}
                  <span className="login-options">(přihlásit/registrovat)</span>
                </p>
              </div>

              <div className="property-filters">
                <Link href="/nabidky?category=apartment" className="filter-btn">
                  Byt
                </Link>
                <Link href="/nabidky?category=house" className="filter-btn">
                  Dům
                </Link>
                <Link href="/nabidky?category=land" className="filter-btn">
                  Pozemek
                </Link>
                <Link href="/nabidky?category=commercial" className="filter-btn">
                  Komerční
                </Link>
              </div>
            </div>

            <div className="scroll-indicator">
              <div className="scroll-arrow" />
            </div>
          </div>
        </section>

        {/* ===== Service CTA strip (reas-inspired) ===== */}
        <section className="service-cards">
          <div className="container">
            <h2 className="section-title" style={{ textAlign: "center", marginBottom: 8 }}>
              Vyhledáte, oceníte i prodáte na jednom místě
            </h2>
            <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: 32, fontSize: "1rem" }}>
              Rychle, transparentně a bez stresu
            </p>
            <div className="service-cards-grid">
              <Link href="/oceneni" className="service-card">
                <span className="service-card-number">01</span>
                <div className="service-card-content">
                  <div className="service-card-title">Chytrý odhad ceny</div>
                  <div className="service-card-desc">
                    Zjistěte tržní hodnotu vaší nemovitosti zdarma do 24 hodin.
                  </div>
                </div>
                <span className="service-card-arrow">&rarr;</span>
              </Link>
              <Link href="/specialiste" className="service-card">
                <span className="service-card-number">02</span>
                <div className="service-card-content">
                  <div className="service-card-title">Ověření specialisté</div>
                  <div className="service-card-desc">
                    Najděte makléře a kanceláře podle lokality a zaměření.
                  </div>
                </div>
                <span className="service-card-arrow">&rarr;</span>
              </Link>
              <Link href="/nabidky" className="service-card">
                <span className="service-card-number">03</span>
                <div className="service-card-content">
                  <div className="service-card-title">Hlídač nabídek</div>
                  <div className="service-card-desc">
                    Sledujte nové nabídky ve vaší lokalitě. Nic vám neunikne.
                  </div>
                </div>
                <span className="service-card-arrow">&rarr;</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="property-listings">
          <div className="container">
            <h2 className="section-title">Prémiové nabídky</h2>
            <div className="property-row">
              {featured.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>
        </section>

        {/* ===== Novinky podle lokality ===== */}
        {!loading && nearby.length > 0 && (
          <section className="property-listings secondary-listings">
            <div className="container">
              <h2 className="section-title">
                Novinky v okolí {cityLabel ? `– ${cityLabel}` : ""}
              </h2>
              <div className="property-grid">
                {nearby.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <Link
                  href={cityLabel ? `/nabidky?location=${encodeURIComponent(cityLabel)}` : "/nabidky"}
                  className="btn-primary"
                  style={{ display: "inline-block", padding: "10px 28px", borderRadius: 8, fontWeight: 600, fontSize: "0.95rem", textDecoration: "none" }}
                >
                  Zobrazit vše v okolí →
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="property-listings secondary-listings">
          <div className="container">
            <h2 className="section-title">Nové nabídky</h2>
            <div className="property-grid">
              {latest.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
