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

/* ── Helpers ────────────────────────────────────────────────────────────── */

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
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
  const hasAbout = broker.bioLong || broker.bio || broker.education || broker.licenseNumber || (broker.awards?.length ?? 0) > 0 || broker.hobbies || broker.funFact;
  const hasServiceAreas = (broker.serviceAreas?.length ?? 0) > 0 || (broker.specializations?.length ?? 0) > 0 || (broker.propertyTypes?.length ?? 0) > 0;
  const galleryImages = (broker.gallery ?? []).filter((u) => u && u.startsWith("http"));
  const hasGallery = galleryImages.length > 0;
  const hasPerformance = (broker.totalSalesVolume && broker.totalSalesVolume > 0) || (broker.responseRatePct && broker.responseRatePct > 0);
  const hasAboutTab = hasAbout || hasServiceAreas || hasGallery || broker.videoUrl || hasPerformance;

  // Tabs: O mne → Nabidky → Recenze
  const tabs: Array<{ id: string; label: string; count?: number }> = [];
  if (hasAboutTab) tabs.push({ id: "o-mne", label: "O mne" });
  if (propertiesPage1.total > 0) tabs.push({ id: "nabidky", label: t.nav.listings, count: propertiesPage1.total });
  if (reviewsList.length > 0) tabs.push({ id: "recenze", label: t.profile.reviews, count: reviewsList.length });

  return (
    <div className="page-shell">
      <SiteHeader />
      <TrackPage event="broker_profile_view" props={{ broker_id: broker.id, broker_slug: broker.slug, broker_name: broker.name }} />

      {/* ── Hero (two-column: left info, right portrait) ─────── */}
      <div className="ad-hero2" style={broker.coverPhoto ? { backgroundImage: `url(${broker.coverPhoto})` } : undefined}>
        <div className="ad-hero2-overlay" />
        <div className="ad-hero2-inner">
          {/* Left: Identity */}
          <div className="ad-hero2-left">
            {broker.title && <span className="bd-title">{broker.title}</span>}
            <h1 className="ad-hero2-name">{broker.name}</h1>
            {broker.motto && <p className="ad-hero2-motto">{broker.motto}</p>}
            <span className="ad-hero2-address">
              {broker.specialization && <>{broker.specialization}</>}
              {broker.specialization && agencyAddress && <> | </>}
              {agencyAddress && (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {agencyAddress}
                </>
              )}
            </span>

            {broker.bio && <p className="ad-hero2-desc">{broker.bio}</p>}

            <div className="ad-hero2-actions">
              {broker.email && (
                <a href={`mailto:${broker.email}`} className="ad-btn ad-btn--primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M22 6l-10 7L2 6" /></svg>
                  Kontaktovat
                </a>
              )}
              {broker.phone && (
                <a href={`tel:${broker.phone}`} className="ad-btn ad-btn--secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  {broker.phone}
                </a>
              )}
              {broker.calendlyUrl && (
                <a href={broker.calendlyUrl} target="_blank" rel="noopener" className="ad-btn ad-btn--secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  Rezervovat schuzku
                </a>
              )}
            </div>

            {((broker.languages?.length ?? 0) > 0 || (broker.certifications?.length ?? 0) > 0) && (
              <div className="bp-chips-wrap" style={{ marginTop: 8 }}>
                {broker.languages?.map((l) => <span key={l} className="bp-chip">{l}</span>)}
                {broker.certifications?.map((c) => <span key={c} className="bp-chip bp-chip--accent">{c}</span>)}
              </div>
            )}

            {hasSocials && (
              <div className="bp-socials" style={{ marginTop: 8 }}>
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

            {agency && (
              <Link href={`/kancelare/${agency.slug}`} className="bd-agency-link">
                {agency.logo && <img src={agency.logo} alt={agency.name} className="bd-agency-logo" />}
                <span>{agency.name}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
              </Link>
            )}
          </div>

          {/* Right: Portrait + stats */}
          <div className="bd-hero-right">
            <div className="bd-portrait">
              {broker.photo ? (
                <img src={broker.photo} alt={broker.name} />
              ) : (
                <div className="bd-portrait-placeholder">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
              )}
            </div>
            <div className="ad-stats-grid bd-stats-grid">
              {broker.activeListings > 0 && (
                <div className="ad-stat-card">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  <span className="ad-stat-card-value">{broker.activeListings.toLocaleString("cs")}</span>
                  <span className="ad-stat-card-label">{t.profile.activeListings}</span>
                </div>
              )}
              {broker.totalDeals > 0 && (
                <div className="ad-stat-card">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  <span className="ad-stat-card-value">{broker.totalDeals}+</span>
                  <span className="ad-stat-card-label">{t.profile.totalDeals}</span>
                </div>
              )}
              {yearsExp > 0 && (
                <div className="ad-stat-card">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span className="ad-stat-card-value">{yearsExp}</span>
                  <span className="ad-stat-card-label">Let praxe</span>
                </div>
              )}
              {broker.rating > 0 && (
                <div className="ad-stat-card">
                  <Stars rating={broker.rating} size={14} />
                  <span className="ad-stat-card-value">{broker.rating}</span>
                  <span className="ad-stat-card-label">Hodnoceni</span>
                </div>
              )}
              {broker.avgResponseTimeHours && broker.avgResponseTimeHours > 0 && (
                <div className="ad-stat-card">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span className="ad-stat-card-value">{broker.avgResponseTimeHours < 1 ? `${Math.round(broker.avgResponseTimeHours * 60)}min` : `${broker.avgResponseTimeHours}h`}</span>
                  <span className="ad-stat-card-label">Odezva</span>
                </div>
              )}
              {broker.responseRatePct && broker.responseRatePct > 0 && (
                <div className="ad-stat-card">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  <span className="ad-stat-card-value">{broker.responseRatePct}%</span>
                  <span className="ad-stat-card-label">Mira odpovedi</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs (sticky) ─────────────────────────────────────── */}
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

        {/* O mne */}
        {hasAboutTab && (
          <Section id="o-mne">
            <SectionTitle>O mne</SectionTitle>

            {broker.videoUrl && (
              <div style={{ marginBottom: 32 }}>
                <VideoEmbed url={broker.videoUrl} type={broker.videoType} />
              </div>
            )}

            {hasAbout && (
              <div className="ad-about-grid">
                <div className="ad-about-text">
                  {(broker.bioLong || broker.bio) && <p>{broker.bioLong || broker.bio}</p>}
                </div>
                <div className="ad-about-sidebar">
                  {broker.education && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Vzdelani</span>
                      <p style={{ fontSize: "0.85rem", margin: 0 }}>{broker.education}</p>
                    </div>
                  )}
                  {broker.licenseNumber && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Licence</span>
                      <p style={{ fontSize: "0.85rem", margin: 0 }}>{broker.licenseNumber}</p>
                    </div>
                  )}
                  {(broker.awards?.length ?? 0) > 0 && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Oceneni</span>
                      <div className="ad-awards">
                        {broker.awards!.map((a, i) => (
                          <div key={i} className="ad-award">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent, #ffb800)" strokeWidth="2"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>
                            <span>{a.name}{a.year ? ` (${a.year})` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasPerformance && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Vykon</span>
                      <div className="ad-performance">
                        {broker.totalSalesVolume && broker.totalSalesVolume > 0 && (
                          <div className="ad-perf-row">
                            <span className="ad-perf-value">{broker.totalSalesVolume.toLocaleString("cs")} Kc</span>
                            <span className="ad-perf-label">Objem prodeju</span>
                          </div>
                        )}
                        {broker.responseRatePct && broker.responseRatePct > 0 && (
                          <div className="ad-perf-row">
                            <span className="ad-perf-value">{broker.responseRatePct}%</span>
                            <span className="ad-perf-label">Mira odpovedi</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {broker.hobbies && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Konicky</span>
                      <p style={{ fontSize: "0.85rem", margin: 0 }}>{broker.hobbies}</p>
                    </div>
                  )}
                  {broker.funFact && (
                    <div className="ad-sidebar-block">
                      <span className="ad-label">Fun fact</span>
                      <p style={{ fontSize: "0.85rem", margin: 0 }}>{broker.funFact}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasServiceAreas && (
              <div style={{ marginTop: 32 }}>
                <span className="ad-label" style={{ marginBottom: 10, display: "block" }}>Oblast pusobeni a specializace</span>
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
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 10 }}>
                    Cenovy rozsah: {broker.priceRangeMin.toLocaleString("cs")} – {broker.priceRangeMax.toLocaleString("cs")} Kc
                  </p>
                ) : null}
              </div>
            )}

            {hasGallery && (
              <div style={{ marginTop: 32 }}>
                <span className="ad-label" style={{ marginBottom: 10, display: "block" }}>Galerie</span>
                <div className="bp-gallery">
                  {galleryImages.map((img, i) => (
                    <div key={i} className="bp-gallery-item">
                      <img src={img} alt={`${broker.name} galerie ${i + 1}`} loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Nabidky */}
        {propertiesPage1.total > 0 && (
          <Section id="nabidky">
            <SectionTitle count={propertiesPage1.total}>{t.nav.listings}</SectionTitle>
            <DetailPropertiesGrid
              brokerId={broker.id}
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
              <span className="ad-reviews-avg">{broker.rating}</span>
              <Stars rating={broker.rating} size={20} />
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
      </main>

      <SiteFooter />
    </div>
  );
}
