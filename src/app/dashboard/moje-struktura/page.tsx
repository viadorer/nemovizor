"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import Link from "next/link";

type AgencyInfo = {
  id: string; name: string; logo: string | null; slug: string | null;
  seat_city: string | null; seat_address: string | null;
  email: string | null; phone: string | null; website: string | null;
  rating: number | null; specializations: string[] | null;
};

type BrokerInfo = {
  id: string; user_id: string | null; name: string; slug: string | null;
  photo: string | null; email: string | null; phone: string | null;
  specialization: string | null; active_listings: number;
  rating: number | null; branch_id: string | null;
};

type BranchInfo = {
  id: string; name: string; city: string | null;
  address: string | null; zip: string | null;
  phone: string | null; email: string | null;
  is_headquarters: boolean;
};

export default function MojeStrukturaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [brokers, setBrokers] = useState<BrokerInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [brokerCounts, setBrokerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    (async () => {
      try {
        let agencyId: string | null = null;

        const { data: ownedAgency } = await supabase
          .from("agencies")
          .select("id, name, logo, slug, seat_city, seat_address, email, phone, website, rating, specializations")
          .eq("user_id", user.id)
          .single();

        if (ownedAgency) {
          agencyId = ownedAgency.id;
          setAgency(ownedAgency);
        }

        const { data: myBroker } = await supabase
          .from("brokers")
          .select("id, user_id, agency_id")
          .eq("user_id", user.id)
          .single();

        if (myBroker && !agencyId && myBroker.agency_id) {
          agencyId = myBroker.agency_id;
          const { data: brokerAgency } = await supabase
            .from("agencies")
            .select("id, name, logo, slug, seat_city, seat_address, email, phone, website, rating, specializations")
            .eq("id", agencyId)
            .single();
          if (brokerAgency) setAgency(brokerAgency);
        }

        if (agencyId) {
          const [brokersRes, branchesRes] = await Promise.all([
            supabase
              .from("brokers")
              .select("id, user_id, name, slug, photo, email, phone, specialization, active_listings, rating, branch_id")
              .eq("agency_id", agencyId)
              .order("name"),
            supabase
              .from("branches")
              .select("id, name, city, address, zip, phone, email, is_headquarters")
              .eq("agency_id", agencyId)
              .order("is_headquarters", { ascending: false }),
          ]);

          const bList = brokersRes.data ?? [];
          setBrokers(bList);
          setBranches(branchesRes.data ?? []);

          // Count brokers per branch
          const counts: Record<string, number> = {};
          for (const b of bList) {
            if (b.branch_id) counts[b.branch_id] = (counts[b.branch_id] || 0) + 1;
          }
          setBrokerCounts(counts);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">Moje struktura</h1>
        <p style={{ color: "var(--text-muted)" }}>Načítání...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Moje struktura</h1>

      {/* ── Kancelář ─────────────────────────────────────────────── */}
      {agency ? (
        <div className="struktura-agency-card">
          <div className="struktura-agency-header">
            <div className="struktura-agency-logo">
              {agency.logo ? (
                <img src={agency.logo} alt={agency.name} />
              ) : (
                <span>{agency.name.charAt(0)}</span>
              )}
            </div>
            <div className="struktura-agency-info">
              <h2>{agency.name}</h2>
              {agency.seat_city && (
                <p className="struktura-agency-location">
                  {[agency.seat_address, agency.seat_city].filter(Boolean).join(", ")}
                </p>
              )}
              {agency.rating != null && agency.rating > 0 && (
                <div className="struktura-rating">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z"/></svg>
                  {Number(agency.rating).toFixed(1)}
                </div>
              )}
            </div>
          </div>

          <div className="struktura-agency-details">
            {agency.phone && (
              <a href={`tel:${agency.phone}`} className="struktura-detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                {agency.phone}
              </a>
            )}
            {agency.email && (
              <a href={`mailto:${agency.email}`} className="struktura-detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {agency.email}
              </a>
            )}
            {agency.website && (
              <a href={agency.website.startsWith("http") ? agency.website : `https://${agency.website}`} target="_blank" rel="noopener noreferrer" className="struktura-detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                {agency.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          {agency.specializations && agency.specializations.length > 0 && (
            <div className="struktura-tags">
              {agency.specializations.map((s) => (
                <span key={s} className="struktura-tag">{s}</span>
              ))}
            </div>
          )}

          <div className="struktura-agency-stats">
            <div className="struktura-stat">
              <span className="struktura-stat-value">{brokers.length}</span>
              <span className="struktura-stat-label">Makléřů</span>
            </div>
            <div className="struktura-stat">
              <span className="struktura-stat-value">{branches.length}</span>
              <span className="struktura-stat-label">Poboček</span>
            </div>
            <div className="struktura-stat">
              <span className="struktura-stat-value">{brokers.reduce((s, b) => s + (b.active_listings || 0), 0)}</span>
              <span className="struktura-stat-label">Inzerátů</span>
            </div>
          </div>

          <div className="struktura-agency-actions">
            {agency.slug && (
              <Link href={`/kancelare/${agency.slug}`} className="struktura-btn struktura-btn--outline">
                Veřejný profil
              </Link>
            )}
            <Link href="/dashboard/nastaveni" className="struktura-btn struktura-btn--primary">
              Nastavení kanceláře
            </Link>
          </div>
        </div>
      ) : (
        <div className="struktura-empty">
          <p>Nejste přiřazeni k žádné kanceláři</p>
        </div>
      )}

      {/* ── Pobočky ──────────────────────────────────────────────── */}
      {branches.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 className="struktura-section-title">
            Pobočky
            <span className="struktura-count">{branches.length}</span>
          </h2>

          <div className="struktura-grid">
            {branches.map((branch) => (
              <div key={branch.id} className={`struktura-branch-card ${branch.is_headquarters ? "struktura-branch-card--hq" : ""}`}>
                <div className="struktura-branch-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h10M3 21H1M13 21h2m0 0h2m-2 0V10a2 2 0 012-2h4a2 2 0 012 2v11m0 0h1M7 7h2M7 11h2M7 15h2M15 13h2M15 17h2"/>
                  </svg>
                </div>
                <div className="struktura-branch-info">
                  <div className="struktura-branch-name">
                    {branch.name}
                    {branch.is_headquarters && <span className="struktura-hq-badge">Sídlo</span>}
                  </div>
                  <div className="struktura-branch-meta">
                    {[branch.address, branch.zip, branch.city].filter(Boolean).join(", ")}
                  </div>
                  <div className="struktura-branch-contacts">
                    {branch.phone && <span>{branch.phone}</span>}
                    {branch.email && <span>{branch.email}</span>}
                  </div>
                  <div className="struktura-branch-count">
                    {brokerCounts[branch.id] || 0} makléřů
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Makléři ──────────────────────────────────────────────── */}
      {agency && (
        <div style={{ marginTop: 32 }}>
          <h2 className="struktura-section-title">
            Makléři
            <span className="struktura-count">{brokers.length}</span>
          </h2>

          {brokers.length === 0 ? (
            <div className="struktura-empty"><p>V kanceláři nejsou žádní makléři</p></div>
          ) : (
            <div className="struktura-grid struktura-grid--brokers">
              {brokers.map((broker) => {
                const isMe = broker.user_id === user?.id;
                const branchName = branches.find((b) => b.id === broker.branch_id)?.name;
                return (
                  <div key={broker.id} className={`struktura-broker-card ${isMe ? "struktura-broker-card--me" : ""}`}>
                    {isMe && <span className="struktura-me-badge">Vy</span>}
                    <div className="struktura-broker-photo">
                      {broker.photo ? (
                        <img src={broker.photo} alt={broker.name} />
                      ) : (
                        <span>{broker.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="struktura-broker-name">{broker.name}</div>
                    {broker.rating != null && broker.rating > 0 && (
                      <div className="struktura-rating struktura-rating--sm">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z"/></svg>
                        {Number(broker.rating).toFixed(1)}
                      </div>
                    )}
                    {branchName && <div className="struktura-broker-branch">{branchName}</div>}
                    <div className="struktura-broker-contacts">
                      {broker.email && (
                        <a href={`mailto:${broker.email}`} title={broker.email}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </a>
                      )}
                      {broker.phone && (
                        <a href={`tel:${broker.phone}`} title={broker.phone}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                        </a>
                      )}
                    </div>
                    {broker.specialization && (
                      <div className="struktura-broker-spec">{broker.specialization}</div>
                    )}
                    <div className="struktura-broker-listings">
                      <span className="struktura-broker-listings-count">{broker.active_listings || 0}</span>
                      <span>inzerátů</span>
                    </div>
                    {broker.slug && (
                      <Link href={`/makleri/${broker.slug}`} className="struktura-broker-link">
                        Profil
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
