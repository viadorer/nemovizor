import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProfileTabs } from "@/components/profile-tabs";
import type { ProfileTab } from "@/components/profile-tabs";
import {
  getBrokerBySlug,
  getBrokerReviews,
  getAgencyById,
} from "@/lib/api";

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="reviews-summary-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

type BrokerDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BrokerDetailPage({ params }: BrokerDetailPageProps) {
  const { slug } = await params;
  const broker = await getBrokerBySlug(slug);

  if (!broker) {
    notFound();
  }

  const reviewsList = await getBrokerReviews(broker.id);
  const agency = await getAgencyById(broker.agencyId);

  // Build tabs (excluding "Nabidky" which is built-in to ProfileTabs)
  const tabs: ProfileTab[] = [];

  if (reviewsList.length > 0) {
    tabs.push({
      id: "hodnoceni",
      label: "Hodnoceni",
      count: reviewsList.length,
      content: (
        <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
          <div className="detail-section">
            <div className="reviews-summary">
              <div className="reviews-summary-rating">{broker.rating}</div>
              <div>
                <Stars rating={broker.rating} size={20} />
                <div className="reviews-summary-count">{reviewsList.length} hodnoceni</div>
              </div>
            </div>
            {reviewsList.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-card-header">
                  <span className="review-card-author">{review.authorName}</span>
                  <span className="review-card-date">
                    {new Date(review.date).toLocaleDateString("cs-CZ", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
                <div className="review-card-stars">
                  <Stars rating={review.rating} />
                </div>
                <div className="review-card-text">{review.text}</div>
                {review.propertyType && (
                  <div className="review-card-property">{review.propertyType}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (broker.bio) {
    tabs.push({
      id: "o-makleri",
      label: "O makleri",
      content: (
        <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
          <div className="detail-section">
            <h2 className="detail-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Medailonek
            </h2>
            <p className="detail-description">{broker.bio}</p>
          </div>
          {agency && (
            <div className="detail-section" style={{ marginTop: 24 }}>
              <Link href={`/kancelare/${agency.slug}`} style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
                <div className="agency-list-logo" style={{ width: 40, height: 40, marginBottom: 0, overflow: "hidden" }}>
                  {agency.logo ? (
                    <img src={agency.logo} alt={agency.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                    </svg>
                  )}
                </div>
                {agency.name}
              </Link>
            </div>
          )}
        </div>
      ),
    });
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="detail-page">
        {/* Compact profile header */}
        <div className="container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <Link href="/makleri" className="detail-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Zpet na maklere
          </Link>

          <div className="broker-profile-header">
            <div className="broker-profile-avatar">
              {broker.photo ? (
                <img src={broker.photo} alt={broker.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="broker-profile-name">{broker.name}</h1>
              <div className="broker-profile-meta">
                {agency && (
                  <Link href={`/kancelare/${agency.slug}`}>{agency.name}</Link>
                )}
                <span>{broker.specialization}</span>
                {broker.yearStarted && <span>Od roku {broker.yearStarted}</span>}
              </div>
              <div className="broker-profile-contact">
                {broker.phone && (
                  <a href={`tel:${broker.phone}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    {broker.phone}
                  </a>
                )}
                {broker.email && (
                  <a href={`mailto:${broker.email}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                    {broker.email}
                  </a>
                )}
              </div>
              <div className="broker-profile-tags">
                {broker.languages?.map((lang) => (
                  <span key={lang} className="broker-profile-tag">{lang}</span>
                ))}
                {broker.certifications?.map((cert) => (
                  <span key={cert} className="broker-profile-tag">{cert}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display: "flex", gap: 32, padding: "16px 0 0" }}>
            <div className="broker-stat">
              <div className="broker-stat-value">{broker.activeListings}</div>
              <div className="broker-stat-label">Aktivnich nabidek</div>
            </div>
            <div className="broker-stat">
              <div className="broker-stat-value">{broker.totalDeals}</div>
              <div className="broker-stat-label">Celkem obchodu</div>
            </div>
            <div className="broker-stat">
              <div className="broker-stat-value">{broker.rating}</div>
              <div className="broker-stat-label">Hodnoceni</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <ProfileTabs tabs={tabs} brokerId={broker.id} />
      </main>
      <SiteFooter />
    </div>
  );
}
