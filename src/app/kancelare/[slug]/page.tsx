import { t } from "@/i18n";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DetailPropertiesGrid } from "@/components/detail-properties-grid";
import { TrackPage } from "@/components/track-page";
import Link from "next/link";
import type { Broker, Branch, Review } from "@/lib/types";
import {
  getAgencyBySlug,
  getAgencyBrokers,
  getAgencyBranches,
  getAgencyReviews,
  getAgencyById,
  getAgencyPropertiesPaginated,
} from "@/lib/api";

type AgencyDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="agent-stars" style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? "var(--color-accent)" : "none"} stroke="var(--color-accent)" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function BrokerMiniCard({ broker }: { broker: Broker }) {
  return (
    <Link href={`/makleri/${broker.slug}`} className="agency-broker-card">
      <div className="agency-broker-card-portrait">
        {broker.photo ? (
          <img src={broker.photo} alt={broker.name} />
        ) : (
          <div className="agency-broker-card-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
        )}
        <div className="agency-broker-card-overlay" />
        <div className="agency-broker-card-info">
          {broker.rating > 0 && (
            <div className="agency-broker-card-rating">
              <Stars rating={broker.rating} size={10} />
              <span>{broker.rating}</span>
            </div>
          )}
          <h3 className="agency-broker-card-name">{broker.name}</h3>
          <p className="agency-broker-card-spec">{broker.specialization || `${broker.activeListings} nabídek`}</p>
        </div>
      </div>
    </Link>
  );
}

function BranchCard({ branch }: { branch: Branch }) {
  return (
    <div className="agency-branch-card">
      <div className="agency-branch-card-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M12 11h.01M12 15h.01M18 11h.01M18 15h.01M6 7V3h12v4" />
        </svg>
      </div>
      <div className="agency-branch-card-content">
        <h3 className="agency-branch-card-name">
          {branch.name}
          {branch.isHeadquarters && <span className="agency-branch-badge">HQ</span>}
        </h3>
        <p className="agency-branch-card-address">{branch.address}, {branch.city}</p>
        <div className="agency-branch-card-contacts">
          {branch.phone && <span>{branch.phone}</span>}
          {branch.email && <span>{branch.email}</span>}
        </div>
      </div>
    </div>
  );
}

export default async function AgencyDetailPage({ params }: AgencyDetailPageProps) {
  const { slug } = await params;
  const agency = await getAgencyBySlug(slug);

  if (!agency) {
    notFound();
  }

  const [agencyBrokers, agencyBranches, reviewsList, parentAgency, propertiesPage1] = await Promise.all([
    getAgencyBrokers(agency.id),
    getAgencyBranches(agency.id),
    getAgencyReviews(agency.id),
    agency.parentAgencyId ? getAgencyById(agency.parentAgencyId) : Promise.resolve(null),
    getAgencyPropertiesPaginated(agency.id, 1, 24),
  ]);

  const hqBranch = agencyBranches.find((b) => b.isHeadquarters) ?? agencyBranches[0] ?? null;
  const agencyAddress = hqBranch
    ? `${hqBranch.address}, ${hqBranch.city}`
    : [agency.seatAddress, agency.seatCity].filter(Boolean).join(", ") || "";

  return (
    <div className="page-shell">
      <SiteHeader />
      <TrackPage event="agency_profile_view" props={{ agency_id: agency.id, agency_slug: agency.slug, agency_name: agency.name }} />

      {/* ── Hero — full grid width, horizontal layout ─────────── */}
      <section className="agency-hero-wide">
        <div className="agency-hero-left">
          <div className="agency-hero-identity">
            {agency.logo ? (
              <img src={agency.logo} alt={agency.name} className="agency-hero-logo" />
            ) : (
              <div className="agency-hero-logo-placeholder">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M12 11h.01M12 15h.01M18 11h.01M18 15h.01M6 7V3h12v4" /></svg>
              </div>
            )}
            <div>
              <h1 className="agency-hero-name">{agency.name}</h1>
              {agencyAddress && (
                <span className="agency-hero-address">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {agencyAddress}
                </span>
              )}
            </div>
          </div>
          {agency.description && <p className="agency-hero-desc">{agency.description}</p>}
          <div className="agency-hero-contacts">
            {agency.phone && (
              <a href={`tel:${agency.phone}`} className="broker-hero-btn broker-hero-btn--primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                {agency.phone}
              </a>
            )}
            {agency.email && (
              <a href={`mailto:${agency.email}`} className="broker-hero-btn broker-hero-btn--secondary">Kontakt</a>
            )}
            {agency.website && (
              <a href={agency.website} target="_blank" rel="noopener" className="broker-hero-btn broker-hero-btn--secondary">Web</a>
            )}
          </div>
          {parentAgency && (
            <div className="agency-parent-link">
              Součást sítě: <Link href={`/kancelare/${parentAgency.slug}`}>{parentAgency.name}</Link>
            </div>
          )}
        </div>
        <div className="agency-hero-right">
          <div className="agency-hero-stats">
            <div className="agency-hero-stat">
              <span className="agency-hero-stat-value">{propertiesPage1.total.toLocaleString("cs")}</span>
              <span className="agency-hero-stat-label">{t.profile.activeListings}</span>
            </div>
            <div className="agency-hero-stat">
              <span className="agency-hero-stat-value">{agencyBrokers.length}</span>
              <span className="agency-hero-stat-label">{t.nav.brokers}</span>
            </div>
            {agencyBranches.length > 0 && (
              <div className="agency-hero-stat">
                <span className="agency-hero-stat-value">{agencyBranches.length}</span>
                <span className="agency-hero-stat-label">{t.profile.branches}</span>
              </div>
            )}
            {agency.rating > 0 && (
              <div className="agency-hero-stat">
                <span className="agency-hero-stat-value">{agency.rating}</span>
                <span className="agency-hero-stat-label"><Stars rating={agency.rating} size={14} /></span>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="broker-detail-content">
        {/* ── Branches ──────────────────────────────────────── */}
        {agencyBranches.length > 0 && (
          <section>
            <h2 className="broker-section-title">
              {t.profile.branches}
              <span className="broker-section-count">{agencyBranches.length}</span>
            </h2>
            <div className="agency-branches-grid">
              {agencyBranches.map((branch) => <BranchCard key={branch.id} branch={branch} />)}
            </div>
          </section>
        )}

        {/* ── Team ──────────────────────────────────────────── */}
        {agencyBrokers.length > 0 && (
          <section style={{ marginTop: 64 }}>
            <h2 className="broker-section-title">
              {t.nav.brokers}
              <span className="broker-section-count">{agencyBrokers.length}</span>
            </h2>
            <div className="agency-brokers-grid">
              {agencyBrokers.map((broker) => <BrokerMiniCard key={broker.id} broker={broker} />)}
            </div>
          </section>
        )}

        {/* ── Listings ──────────────────────────────────────── */}
        <section style={{ marginTop: 64 }}>
          <h2 className="broker-section-title">
            {t.nav.listings}
            <span className="broker-section-count">{propertiesPage1.total}</span>
          </h2>
          <DetailPropertiesGrid
            agencyId={agency.id}
            initialItems={propertiesPage1.items}
            initialTotal={propertiesPage1.total}
          />
        </section>

        {/* ── Reviews ───────────────────────────────────────── */}
        {reviewsList.length > 0 && (
          <section className="broker-reviews-section">
            <h2 className="broker-section-title">
              {t.profile.reviews}
              <span className="broker-section-count">{reviewsList.length}</span>
            </h2>
            <div className="broker-reviews-summary">
              <span className="broker-reviews-avg">{agency.rating}</span>
              <Stars rating={agency.rating} size={18} />
              <span className="broker-reviews-total">({reviewsList.length})</span>
            </div>
            <div className="broker-reviews-grid">
              {reviewsList.map((r: Review) => (
                <div key={r.id} className="broker-review-card">
                  <div className="broker-review-header">
                    <span className="broker-review-author">{r.authorName}</span>
                    <Stars rating={r.rating} size={12} />
                  </div>
                  <p className="broker-review-text">{r.text}</p>
                  <span className="broker-review-date">
                    {new Date(r.date).toLocaleDateString("cs-CZ", { year: "numeric", month: "long" })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
