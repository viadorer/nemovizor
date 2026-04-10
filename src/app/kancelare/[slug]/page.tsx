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

/* ── Helpers ────────────────────────────────────────────────────────────── */

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? "var(--color-accent, #ffb800)" : "none"} stroke="var(--color-accent, #ffb800)" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
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
          <p className="agency-broker-card-spec">{broker.specialization || `${broker.activeListings} nabidek`}</p>
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
        <p className="agency-branch-card-address">{branch.address}{branch.city ? `, ${branch.city}` : ""}</p>
        <div className="agency-branch-card-contacts">
          {branch.phone && <span>{branch.phone}</span>}
          {branch.email && <span>{branch.email}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────────────────── */

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="ad-section">{children}</section>;
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="ad-section-title">
      {children}
      {count !== undefined && count > 0 && <span className="ad-section-count">{count}</span>}
    </h2>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default async function AgencyDetailPage({ params }: AgencyDetailPageProps) {
  const { slug } = await params;
  const agency = await getAgencyBySlug(slug);
  if (!agency) notFound();

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

  const hasSocials = agency.linkedin || agency.instagram || agency.facebook || agency.whatsapp || agency.twitter;
  const hasAbout = agency.descriptionLong || agency.description || agency.mission || agency.valuesText || (agency.awards?.length ?? 0) > 0 || (agency.agencyCertifications?.length ?? 0) > 0;
  const hasGallery = (agency.gallery?.length ?? 0) > 0;
  const hasServiceAreas = (agency.serviceAreas?.length ?? 0) > 0 || (agency.serviceCountries?.length ?? 0) > 0 || (agency.specializations?.length ?? 0) > 0;
  const hasPerformance = (agency.totalSalesVolume && agency.totalSalesVolume > 0) || (agency.avgResponseTimeHours && agency.avgResponseTimeHours > 0) || (agency.propertiesSoldCount && agency.propertiesSoldCount > 0);
  const hasAboutTab = hasAbout || hasGallery || hasServiceAreas || agency.videoUrl || hasPerformance;

  // Build tab list dynamically
  const tabs: Array<{ id: string; label: string; count?: number }> = [];
  if (hasAboutTab) tabs.push({ id: "o-nas", label: "O nas" });
  if (agencyBrokers.length > 0) tabs.push({ id: "tym", label: "Tym", count: agencyBrokers.length });
  if (agencyBranches.length > 0) tabs.push({ id: "pobocky", label: t.profile.branches, count: agencyBranches.length });
  if (propertiesPage1.total > 0) tabs.push({ id: "nabidky", label: t.nav.listings, count: propertiesPage1.total });
  if (reviewsList.length > 0) tabs.push({ id: "recenze", label: t.profile.reviews, count: reviewsList.length });

  return (
    <div className="page-shell">
      <SiteHeader />
      <TrackPage event="agency_profile_view" props={{ agency_id: agency.id, agency_slug: agency.slug, agency_name: agency.name }} />

      {/* ── Hero (two-column) ────────────────────────────────── */}
      <div className="ad-hero2" style={agency.coverPhoto ? { backgroundImage: `url(${agency.coverPhoto})` } : undefined}>
        <div className="ad-hero2-overlay" />
        <div className="ad-hero2-inner">
          {/* Left: Identity */}
          <div className="ad-hero2-left">
            <div className="ad-hero2-logo-wrap">
              {agency.logo ? (
                <img src={agency.logo} alt={agency.name} className="ad-hero2-logo" />
              ) : (
                <div className="ad-hero2-logo ad-hero2-logo--placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M12 11h.01M12 15h.01M18 11h.01M18 15h.01M6 7V3h12v4" /></svg>
                </div>
              )}
            </div>
            <h1 className="ad-hero2-name">{agency.name}</h1>
            {agency.motto && <p className="ad-hero2-motto">{agency.motto}</p>}
            {agencyAddress && (
              <span className="ad-hero2-address">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {agencyAddress}
              </span>
            )}
            {agency.description && <p className="ad-hero2-desc">{agency.description}</p>}

            <div className="ad-hero2-actions">
              {agency.phone && (
                <a href={`tel:${agency.phone}`} className="ad-btn ad-btn--primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  {agency.phone}
                </a>
              )}
              {agency.email && <a href={`mailto:${agency.email}`} className="ad-btn ad-btn--secondary">Kontakt</a>}
              {agency.website && <a href={agency.website} target="_blank" rel="noopener" className="ad-btn ad-btn--secondary">Web</a>}
              {agency.calendlyUrl && <a href={agency.calendlyUrl} target="_blank" rel="noopener" className="ad-btn ad-btn--secondary">Rezervovat schuzku</a>}
            </div>

            {hasSocials && (
              <div className="bp-socials" style={{ marginTop: 8 }}>
                {agency.linkedin && <SocialIcon type="linkedin" url={agency.linkedin} />}
                {agency.instagram && <SocialIcon type="instagram" url={agency.instagram} />}
                {agency.facebook && <SocialIcon type="facebook" url={agency.facebook} />}
                {agency.twitter && <SocialIcon type="twitter" url={agency.twitter} />}
                {agency.whatsapp && <SocialIcon type="whatsapp" url={`https://wa.me/${agency.whatsapp.replace(/\D/g, "")}`} />}
              </div>
            )}

            {parentAgency && (
              <div className="ad-hero-parent" style={{ marginTop: 8 }}>
                Soucast site: <Link href={`/kancelare/${parentAgency.slug}`}>{parentAgency.name}</Link>
              </div>
            )}
          </div>

          {/* Right: Stats cards */}
          <div className="ad-hero2-right">
            <div className="ad-stats-grid">
              {propertiesPage1.total > 0 && (
                <div className="ad-stat-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  <span className="ad-stat-card-value">{propertiesPage1.total.toLocaleString("cs")}</span>
                  <span className="ad-stat-card-label">{t.profile.activeListings}</span>
                </div>
              )}
              {agencyBrokers.length > 0 && (
                <div className="ad-stat-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  <span className="ad-stat-card-value">{agencyBrokers.length}</span>
                  <span className="ad-stat-card-label">{t.nav.brokers}</span>
                </div>
              )}
              {agency.foundedYear > 0 && (
                <div className="ad-stat-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span className="ad-stat-card-value">{agency.foundedYear}</span>
                  <span className="ad-stat-card-label">Zalozeno</span>
                </div>
              )}
              {agency.rating > 0 && (
                <div className="ad-stat-card">
                  <Stars rating={agency.rating} size={16} />
                  <span className="ad-stat-card-value">{agency.rating}</span>
                  <span className="ad-stat-card-label">Hodnoceni</span>
                </div>
              )}
              {agencyBranches.length > 0 && (
                <div className="ad-stat-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span className="ad-stat-card-value">{agencyBranches.length}</span>
                  <span className="ad-stat-card-label">{t.profile.branches}</span>
                </div>
              )}
              {agency.propertiesSoldCount && agency.propertiesSoldCount > 0 && (
                <div className="ad-stat-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  <span className="ad-stat-card-value">{agency.propertiesSoldCount.toLocaleString("cs")}</span>
                  <span className="ad-stat-card-label">Prodano</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab navigation (sticky) ───────────────────────────── */}
      {tabs.length > 1 && (
        <nav className="ad-tabs">
          <div className="ad-tabs-inner">
            {tabs.map((tab) => (
              <a key={tab.id} href={`#${tab.id}`} className="ad-tab">
                {tab.label}
                {tab.count !== undefined && <span className="ad-tab-count">{tab.count}</span>}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* ── Content ────────────────────────────────────────────── */}
      <main className="ad-content">

        {/* O nas */}
        {hasAboutTab && (
          <Section id="o-nas">
            <SectionTitle>O nas</SectionTitle>

            {/* Video */}
            {agency.videoUrl && (
              <div style={{ marginBottom: 32 }}>
                <VideoEmbed url={agency.videoUrl} type={agency.videoType} />
              </div>
            )}

            {/* Text content */}
            {hasAbout && (
              <div className="ad-about-grid">
                <div className="ad-about-text">
                  {(agency.descriptionLong || agency.description) && (
                    <p>{agency.descriptionLong || agency.description}</p>
                  )}
                  {agency.mission && (
                    <div style={{ marginTop: 20 }}>
                      <span className="ad-label">Mise</span>
                      <p style={{ marginTop: 6 }}>{agency.mission}</p>
                    </div>
                  )}
                  {agency.valuesText && (
                    <div style={{ marginTop: 20 }}>
                      <span className="ad-label">Hodnoty</span>
                      <p style={{ marginTop: 6 }}>{agency.valuesText}</p>
                    </div>
                  )}
                </div>
                <div className="ad-about-sidebar">
                  {(agency.awards?.length ?? 0) > 0 && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Oceneni</span>
                      <div className="ad-awards">
                        {agency.awards!.map((a, i) => (
                          <div key={i} className="ad-award">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>
                            <span>{a.name}{a.year ? ` (${a.year})` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(agency.agencyCertifications?.length ?? 0) > 0 && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Certifikace</span>
                      <div className="bp-chips-wrap">
                        {agency.agencyCertifications!.map((c, i) => (
                          <span key={i} className="bp-chip bp-chip--accent">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasPerformance && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Vykon</span>
                      <div className="ad-performance">
                        {agency.totalSalesVolume && agency.totalSalesVolume > 0 && (
                          <div className="ad-perf-row">
                            <span className="ad-perf-value">{agency.totalSalesVolume.toLocaleString("cs")} Kc</span>
                            <span className="ad-perf-label">Objem prodeju</span>
                          </div>
                        )}
                        {agency.propertiesSoldCount && agency.propertiesSoldCount > 0 && (
                          <div className="ad-perf-row">
                            <span className="ad-perf-value">{agency.propertiesSoldCount.toLocaleString("cs")}</span>
                            <span className="ad-perf-label">Prodanych nemovitosti</span>
                          </div>
                        )}
                        {agency.avgResponseTimeHours && agency.avgResponseTimeHours > 0 && (
                          <div className="ad-perf-row">
                            <span className="ad-perf-value">{agency.avgResponseTimeHours}h</span>
                            <span className="ad-perf-label">Prumerna odezva</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service areas */}
            {hasServiceAreas && (
              <div style={{ marginTop: 32 }}>
                <span className="ad-label" style={{ marginBottom: 10, display: "block" }}>Oblast pusobeni</span>
                <div className="bp-chips-wrap">
                  {agency.serviceCountries?.map((c, i) => (
                    <span key={`c-${i}`} className="bp-chip bp-chip--accent">{c.toUpperCase()}</span>
                  ))}
                  {agency.serviceAreas?.map((sa, i) => (
                    <span key={i} className="bp-chip">{sa.district ? `${sa.district}, ` : ""}{sa.city}{sa.country ? ` (${sa.country.toUpperCase()})` : ""}</span>
                  ))}
                  {agency.specializations?.map((s, i) => (
                    <span key={`sp-${i}`} className="bp-chip">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery */}
            {hasGallery && (
              <div style={{ marginTop: 32 }}>
                <span className="ad-label" style={{ marginBottom: 10, display: "block" }}>Galerie</span>
                <div className="bp-gallery">
                  {agency.gallery!.map((img, i) => (
                    <div key={i} className="bp-gallery-item">
                      <img src={img} alt={`${agency.name} galerie ${i + 1}`} loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Tym */}
        {agencyBrokers.length > 0 && (
          <Section id="tym">
            <SectionTitle count={agencyBrokers.length}>Tym</SectionTitle>
            <div className="agency-brokers-grid">
              {agencyBrokers.map((broker) => <BrokerMiniCard key={broker.id} broker={broker} />)}
            </div>
          </Section>
        )}

        {/* Pobocky */}
        {agencyBranches.length > 0 && (
          <Section id="pobocky">
            <SectionTitle count={agencyBranches.length}>{t.profile.branches}</SectionTitle>
            <div className="agency-branches-grid">
              {agencyBranches.map((branch) => <BranchCard key={branch.id} branch={branch} />)}
            </div>
          </Section>
        )}

        {/* Nabidky */}
        {propertiesPage1.total > 0 && (
          <Section id="nabidky">
            <SectionTitle count={propertiesPage1.total}>{t.nav.listings}</SectionTitle>
            <DetailPropertiesGrid
              agencyId={agency.id}
              initialItems={propertiesPage1.items}
              initialTotal={propertiesPage1.total}
            />
          </Section>
        )}

        {/* Recenze */}
        {reviewsList.length > 0 && (
          <Section id="recenze">
            <SectionTitle count={reviewsList.length}>{t.profile.reviews}</SectionTitle>
            <div className="ad-reviews-summary">
              <span className="ad-reviews-avg">{agency.rating}</span>
              <Stars rating={agency.rating} size={20} />
              <span className="ad-reviews-total">({reviewsList.length} hodnoceni)</span>
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
          </Section>
        )}

        {/* CTA */}
        {agency.ctaText && agency.ctaUrl && (
          <section className="ad-cta">
            <a href={agency.ctaUrl} target="_blank" rel="noopener" className="ad-btn ad-btn--primary ad-btn--large">
              {agency.ctaText}
            </a>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
