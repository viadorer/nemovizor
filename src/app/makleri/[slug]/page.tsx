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

function SocialIcon({ type, url }: { type: string; url: string }) {
  const icons: Record<string, string> = {
    linkedin: "M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z",
    instagram: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
    facebook: "M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z",
    whatsapp: "M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z",
    twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  };
  const d = icons[type];
  if (!d) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="bp-social-icon" title={type}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>
    </a>
  );
}

function VideoEmbed({ url, type }: { url: string; type?: string }) {
  let embedUrl = url;
  if (type === "youtube" || url.includes("youtube.com") || url.includes("youtu.be")) {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
  } else if (type === "vimeo" || url.includes("vimeo.com")) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match) embedUrl = `https://player.vimeo.com/video/${match[1]}`;
  }
  return (
    <div className="bp-video-wrap">
      <iframe src={embedUrl} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
    </div>
  );
}

export default async function BrokerDetailPage({ params }: BrokerDetailPageProps) {
  const { slug } = await params;
  const broker = await getBrokerBySlug(slug);

  if (!broker) notFound();

  const [reviewsList, agency, agencyBranches, propertiesPage1] = await Promise.all([
    getBrokerReviews(broker.id),
    getAgencyById(broker.agencyId),
    broker.agencyId ? getAgencyBranches(broker.agencyId) : Promise.resolve([]),
    getBrokerPropertiesPaginated(broker.id, 1, 24),
  ]);

  const hqBranch = agencyBranches.find((b) => b.isHeadquarters) ?? agencyBranches[0] ?? null;
  const agencyAddress = hqBranch
    ? `${hqBranch.address}, ${hqBranch.city}`
    : agency ? [agency.seatAddress, agency.seatCity].filter(Boolean).join(", ") || "" : "";

  const yearsExp = broker.yearStarted ? new Date().getFullYear() - broker.yearStarted : 0;

  const hasSocials = broker.linkedin || broker.instagram || broker.facebook || broker.whatsapp || broker.twitter || broker.website;
  const hasAbout = broker.bioLong || broker.education || broker.licenseNumber || (broker.awards?.length ?? 0) > 0 || broker.hobbies || broker.funFact;
  const hasServiceAreas = (broker.serviceAreas?.length ?? 0) > 0 || (broker.specializations?.length ?? 0) > 0;
  const hasGallery = (broker.gallery?.length ?? 0) > 0;

  return (
    <div className="page-shell">
      <SiteHeader />
      <TrackPage event="broker_profile_view" props={{ broker_id: broker.id, broker_slug: broker.slug, broker_name: broker.name }} />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="broker-hero">
        <div className="broker-hero-text">
          {broker.title && <span className="bp-title">{broker.title}</span>}
          <span className="broker-hero-label">
            {broker.specialization || t.nav.brokers}
            {agencyAddress ? ` | ${agencyAddress}` : ""}
          </span>
          <h1 className="broker-hero-name">{broker.name}</h1>
          {broker.motto && <p className="bp-motto">{broker.motto}</p>}

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
                <span className="broker-hero-stat-label"><Stars rating={broker.rating} size={12} /></span>
              </div>
            )}
            {broker.avgResponseTimeHours && broker.avgResponseTimeHours > 0 && (
              <div className="broker-hero-stat">
                <span className="broker-hero-stat-value">{broker.avgResponseTimeHours < 1 ? `${Math.round(broker.avgResponseTimeHours * 60)}min` : `${broker.avgResponseTimeHours}h`}</span>
                <span className="broker-hero-stat-label">odpověď</span>
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
            {broker.calendlyUrl && (
              <a href={broker.calendlyUrl} target="_blank" rel="noopener" className="broker-hero-btn broker-hero-btn--secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                Rezervovat schůzku
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

          {/* Social icons */}
          {hasSocials && (
            <div className="bp-socials">
              {broker.linkedin && <SocialIcon type="linkedin" url={broker.linkedin} />}
              {broker.instagram && <SocialIcon type="instagram" url={broker.instagram} />}
              {broker.facebook && <SocialIcon type="facebook" url={broker.facebook} />}
              {broker.twitter && <SocialIcon type="twitter" url={broker.twitter} />}
              {broker.whatsapp && <SocialIcon type="whatsapp" url={`https://wa.me/${broker.whatsapp.replace(/\D/g, "")}`} />}
              {broker.website && (
                <a href={broker.website} target="_blank" rel="noopener" className="bp-social-icon" title="Web">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                </a>
              )}
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

      <main className="broker-detail-content">

        {/* ── Video greeting ────────────────────────────────────── */}
        {broker.videoUrl && (
          <section className="bp-section">
            <h2 className="broker-section-title">Video představení</h2>
            <VideoEmbed url={broker.videoUrl} type={broker.videoType} />
          </section>
        )}

        {/* ── About / Bio ──────────────────────────────────────── */}
        {hasAbout && (
          <section className="bp-section">
            <h2 className="broker-section-title">O mně</h2>
            <div className="bp-about-grid">
              {broker.bioLong && (
                <div className="bp-about-text">
                  <p>{broker.bioLong}</p>
                </div>
              )}
              <div className="bp-about-details">
                {broker.education && (
                  <div className="bp-detail-row">
                    <span className="bp-detail-label">Vzdělání</span>
                    <span className="bp-detail-value">{broker.education}</span>
                  </div>
                )}
                {broker.licenseNumber && (
                  <div className="bp-detail-row">
                    <span className="bp-detail-label">Licence</span>
                    <span className="bp-detail-value">{broker.licenseNumber}</span>
                  </div>
                )}
                {(broker.awards?.length ?? 0) > 0 && (
                  <div className="bp-detail-row">
                    <span className="bp-detail-label">Ocenění</span>
                    <div className="bp-awards">
                      {broker.awards!.map((a, i) => (
                        <span key={i} className="bp-award">{a.name}{a.year ? ` (${a.year})` : ""}</span>
                      ))}
                    </div>
                  </div>
                )}
                {broker.hobbies && (
                  <div className="bp-detail-row">
                    <span className="bp-detail-label">Koníčky</span>
                    <span className="bp-detail-value">{broker.hobbies}</span>
                  </div>
                )}
                {broker.funFact && (
                  <div className="bp-detail-row">
                    <span className="bp-detail-label">Fun fact</span>
                    <span className="bp-detail-value">{broker.funFact}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Service areas & specializations ──────────────────── */}
        {hasServiceAreas && (
          <section className="bp-section">
            <h2 className="broker-section-title">Oblast působení</h2>
            <div className="bp-chips-wrap">
              {broker.serviceAreas?.map((sa, i) => (
                <span key={i} className="bp-chip">{sa.district ? `${sa.district}, ` : ""}{sa.city}{sa.country ? ` (${sa.country.toUpperCase()})` : ""}</span>
              ))}
              {broker.specializations?.map((s, i) => (
                <span key={`sp-${i}`} className="bp-chip bp-chip--accent">{s}</span>
              ))}
              {broker.propertyTypes?.map((pt, i) => (
                <span key={`pt-${i}`} className="bp-chip">{pt}</span>
              ))}
            </div>
            {broker.priceRangeMin && broker.priceRangeMax ? (
              <p className="bp-price-range">Cenový rozsah: {broker.priceRangeMin.toLocaleString("cs")} – {broker.priceRangeMax.toLocaleString("cs")} Kč</p>
            ) : null}
          </section>
        )}

        {/* ── Gallery ──────────────────────────────────────────── */}
        {hasGallery && (
          <section className="bp-section">
            <h2 className="broker-section-title">Galerie</h2>
            <div className="bp-gallery">
              {broker.gallery!.map((img, i) => (
                <div key={i} className="bp-gallery-item">
                  <img src={img} alt={`${broker.name} galerie ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Listings ─────────────────────────────────────────── */}
        <section className="bp-section">
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

        {/* ── Reviews ──────────────────────────────────────────── */}
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
