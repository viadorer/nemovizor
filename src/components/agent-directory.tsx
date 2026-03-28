"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
// Using img instead of Image to avoid domain config issues with R2 URLs
import { useT } from "@/i18n/provider";

type BrokerCard = {
  id: string; name: string; slug: string; photo: string;
  phone: string; email: string; specialization: string;
  languages: string[]; rating: number; activeListings: number;
  totalDeals: number; yearStarted?: number; isPromoted: boolean;
  agencyName: string; agencySlug: string; agencyLogo: string;
};

type AgencyCard = {
  id: string; name: string; slug: string; logo: string;
  description: string; seatCity: string; rating: number;
  specializations: string[]; totalBrokers: number; totalListings: number;
};

type Props = {
  initialData: {
    brokers: BrokerCard[];
    agencies: AgencyCard[];
    total: number;
  };
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  if (rating <= 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--color-accent)" stroke="var(--color-accent)" strokeWidth="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>{rating}</span>
    </span>
  );
}

export function AgentDirectoryClient({ initialData }: Props) {
  const t = useT();
  const [tab, setTab] = useState<"agents" | "offices">("agents");
  const [search, setSearch] = useState("");

  const filteredBrokers = useMemo(() => {
    if (!search) return initialData.brokers;
    const q = search.toLowerCase();
    return initialData.brokers.filter((b) =>
      b.name.toLowerCase().includes(q) || b.agencyName.toLowerCase().includes(q) || b.specialization.toLowerCase().includes(q)
    );
  }, [initialData.brokers, search]);

  const filteredAgencies = useMemo(() => {
    if (!search) return initialData.agencies;
    const q = search.toLowerCase();
    return initialData.agencies.filter((a) =>
      a.name.toLowerCase().includes(q) || a.seatCity.toLowerCase().includes(q)
    );
  }, [initialData.agencies, search]);

  return (
    <main className="ad-main">
      {/* Header */}
      <div className="ad-header">
        <h1 className="ad-title">{tab === "agents" ? `${t.nav.brokers} & ${t.nav.agencies}` : t.nav.agencies}</h1>
        <div className="ad-controls">
          <div className="ad-toggle">
            <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>
              {t.nav.brokers}
            </button>
            <button className={tab === "offices" ? "active" : ""} onClick={() => setTab("offices")}>
              {t.nav.agencies}
            </button>
          </div>
          <input
            type="text"
            className="ad-search"
            placeholder={tab === "agents" ? "Hledat makléře..." : "Hledat kancelář..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <p className="ad-count">
        {tab === "agents" ? `${filteredBrokers.length} makléřů` : `${filteredAgencies.length} kanceláří`}
      </p>

      {/* Broker grid */}
      {tab === "agents" && (
        <div className="ad-grid">
          {filteredBrokers.map((b) => (
            <Link key={b.id} href={`/makleri/${b.slug}`} className="ad-card">
              <div className="ad-card-img">
                {b.photo && b.photo.startsWith("http") ? (
                  <img src={b.photo} alt={b.name} className="ad-card-photo" />
                ) : (
                  <div className="ad-card-nophoto">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </div>
                )}
                {b.isPromoted && <span className="ad-card-tip">TOP</span>}
              </div>
              <div className="ad-card-body">
                <div className="ad-card-row">
                  <h3 className="ad-card-name">{b.name}</h3>
                  <StarRating rating={b.rating} />
                </div>
                {b.agencyName && <p className="ad-card-agency">{b.agencyName}</p>}
                {b.specialization && <p className="ad-card-spec">{b.specialization}</p>}
                <div className="ad-card-meta">
                  <span>{b.activeListings} nabídek</span>
                  {b.totalDeals > 0 && <span>{b.totalDeals} obchodů</span>}
                  {b.phone && <span>{b.phone}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Agency grid */}
      {tab === "offices" && (
        <div className="ad-grid ad-grid--agency">
          {filteredAgencies.map((a) => (
            <Link key={a.id} href={`/kancelare/${a.slug}`} className="ad-card ad-card--agency">
              <div className="ad-card-agency-header">
                {a.logo && a.logo.startsWith("http") ? (
                  <img src={a.logo} alt={a.name} className="ad-card-agency-logo" />
                ) : (
                  <div className="ad-card-agency-logo-ph">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M12 11h.01M12 15h.01M18 11h.01M18 15h.01M6 7V3h12v4" /></svg>
                  </div>
                )}
                <div>
                  <h3 className="ad-card-name">{a.name}</h3>
                  {a.seatCity && <p className="ad-card-city">{a.seatCity}</p>}
                </div>
                <StarRating rating={a.rating} />
              </div>
              {a.description && <p className="ad-card-desc">{a.description}</p>}
              <div className="ad-card-stats">
                <div>
                  <span className="ad-card-stat-val">{a.totalListings}</span>
                  <span className="ad-card-stat-lbl">nabídek</span>
                </div>
                <div>
                  <span className="ad-card-stat-val">{a.totalBrokers}</span>
                  <span className="ad-card-stat-lbl">makléřů</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
