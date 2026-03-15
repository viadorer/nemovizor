import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatPrice, getPropertyBySlug, getSimilarProperties, getBrokerById, getAgencyById } from "@/lib/api";
import { DetailMap, WideDetailMap } from "./detail-map";
import { MediaGallery } from "./media-gallery";
import { PointsOfInterest } from "./points-of-interest";
import { AutoSaveSearch } from "./auto-save-search";
import { MortgageCalculator } from "./mortgage-calculator";
import { ListingNav } from "./listing-nav";

function buildAddress(parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  return parts.filter((p): p is string => {
    if (!p) return false;
    const lower = p.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  }).join(", ");
}

const COUNTRY_LABELS: Record<string, string> = {
  cz: "\u010Cesk\u00E1 republika",
  sk: "Slovensko",
  at: "Rakousko",
  de: "N\u011Bmecko",
  hr: "Chorvatsko",
  cy: "Kypr",
  bg: "Bulharsko",
  al: "Alb\u00E1nie",
  es: "\u0160pan\u011Blsko",
  it: "It\u00E1lie",
  gr: "\u0158ecko",
  fr: "Francie",
  me: "\u010Cern\u00E1 Hora",
  tr: "Turecko",
  pt: "Portugalsko",
  hu: "Ma\u010Farsko",
};

type PropertyDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) {
    notFound();
  }

  const similarProperties = await getSimilarProperties(property.slug, property.city);
  const broker = property.brokerId ? await getBrokerById(property.brokerId) : undefined;
  const agency = broker?.agencyId ? await getAgencyById(broker.agencyId) : undefined;

  const params_data = [
    { label: "Typ", value: property.subtype },
    { label: "Dispozice", value: property.roomsLabel },
    { label: "Plocha", value: `${property.area} m²` },
    ...(property.landArea ? [{ label: "Pozemek", value: `${property.landArea} m²` }] : []),
    { label: "Město", value: property.city },
    { label: "Městská část", value: property.district },
    ...(property.country && property.country !== "cz" ? [{ label: "Země", value: COUNTRY_LABELS[property.country] || property.country.toUpperCase() }] : []),
    { label: "Stav", value: property.condition },
    { label: "Vlastnictví", value: property.ownership },
    { label: "Vybavení", value: property.furnishing },
    { label: "Energetický štítek", value: property.energyRating },
    ...(property.buildingMaterial ? [{ label: "Materiál", value: property.buildingMaterial }] : []),
    ...(property.heating?.length ? [{ label: "Topení", value: property.heating.join(", ") }] : []),
    { label: "Parkování", value: property.parking },
    ...(property.floor ? [{ label: "Podlaží", value: `${property.floor}/${property.totalFloors}` }] : []),
    ...(property.yearBuilt ? [{ label: "Rok výstavby", value: String(property.yearBuilt) }] : []),
    ...(property.lastRenovation ? [{ label: "Poslední renovace", value: String(property.lastRenovation) }] : []),
    ...(property.totalFloors && !property.floor ? [{ label: "Počet podlaží", value: String(property.totalFloors) }] : []),
  ];

  const features = [
    property.balcony && "Balkon",
    property.terrace && "Terasa",
    property.garden && "Zahrada",
    property.elevator && "Výtah",
    property.cellar && "Sklep",
    property.garage && "Garáž",
    property.pool && "Bazén",
    property.loggia && "Lodžie",
  ].filter(Boolean);

  return (
    <div className="page-shell">
      <SiteHeader />
      <AutoSaveSearch />
      <main className="detail-page">
        <div className="detail-wide-layout">
        <div className="detail-wide-content">
        <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
          <div className="detail-top-nav">
            <Link href="/nabidky" className="detail-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{"Zp\u011bt na nab\u00eddky"}</span>
            </Link>
            <ListingNav currentSlug={slug} />
          </div>

          <MediaGallery
            images={property.images.length > 0 ? property.images : [property.imageSrc]}
            alt={property.imageAlt}
            videoUrl={property.videoUrl}
            matterportUrl={property.matterportUrl}
          />

          <div className="detail-header">
            <div>
              <span
                className="detail-listing-badge"
                style={{ backgroundColor: property.listingType === "sale" ? "var(--badge-sale)" : "var(--badge-rent)" }}
              >
                {property.listingType === "sale" ? "Prodej" : "Pronájem"}
              </span>
              <h1 className="detail-title">{property.title}</h1>
              <div className="detail-location">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {buildAddress([property.street, property.district, property.city, property.country && property.country !== "cz" ? COUNTRY_LABELS[property.country] || property.country.toUpperCase() : undefined])}
              </div>
            </div>
            <div className="detail-price">{formatPrice(property.price, property.priceCurrency)}</div>
          </div>

          <div className="detail-grid">
            <div>
              <div className="detail-section">
                <h2 className="detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  Popis
                </h2>
                <p className="detail-description">{property.summary}</p>
              </div>

              <div className="detail-section">
                <h2 className="detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Parametry
                </h2>
                <div className="detail-params-grid">
                  {params_data.map((param) => (
                    <div key={param.label} className="detail-param">
                      <span className="detail-param-label">{param.label}</span>
                      <span className="detail-param-value">{param.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {features.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <path d="M22 4L12 14.01l-3-3" />
                    </svg>
                    Vybavení a vlastnosti
                  </h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {features.map((f) => (
                      <span
                        key={f as string}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          background: "var(--bg-filter)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-light)",
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {property.pointsOfInterest && property.pointsOfInterest.length > 0 && (
                <PointsOfInterest items={property.pointsOfInterest} />
              )}
            </div>

            <aside>
              <div className="detail-sidebar-card">
                <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Makléř
                </h3>
                <div className="broker-card-header">
                  <div className="broker-avatar" style={{ overflow: "hidden", flexShrink: 0 }}>
                    {broker?.photo ? (
                      <img src={broker.photo} alt={property.brokerName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="broker-name">{property.brokerName}</div>
                    {agency ? (
                      <Link href={`/kancelare/${agency.slug}`} className="broker-agency" style={{ textDecoration: "none" }}>
                        {property.agencyName}
                      </Link>
                    ) : (
                      <div className="broker-agency">{property.agencyName}</div>
                    )}
                  </div>
                </div>
                {property.brokerPhone && (
                  <div className="broker-contact-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <a href={`tel:${property.brokerPhone}`} style={{ color: "inherit", textDecoration: "none" }}>{property.brokerPhone}</a>
                  </div>
                )}
                {property.brokerEmail && (
                  <div className="broker-contact-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                    <a href={`mailto:${property.brokerEmail}`} style={{ color: "inherit", textDecoration: "none" }}>{property.brokerEmail}</a>
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <button className="detail-cta-btn detail-cta-btn--primary">
                    Mám zájem o nabídku
                  </button>
                  {broker ? (
                    <Link href={`/makleri/${broker.slug}`} className="detail-cta-btn detail-cta-btn--secondary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                      Zobrazit profil makléře
                    </Link>
                  ) : (
                    <button className="detail-cta-btn detail-cta-btn--secondary">
                      Zobrazit profil makléře
                    </button>
                  )}
                </div>
              </div>

              {agency && (
                <div className="detail-sidebar-card">
                  <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    Kancelář
                  </h3>
                  <Link href={`/kancelare/${agency.slug}`} style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 56, height: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {agency.logo ? (
                          <img src={agency.logo} alt={agency.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--bg-filter)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "1rem" }}>{agency.name}</div>
                        {agency.specializations.length > 0 && (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                            {agency.specializations.slice(0, 2).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                  {agency.phone && (
                    <div className="broker-contact-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <a href={`tel:${agency.phone}`} style={{ color: "inherit", textDecoration: "none" }}>{agency.phone}</a>
                    </div>
                  )}
                  {agency.email && (
                    <div className="broker-contact-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <path d="M22 6l-10 7L2 6" />
                      </svg>
                      <a href={`mailto:${agency.email}`} style={{ color: "inherit", textDecoration: "none" }}>{agency.email}</a>
                    </div>
                  )}
                  {agency.website && (
                    <div className="broker-contact-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <a href={agency.website} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                        {agency.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                    </div>
                  )}
                  <div style={{ marginTop: 12 }}>
                    <Link href={`/kancelare/${agency.slug}`} className="detail-cta-btn detail-cta-btn--secondary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                      Zobrazit profil kanceláře
                    </Link>
                  </div>
                </div>
              )}

              {property.listingType === "sale" && (
                <MortgageCalculator propertyPrice={property.price} priceCurrency={property.priceCurrency} />
              )}

              <div className="detail-sidebar-card">
                <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  Lokalita
                </h3>
                <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                  {buildAddress([property.street, property.district, property.city, property.country && property.country !== "cz" ? COUNTRY_LABELS[property.country] || property.country.toUpperCase() : undefined])}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
                  {property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}
                </div>
                <DetailMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  title={property.title}
                  price={property.price}
                />
              </div>
            </aside>
          </div>

          {similarProperties.length > 0 && (
            <section className="similar-section">
              <h2 className="section-title">Podobné nabídky</h2>
              <div className="similar-grid">
                {similarProperties.map((item) => (
                  <PropertyCard key={item.id} property={item} />
                ))}
              </div>
            </section>
          )}
        </div>
        </div>
        <div className="detail-wide-map">
          <WideDetailMap
            properties={[property, ...similarProperties]}
            selectedPropertyId={property.id}
          />
        </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
