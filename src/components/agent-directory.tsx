"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="agent-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? "var(--color-accent)" : "none"} stroke="var(--color-accent)" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export function AgentDirectoryClient({ initialData }: Props) {
  const t = useT();
  const [tab, setTab] = useState<"agents" | "offices">("agents");
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [langFilter, setLangFilter] = useState<string | null>(null);

  // Collect unique specializations and languages
  const allSpecs = useMemo(() => {
    const s = new Set<string>();
    initialData.brokers.forEach((b) => { if (b.specialization) s.add(b.specialization); });
    initialData.agencies.forEach((a) => a.specializations?.forEach((sp) => s.add(sp)));
    return Array.from(s).sort();
  }, [initialData]);

  const allLangs = useMemo(() => {
    const l = new Set<string>();
    initialData.brokers.forEach((b) => b.languages?.forEach((lang) => l.add(lang)));
    return Array.from(l).sort();
  }, [initialData]);

  // Filter brokers
  const filteredBrokers = useMemo(() => {
    return initialData.brokers.filter((b) => {
      if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && !b.agencyName.toLowerCase().includes(search.toLowerCase())) return false;
      if (specFilter && b.specialization !== specFilter) return false;
      if (langFilter && !b.languages?.includes(langFilter)) return false;
      return true;
    });
  }, [initialData.brokers, search, specFilter, langFilter]);

  // Filter agencies
  const filteredAgencies = useMemo(() => {
    return initialData.agencies.filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.seatCity.toLowerCase().includes(search.toLowerCase())) return false;
      if (specFilter && !a.specializations?.includes(specFilter)) return false;
      return true;
    });
  }, [initialData.agencies, search, specFilter]);

  return (
    <main className="agent-directory">
      {/* Hero header */}
      <header className="agent-directory-header">
        <div className="agent-directory-header-text">
          <span className="agent-directory-label">{t.nav.brokers} & {t.nav.agencies}</span>
          <h1 className="agent-directory-title">{tab === "agents" ? "Najdi svého makléře" : "Realitní kanceláře"}</h1>
          <p className="agent-directory-desc">
            {tab === "agents"
              ? "Profesionálové, kteří rozumí trhu a pomohou najít ideální nemovitost."
              : "Prověřené kanceláře s kvalitním servisem a rozsáhlým portfoliem."}
          </p>
        </div>
        {/* Toggle */}
        <div className="agent-directory-toggle">
          <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>
            Makléři
          </button>
          <button className={tab === "offices" ? "active" : ""} onClick={() => setTab("offices")}>
            Kanceláře
          </button>
        </div>
      </header>

      <div className="agent-directory-body">
        {/* Sidebar filters */}
        <aside className="agent-directory-filters">
          <div className="agent-filter-group">
            <h3 className="agent-filter-title">Hledat</h3>
            <input
              type="text"
              className="agent-filter-search"
              placeholder={tab === "agents" ? "Jméno makléře..." : "Název kanceláře..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {allSpecs.length > 0 && (
            <div className="agent-filter-group">
              <h3 className="agent-filter-title">Specializace</h3>
              <div className="agent-filter-chips">
                {allSpecs.map((sp) => (
                  <button
                    key={sp}
                    className={`agent-chip ${specFilter === sp ? "active" : ""}`}
                    onClick={() => setSpecFilter(specFilter === sp ? null : sp)}
                  >{sp}</button>
                ))}
              </div>
            </div>
          )}

          {tab === "agents" && allLangs.length > 0 && (
            <div className="agent-filter-group">
              <h3 className="agent-filter-title">Jazyky</h3>
              <div className="agent-filter-chips">
                {allLangs.map((l) => (
                  <button
                    key={l}
                    className={`agent-chip ${langFilter === l ? "active" : ""}`}
                    onClick={() => setLangFilter(langFilter === l ? null : l)}
                  >{l}</button>
                ))}
              </div>
            </div>
          )}

          {(search || specFilter || langFilter) && (
            <button className="agent-filter-clear" onClick={() => { setSearch(""); setSpecFilter(null); setLangFilter(null); }}>
              Smazat filtry
            </button>
          )}
        </aside>

        {/* Grid */}
        <section className="agent-directory-grid-section">
          <div className="agent-directory-count">
            {tab === "agents"
              ? `${filteredBrokers.length} makléřů`
              : `${filteredAgencies.length} kanceláří`}
          </div>

          {tab === "agents" ? (
            <div className="agent-grid">
              {filteredBrokers.map((broker) => (
                <Link key={broker.id} href={`/makleri/${broker.slug}`} className="agent-card">
                  <div className="agent-card-portrait">
                    {broker.photo ? (
                      <img src={broker.photo} alt={broker.name} />
                    ) : (
                      <div className="agent-card-placeholder">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                    )}
                    <div className="agent-card-overlay" />
                    {broker.isPromoted && <span className="agent-card-promoted">TOP</span>}
                    <div className="agent-card-content">
                      <div className="agent-card-bottom">
                        <div className="agent-card-meta">
                          {broker.rating > 0 && (
                            <div className="agent-card-rating">
                              <StarRating rating={broker.rating} />
                              <span className="agent-card-rating-text">{broker.rating}</span>
                            </div>
                          )}
                          <h2 className="agent-card-name">{broker.name}</h2>
                          <p className="agent-card-spec">{broker.specialization || broker.agencyName}</p>
                        </div>
                        <div className="agent-card-arrow">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17L17 7M17 7H7M17 7v10" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="agent-card-stats">
                    <span>{broker.activeListings} nabídek</span>
                    {broker.totalDeals > 0 && <span>{broker.totalDeals} obchodů</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="agency-grid">
              {filteredAgencies.map((agency) => (
                <Link key={agency.id} href={`/kancelare/${agency.slug}`} className="agency-card">
                  <div className="agency-card-header">
                    {agency.logo ? (
                      <img src={agency.logo} alt={agency.name} className="agency-card-logo" />
                    ) : (
                      <div className="agency-card-logo-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M12 11h.01M12 15h.01M18 11h.01M18 15h.01M6 7V3h12v4" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <h2 className="agency-card-name">{agency.name}</h2>
                      {agency.seatCity && <p className="agency-card-city">{agency.seatCity}</p>}
                    </div>
                    {agency.rating > 0 && (
                      <div className="agency-card-rating">
                        <StarRating rating={agency.rating} />
                        <span>{agency.rating}</span>
                      </div>
                    )}
                  </div>
                  {agency.description && <p className="agency-card-desc">{agency.description}</p>}
                  <div className="agency-card-stats">
                    <div className="agency-card-stat">
                      <span className="agency-card-stat-value">{agency.totalBrokers}</span>
                      <span className="agency-card-stat-label">makléřů</span>
                    </div>
                    <div className="agency-card-stat">
                      <span className="agency-card-stat-value">{agency.totalListings}</span>
                      <span className="agency-card-stat-label">nabídek</span>
                    </div>
                  </div>
                  {agency.specializations?.length > 0 && (
                    <div className="agency-card-specs">
                      {agency.specializations.slice(0, 3).map((sp) => (
                        <span key={sp} className="agency-card-spec-tag">{sp}</span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
