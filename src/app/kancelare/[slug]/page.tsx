import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getAgencyBySlug,
  getAgencyBrokers,
  getAgencyBranches,
  getAgencyReviews,
  getAgencyProperties,
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

type AgencyDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AgencyDetailPage({ params }: AgencyDetailPageProps) {
  const { slug } = await params;
  const agency = await getAgencyBySlug(slug);

  if (!agency) {
    notFound();
  }

  const agencyBrokers = await getAgencyBrokers(agency.id);
  const agencyBranches = await getAgencyBranches(agency.id);
  const reviewsList = await getAgencyReviews(agency.id);
  const agencyProperties = await getAgencyProperties(agency.id);
  const parentAgency = agency.parentAgencyId ? await getAgencyById(agency.parentAgencyId) : null;

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="detail-page">
        <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
          <Link href="/kancelare" className="detail-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Zpět na kanceláře
          </Link>

          <div className="agency-profile-header">
            <div className="agency-profile-logo">
              {agency.logo ? (
                <img src={agency.logo} alt={agency.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="agency-profile-name">{agency.name}</h1>
              <div className="agency-profile-meta">
                Založena {agency.foundedYear} &middot; {agency.totalBrokers} makléřů &middot; {agency.totalDeals} realizovaných obchodů
              </div>
              <div className="agency-profile-specs">
                {agency.specializations.map((spec) => (
                  <span key={spec} className="broker-profile-tag">{spec}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div>
              <div className="detail-section">
                <h2 className="detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  O kanceláři
                </h2>
                <p className="detail-description">{agency.description}</p>
              </div>

              {agencyBrokers.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Naši makléři
                    <span className="count-badge">{agencyBrokers.length}</span>
                  </h2>
                  <div className="profile-brokers-grid">
                    {agencyBrokers.map((broker) => (
                      <Link
                        key={broker.id}
                        href={`/makleri/${broker.slug}`}
                        className="broker-list-card"
                        style={{ textDecoration: "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <div className="broker-list-avatar">
                            {broker.photo ? (
                              <img src={broker.photo} alt={broker.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                            ) : (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="broker-list-name">{broker.name}</div>
                            <div className="broker-list-spec">{broker.specialization}</div>
                          </div>
                        </div>
                        <div className="broker-list-stats">
                          <div className="broker-stat">
                            <div className="broker-stat-value">{broker.activeListings}</div>
                            <div className="broker-stat-label">Nabídek</div>
                          </div>
                          <div className="broker-stat">
                            <div className="broker-stat-value">{broker.rating}</div>
                            <div className="broker-stat-label">Hodnocení</div>
                          </div>
                          <div className="broker-stat">
                            <div className="broker-stat-value">{broker.totalDeals}</div>
                            <div className="broker-stat-label">Obchodů</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {agencyProperties.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <path d="M9 22V12h6v10" />
                    </svg>
                    Aktivní nabídky
                    <span className="count-badge">{agencyProperties.length}</span>
                  </h2>
                  <div className="profile-properties-grid">
                    {agencyProperties.map((property) => (
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
                    <div className="broker-stat-value">{agency.totalDeals}</div>
                    <div className="broker-stat-label">Celkem obchodů</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{agency.totalListings}</div>
                    <div className="broker-stat-label">Aktivních nabídek</div>
                  </div>
                  <div className="broker-stat">
                    <div className="broker-stat-value">{agency.totalBrokers}</div>
                    <div className="broker-stat-label">Makléřů</div>
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
                    <div className="reviews-summary-rating">{agency.rating}</div>
                    <div>
                      <Stars rating={agency.rating} size={20} />
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
                <div className="broker-contact-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {agency.phone}
                </div>
                <div className="broker-contact-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  {agency.email}
                </div>
                {agency.website && (
                  <div className="broker-contact-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    {agency.website.replace(/^https?:\/\/www\./, "")}
                  </div>
                )}
              </div>

              {agencyBranches.length > 0 && (
                <div className="detail-sidebar-card">
                  <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    Pobočky
                  </h3>
                  <div className="branch-list">
                    {agencyBranches
                      .sort((a, b) => (b.isHeadquarters ? 1 : 0) - (a.isHeadquarters ? 1 : 0))
                      .map((branch) => (
                        <div key={branch.id} className="branch-item">
                          <div className="branch-name">
                            {branch.city}
                            {branch.isHeadquarters && <span className="branch-hq-badge">Hlavní kancelář</span>}
                          </div>
                          <div className="branch-address">{branch.address}</div>
                          <div className="branch-phone">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            {branch.phone}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {(agency.parentAgencyId || agency.isIndependent) && (
                <div className="detail-sidebar-card">
                  <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    Síť kanceláří
                  </h3>
                  {agency.isIndependent ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Samostatná pobočka pod značkou. Kancelář funguje nezávisle s vlastním vedením a obchodní strategií.
                    </p>
                  ) : parentAgency ? (
                    <div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                        Pobočka pod hlavní kanceláří:
                      </p>
                      <Link href={`/kancelare/${parentAgency.slug}`} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                        {parentAgency.name}
                      </Link>
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Součást mezinárodní sítě kanceláří.
                    </p>
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
