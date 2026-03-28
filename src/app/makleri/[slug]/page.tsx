import { t } from "@/i18n";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DetailPropertiesGrid } from "@/components/detail-properties-grid";
import { TrackPage } from "@/components/track-page";
import Link from "next/link";
import {
  getBrokerBySlug,
  getBrokerReviews,
  getAgencyById,
  getAgencyBranches,
  getBrokerPropertiesPaginated,
} from "@/lib/api";
import type { Review } from "@/lib/types";

type BrokerDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
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

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="broker-review-card">
      <div className="broker-review-header">
        <span className="broker-review-author">{review.authorName}</span>
        <Stars rating={review.rating} size={12} />
      </div>
      <p className="broker-review-text">{review.text}</p>
      <span className="broker-review-date">
        {new Date(review.date).toLocaleDateString("cs-CZ", { year: "numeric", month: "long" })}
      </span>
    </div>
  );
}

export default async function BrokerDetailPage({ params }: BrokerDetailPageProps) {
  const { slug } = await params;
  const broker = await getBrokerBySlug(slug);

  if (!broker) {
    notFound();
  }

  const [reviewsList, agency, agencyBranches, propertiesPage1] = await Promise.all([
    getBrokerReviews(broker.id),
    getAgencyById(broker.agencyId),
    broker.agencyId ? getAgencyBranches(broker.agencyId) : Promise.resolve([]),
    getBrokerPropertiesPaginated(broker.id, 1, 24),
  ]);

  const hqBranch = agencyBranches.find((b) => b.isHeadquarters) ?? agencyBranches[0] ?? null;
  const agencyAddress = hqBranch
    ? `${hqBranch.address}, ${hqBranch.city}`
    : agency
      ? [agency.seatAddress, agency.seatCity].filter(Boolean).join(", ") || ""
      : "";

  const yearsExp = broker.yearStarted ? new Date().getFullYear() - broker.yearStarted : 0;

  return (
    <div className="page-shell">
      <SiteHeader />
      <TrackPage event="broker_profile_view" props={{ broker_id: broker.id, broker_slug: broker.slug, broker_name: broker.name }} />

      {/* ── Premium Hero ───────────────────────────────────────── */}
      <section className="broker-hero">
        <div className="broker-hero-text">
          <span className="broker-hero-label">
            {broker.specialization || t.nav.brokers}
            {agencyAddress ? ` | ${agencyAddress}` : ""}
          </span>
          <h1 className="broker-hero-name">{broker.name}</h1>

          <div className="broker-hero-stats">
            <div className="broker-hero-stat">
              <span className="broker-hero-stat-value">{broker.activeListings.toLocaleString("cs")}</span>
              <span className="broker-hero-stat-label">{t.profile.activeListings}</span>
            </div>
            {broker.totalDeals > 0 && (
              <div className="broker-hero-stat">
                <span className="broker-hero-stat-value">{broker.totalDeals}+</span>
                <span className="broker-hero-stat-label">{t.profile.totalDeals}</span>
              </div>
            )}
            {yearsExp > 0 && (
              <div className="broker-hero-stat">
                <span className="broker-hero-stat-value">{yearsExp}</span>
                <span className="broker-hero-stat-label">let praxe</span>
              </div>
            )}
            {broker.rating > 0 && (
              <div className="broker-hero-stat">
                <span className="broker-hero-stat-value">{broker.rating}</span>
                <span className="broker-hero-stat-label">
                  <Stars rating={broker.rating} size={12} />
                </span>
              </div>
            )}
          </div>

          <div className="broker-hero-actions">
            {broker.email && (
              <a href={`mailto:${broker.email}`} className="broker-hero-btn broker-hero-btn--primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M22 6l-10 7L2 6" /></svg>
                Kontaktovat
              </a>
            )}
            {broker.phone && (
              <a href={`tel:${broker.phone}`} className="broker-hero-btn broker-hero-btn--secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                {broker.phone}
              </a>
            )}
          </div>

          {/* Tags */}
          {((broker.languages?.length ?? 0) > 0 || (broker.certifications?.length ?? 0) > 0) && (
            <div className="broker-hero-tags">
              {broker.languages?.map((l) => <span key={l} className="broker-hero-tag">{l}</span>)}
              {broker.certifications?.map((c) => <span key={c} className="broker-hero-tag broker-hero-tag--cert">{c}</span>)}
            </div>
          )}
        </div>

        {/* Portrait */}
        <div className="broker-hero-portrait">
          {broker.photo ? (
            <img src={broker.photo} alt={broker.name} />
          ) : (
            <div className="broker-hero-portrait-placeholder">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </div>
          )}
          {broker.bio && (
            <div className="broker-hero-quote">
              <p>{broker.bio.slice(0, 180)}{broker.bio.length > 180 ? "..." : ""}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Agency link ────────────────────────────────────────── */}
      {agency && (
        <div className="broker-agency-bar">
          <Link href={`/kancelare/${agency.slug}`} className="broker-agency-link">
            {agency.logo && <img src={agency.logo} alt={agency.name} className="broker-agency-logo" />}
            <span>{agency.name}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
          </Link>
        </div>
      )}

      {/* ── Tabs: Listings / Reviews / About ───────────────────── */}
      <main className="broker-detail-content">
        {/* Listings tab */}
        <section>
          <h2 className="broker-section-title">
            {t.nav.listings}
            <span className="broker-section-count">{propertiesPage1.total}</span>
          </h2>
          <DetailPropertiesGrid
            brokerId={broker.id}
            initialItems={propertiesPage1.items}
            initialTotal={propertiesPage1.total}
          />
        </section>

        {/* Reviews */}
        {reviewsList.length > 0 && (
          <section className="broker-reviews-section">
            <h2 className="broker-section-title">
              {t.profile.reviews}
              <span className="broker-section-count">{reviewsList.length}</span>
            </h2>
            <div className="broker-reviews-summary">
              <span className="broker-reviews-avg">{broker.rating}</span>
              <Stars rating={broker.rating} size={18} />
              <span className="broker-reviews-total">({reviewsList.length} hodnocení)</span>
            </div>
            <div className="broker-reviews-grid">
              {reviewsList.map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
