import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getBrokerBySlug,
  getBrokerProperties,
  getBrokerReviews,
  getAgencyById,
  getAgencyBranches,
} from "@/lib/api";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

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

  const properties = await getBrokerProperties(broker.id);
  const reviewsList = await getBrokerReviews(broker.id);
  const agency = await getAgencyById(broker.agencyId);
  const agencyBranches = agency ? await getAgencyBranches(agency.id) : [];
  const hqBranch = agencyBranches.find((b) => b.isHeadquarters);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="detail-page">
        <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
          <Link href="/makleri" className="detail-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Zpět na makléře
          </Link>

          <div className="broker-profile-header">
            <div className="broker-profile-avatar">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
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
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {broker.phone}
                </span>
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  {broker.email}
                </span>
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

          <div className="detail-grid">
            <div>
              <div className="detail-section">
                <h2 className="detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Medailónek
                </h2>
                <p className="detail-description">{broker.bio}</p>
              </div>

              {properties.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <path d="M9 22V12h6v10" />
                    </svg>
                    Aktivní nabídky
                    <span className="count-badge">{properties.length}</span>
                  </h2>
                  <div className="profile-properties-grid">
                    {properties.map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h2 className="detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                  Realizované obchody
                </h2>
                <div style={{ display: "flex", gap: 32, padding: "16px 0" }}>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{broker.totalDeals}</div>
                    <div className="broker-stat-label">Celkem obchodů</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{broker.activeListings}</div>
                    <div className="broker-stat-label">Aktivních nabídek</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{broker.rating}</div>
                    <div className="broker-stat-label">Hodnocení</div>
                  </div>
                </div>
              </div>

              {reviewsList.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Hodnocení
                    <span className="count-badge">{reviewsList.length}</span>
                  </h2>
                  <div className="reviews-summary">
                    <div className="reviews-summary-rating">{broker.rating}</div>
                    <div>
                      <Stars rating={broker.rating} size={20} />
                      <div className="reviews-summary-count">{reviewsList.length} hodnocení</div>
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
              )}
            </div>

            <aside>
              <div className="detail-sidebar-card">
                <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Kontakt
                </h3>
                <div style={{ marginBottom: 16 }}>
                  <button className="detail-cta-btn detail-cta-btn--primary">
                    Kontaktovat makléře
                  </button>
                </div>
                <div className="broker-contact-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {broker.phone}
                </div>
                <div className="broker-contact-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  {broker.email}
                </div>
              </div>

              {agency && (
                <div className="detail-sidebar-card">
                  <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    Kancelář
                  </h3>
                  <Link href={`/kancelare/${agency.slug}`} style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div className="agency-list-logo" style={{ width: 40, height: 40, marginBottom: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                      </svg>
                    </div>
                    {agency.name}
                  </Link>
                  {hqBranch && (
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      {hqBranch.address}
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
